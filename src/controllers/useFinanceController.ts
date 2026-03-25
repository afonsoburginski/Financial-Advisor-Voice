import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { calcularImpactoSandero } from "@/constants/finance";
import { USER_PROFILE } from "@/constants/userProfile";
import {
  computeSobraMensal,
  deleteLedgerEntry,
  getFinanceSettings,
  insertLedgerEntriesBulk,
  insertLedgerEntry,
  listLedgerInMonth,
  listRecentLedger,
  monthTotals,
  todayISODate,
  totalFixos,
  updateFinanceSettings,
  type FinanceSettings,
} from "@/db/financeDb";
import type { LedgerEntry } from "@/models/Ledger";
import type { CreateDecisaoInput, Decisao } from "@/models/Decisao";
import type { FinanceAiSnapshot } from "@/services/openai";
import { getOpenAIApiKey, getOpenAIModel } from "@/services/openai";
import { parseBankStatementWithAI } from "@/services/statementParse";

const BUNDLE_KEY = ["local-finance-bundle"] as const;

function expensesToDecisoes(ledger: LedgerEntry[]): Decisao[] {
  return ledger
    .filter((e) => e.kind === "expense")
    .map((e) => ({
      id: e.id,
      data: e.occurred_at,
      titulo: e.title,
      valor: e.amount,
      categoria: e.category ?? "Outros",
    }));
}

function buildResumoLinhas(recent: LedgerEntry[]): string {
  if (!recent.length) return "";
  return recent
    .slice(0, 18)
    .map(
      (r) =>
        `${r.occurred_at} ${r.kind === "income" ? "+" : "−"} ${r.amount.toFixed(2)} — ${r.title}`
    )
    .join("\n");
}

export function useFinanceController() {
  const queryClient = useQueryClient();

  const bundle = useQuery({
    queryKey: BUNDLE_KEY,
    queryFn: async () => {
      const [settings, ledgerMonth, totals, recent] = await Promise.all([
        getFinanceSettings(),
        listLedgerInMonth(),
        monthTotals(),
        listRecentLedger(28),
      ]);
      return { settings, ledgerMonth, totals, recent };
    },
  });

  const settings = bundle.data?.settings;
  const totals = bundle.data?.totals ?? { income: 0, expense: 0 };
  const ledgerMonth = bundle.data?.ledgerMonth ?? [];
  const recent = bundle.data?.recent ?? [];

  const totalExpenseMonth = totals.expense;
  const totalIncomeMonth = totals.income;

  const sobraMensal = settings
    ? computeSobraMensal(settings, totalExpenseMonth)
    : 0;

  const fixosSum = settings ? totalFixos(settings) : 0;

  const decisoes = expensesToDecisoes(ledgerMonth);

  const progressSandero =
    settings && settings.meta_valor > 0
      ? Math.min(settings.economizado_meta / settings.meta_valor, 1)
      : 0;

  const mesesParaSandero =
    settings &&
    sobraMensal > 0 &&
    settings.meta_valor > settings.economizado_meta
      ? Math.ceil(
          (settings.meta_valor - settings.economizado_meta) / sobraMensal
        )
      : 0;

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: BUNDLE_KEY });

  const createDecisaoMutation = useMutation({
    mutationFn: async (input: CreateDecisaoInput) => {
      await insertLedgerEntry({
        kind: "expense",
        amount: input.valor,
        title: input.titulo,
        category: input.categoria,
        occurred_at: todayISODate(),
        source: "manual",
      });
    },
    onSuccess: invalidate,
  });

  const createIncomeMutation = useMutation({
    mutationFn: async (input: {
      titulo: string;
      valor: number;
      categoria?: string;
    }) => {
      await insertLedgerEntry({
        kind: "income",
        amount: input.valor,
        title: input.titulo,
        category: input.categoria ?? "Receita",
        occurred_at: todayISODate(),
        source: "manual",
      });
    },
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteLedgerEntry(id),
    onSuccess: invalidate,
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (patch: Partial<FinanceSettings>) =>
      updateFinanceSettings(patch),
    onSuccess: invalidate,
  });

  const importStatementMutation = useMutation({
    mutationFn: async (text: string) => {
      const key = getOpenAIApiKey();
      if (!key) {
        throw new Error(
          "Define EXPO_PUBLIC_OPENAI_API_KEY no .env para importar com IA."
        );
      }
      const lines = await parseBankStatementWithAI(
        key,
        text,
        getOpenAIModel()
      );
      const mapped = lines.map((l) => ({
        kind: l.kind,
        amount: l.amount,
        title: l.title,
        category: l.category ?? null,
        occurred_at:
          l.date && /^\d{4}-\d{2}-\d{2}$/.test(l.date)
            ? l.date
            : todayISODate(),
        source: "statement_ai" as const,
      }));
      return insertLedgerEntriesBulk(mapped);
    },
    onSuccess: invalidate,
  });

  const tommySnapshot: FinanceAiSnapshot | null = settings
    ? {
        nomeTratamento: USER_PROFILE.nomeTratamento,
        salarioBruto: settings.salario_bruto,
        salarioLiquido: settings.salario_liquido,
        valeAlimentacaoMes: settings.vale_alimentacao_mes,
        totalFixos: fixosSum,
        metaTitulo: settings.meta_titulo,
        metaValor: settings.meta_valor,
        economizadoMeta: settings.economizado_meta,
        sobraMensal,
        receitasMes: totalIncomeMonth,
        gastosMes: totalExpenseMonth,
        resumoUltimasLinhas: buildResumoLinhas(recent),
      }
    : null;

  return {
    settings,
    ledgerMonth,
    decisoes,
    totalExtras: totalExpenseMonth,
    totalIncomeMonth,
    sobraMensal,
    fixosSum,
    progressSandero,
    mesesParaSandero,
    isLoading: bundle.isLoading,
    isError: bundle.isError,
    refetch: bundle.refetch,
    createDecisao: createDecisaoMutation.mutate,
    createIncome: createIncomeMutation.mutate,
    isCreating:
      createDecisaoMutation.isPending || createIncomeMutation.isPending,
    deleteDecisao: deleteMutation.mutate,
    updateSettings: updateSettingsMutation.mutate,
    isUpdatingSettings: updateSettingsMutation.isPending,
    importStatementAsync: importStatementMutation.mutateAsync,
    isImporting: importStatementMutation.isPending,
    tommySnapshot,
    calcularImpactoSandero: (v: number) =>
      calcularImpactoSandero(v, sobraMensal),
  };
}
