import { z } from "zod";
import { getOpenAIModel } from "./openai";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

const ItemSchema = z.object({
  kind: z.enum(["income", "expense"]),
  amount: z.number().positive(),
  title: z.string().min(1),
  category: z.string().optional(),
  date: z.string().optional(),
});

const WrapSchema = z.object({
  transactions: z.array(ItemSchema),
});

export type ParsedStatementLine = z.infer<typeof ItemSchema>;

type OpenAIResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
  error?: { message?: string };
};

/**
 * Extrai movimentos de um texto de extrato (copiado do PDF/app do banco) via OpenAI.
 */
export async function parseBankStatementWithAI(
  apiKey: string,
  statementText: string,
  model?: string
): Promise<ParsedStatementLine[]> {
  const trimmed = statementText.trim();
  if (!trimmed) return [];

  const m = model?.trim() || getOpenAIModel();

  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: m,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            "Extrai movimentos financeiros de extratos bancários ou de cartão em português (Brasil).",
            'Responde APENAS com um objeto JSON: {"transactions":[...]}.',
            "Cada item: kind \"income\" (créditos, salário, TED recebida, estorno) ou \"expense\" (débito, compra, PIX saída, boleto).",
            "amount: número positivo em reais (sem R$). title: descrição curta em português.",
            "category: opcional (Alimentação, Transporte, Moradia, Saúde, Lazer, etc.).",
            "date: opcional YYYY-MM-DD; se não houver data clara, omite date.",
            "Ignora saldos, totais e cabeçalhos sem linha de movimento.",
          ].join(" "),
        },
        { role: "user", content: trimmed.slice(0, 120_000) },
      ],
      temperature: 0.15,
      max_tokens: 4096,
    }),
  });

  const data = (await res.json()) as OpenAIResponse;
  if (!res.ok) {
    throw new Error(data.error?.message ?? res.statusText ?? "OpenAI falhou");
  }

  const raw = data.choices?.[0]?.message?.content?.trim();
  if (!raw) throw new Error("Resposta vazia da OpenAI");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("JSON inválido devolvido pela IA");
  }

  const out = WrapSchema.safeParse(parsed);
  if (!out.success) {
    throw new Error("Formato inesperado na resposta da IA");
  }

  return out.data.transactions;
}
