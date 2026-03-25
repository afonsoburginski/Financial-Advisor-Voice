export type LedgerKind = "income" | "expense";

export type LedgerSource = "manual" | "statement_ai" | "voice";

export interface LedgerEntry {
  id: number;
  kind: LedgerKind;
  amount: number;
  title: string;
  category: string | null;
  occurred_at: string;
  source: LedgerSource;
  created_at: number;
}
