import { formatCurrency } from "@/constants/finance";
import { buildUserContextForOpenAI } from "@/constants/userProfile";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

export type ChatTurn = { role: "user" | "assistant"; content: string };

/** Dados agregados da base local para o system prompt da Tommy. */
export type FinanceAiSnapshot = {
  nomeTratamento: string;
  salarioBruto: number;
  salarioLiquido: number;
  valeAlimentacaoMes: number;
  totalFixos: number;
  metaTitulo: string;
  metaValor: number;
  economizadoMeta: number;
  sobraMensal: number;
  receitasMes: number;
  gastosMes: number;
  resumoUltimasLinhas: string;
};

export function buildSystemPrompt(snapshot: FinanceAiSnapshot): string {
  const metaLinha =
    snapshot.metaValor > 0
      ? `Meta: ${snapshot.metaTitulo || "(sem título)"} · objetivo ${formatCurrency(snapshot.metaValor)} · já guardado ${formatCurrency(snapshot.economizadoMeta)}`
      : "Meta financeira: ainda não definida no Painel (valor objetivo = 0).";

  return [
    "És o Tommy, assistente para decisões de vida, carreira e finanças pessoais numa app mobile em português do Brasil.",
    "Respostas claras, curtas a médias, tom amigável e profissional. Usa markdown só se ajudar (listas curtas).",
    "Não inventes números monetários: usa sempre o bloco “Dados na base” abaixo. Se faltar dado, diz para ver o Painel ou para configurar rendimento/fixos.",
    "",
    buildUserContextForOpenAI(),
    "",
    "### Dados financeiros na base local (mês corrente e configuração)",
    `Nome de tratamento: ${snapshot.nomeTratamento}`,
    `Salário bruto (configurado): ${formatCurrency(snapshot.salarioBruto)} · Salário líquido: ${formatCurrency(snapshot.salarioLiquido)} · VA mensal: ${formatCurrency(snapshot.valeAlimentacaoMes)}`,
    `Custos fixos mensais (soma configurada): ${formatCurrency(snapshot.totalFixos)}`,
    `Receitas registadas no mês (extrato/manual): ${formatCurrency(snapshot.receitasMes)}`,
    `Gastos registados no mês (extrato/manual): ${formatCurrency(snapshot.gastosMes)}`,
    `Sobra mensal estimada: ${formatCurrency(snapshot.sobraMensal)} — (líquido + VA − fixos − gastos do mês na base)`,
    metaLinha,
    "",
    "### Últimas linhas do livro-razão (resumo)",
    snapshot.resumoUltimasLinhas || "(sem movimentos recentes)",
    "",
    "Podes sugerir registar gastos ou receitas na app; extratos em texto podem ser importados com IA no Painel.",
  ].join("\n");
}

type OpenAIResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
  error?: { message?: string };
};

export async function openaiChatCompletion(options: {
  apiKey: string;
  model?: string;
  systemPrompt: string;
  messages: ChatTurn[];
}): Promise<string> {
  const model = options.model?.trim() || "gpt-4o-mini";

  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: options.systemPrompt }, ...options.messages],
      max_tokens: 900,
      temperature: 0.65,
    }),
  });

  const data = (await res.json()) as OpenAIResponse;

  if (!res.ok) {
    const err = data.error?.message ?? res.statusText;
    throw new Error(err || "OpenAI request failed");
  }

  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Resposta vazia da OpenAI");

  return text;
}

export function getOpenAIApiKey(): string | undefined {
  const k = process.env.EXPO_PUBLIC_OPENAI_API_KEY?.trim();
  return k || undefined;
}

export function getOpenAIModel(): string {
  return process.env.EXPO_PUBLIC_OPENAI_MODEL?.trim() || "gpt-4o-mini";
}
