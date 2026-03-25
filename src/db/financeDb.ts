import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";
import type { LedgerEntry, LedgerKind, LedgerSource } from "@/models/Ledger";

export type FinanceSettings = {
  salario_bruto: number;
  salario_liquido: number;
  vale_alimentacao_mes: number;
  meta_titulo: string;
  meta_valor: number;
  economizado_meta: number;
  fixo_aluguel: number;
  fixo_energia: number;
  fixo_celular: number;
  fixo_transporte: number;
  fixo_lazer: number;
  fixo_outros: number;
};

const SETTINGS_ID = 1;

let dbPromise: Promise<SQLiteDatabase> | null = null;

function monthBounds(d = new Date()): { start: string; end: string } {
  const y = d.getFullYear();
  const m = d.getMonth();
  const pad = (n: number) => String(n).padStart(2, "0");
  const start = `${y}-${pad(m + 1)}-01`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const end = `${y}-${pad(m + 1)}-${pad(lastDay)}`;
  return { start, end };
}

async function migrate(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS finance_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      salario_bruto REAL NOT NULL DEFAULT 0,
      salario_liquido REAL NOT NULL DEFAULT 0,
      vale_alimentacao_mes REAL NOT NULL DEFAULT 0,
      meta_titulo TEXT NOT NULL DEFAULT '',
      meta_valor REAL NOT NULL DEFAULT 0,
      economizado_meta REAL NOT NULL DEFAULT 0,
      fixo_aluguel REAL NOT NULL DEFAULT 0,
      fixo_energia REAL NOT NULL DEFAULT 0,
      fixo_celular REAL NOT NULL DEFAULT 0,
      fixo_transporte REAL NOT NULL DEFAULT 0,
      fixo_lazer REAL NOT NULL DEFAULT 0,
      fixo_outros REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS ledger_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL CHECK (kind IN ('income','expense')),
      amount REAL NOT NULL CHECK (amount > 0),
      title TEXT NOT NULL,
      category TEXT,
      occurred_at TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'manual',
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_ledger_occurred ON ledger_transactions(occurred_at);
    CREATE INDEX IF NOT EXISTS idx_ledger_kind ON ledger_transactions(kind);

    INSERT OR IGNORE INTO finance_settings (id) VALUES (1);
  `);
}

export async function getFinanceDb(): Promise<SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await openDatabaseAsync("tommy_finance.db");
      await migrate(db);
      return db;
    })();
  }
  return dbPromise;
}

export function totalFixos(s: FinanceSettings): number {
  return (
    s.fixo_aluguel +
    s.fixo_energia +
    s.fixo_celular +
    s.fixo_transporte +
    s.fixo_lazer +
    s.fixo_outros
  );
}

/** Renda mensal esperada (configurada pelo utilizador), sem usar movimentos do extrato. */
export function expectedMonthlyInflow(s: FinanceSettings): number {
  return s.salario_liquido + s.vale_alimentacao_mes;
}

/**
 * Sobra mensal planejada = entradas esperadas − fixos − gastos variáveis registados no mês corrente.
 */
export function computeSobraMensal(
  s: FinanceSettings,
  totalExpenseMonth: number
): number {
  return expectedMonthlyInflow(s) - totalFixos(s) - totalExpenseMonth;
}

export async function getFinanceSettings(): Promise<FinanceSettings> {
  const db = await getFinanceDb();
  const rows = await db.getAllAsync<FinanceSettings>(
    `SELECT salario_bruto, salario_liquido, vale_alimentacao_mes, meta_titulo, meta_valor, economizado_meta,
            fixo_aluguel, fixo_energia, fixo_celular, fixo_transporte, fixo_lazer, fixo_outros
     FROM finance_settings WHERE id = ?`,
    SETTINGS_ID
  );
  const r = rows[0];
  if (!r) {
    return {
      salario_bruto: 0,
      salario_liquido: 0,
      vale_alimentacao_mes: 0,
      meta_titulo: "",
      meta_valor: 0,
      economizado_meta: 0,
      fixo_aluguel: 0,
      fixo_energia: 0,
      fixo_celular: 0,
      fixo_transporte: 0,
      fixo_lazer: 0,
      fixo_outros: 0,
    };
  }
  return r;
}

export async function updateFinanceSettings(
  patch: Partial<FinanceSettings>
): Promise<FinanceSettings> {
  const cur = await getFinanceSettings();
  const next = { ...cur, ...patch };
  const db = await getFinanceDb();
  await db.runAsync(
    `UPDATE finance_settings SET
      salario_bruto = ?, salario_liquido = ?, vale_alimentacao_mes = ?,
      meta_titulo = ?, meta_valor = ?, economizado_meta = ?,
      fixo_aluguel = ?, fixo_energia = ?, fixo_celular = ?,
      fixo_transporte = ?, fixo_lazer = ?, fixo_outros = ?
     WHERE id = ?`,
    next.salario_bruto,
    next.salario_liquido,
    next.vale_alimentacao_mes,
    next.meta_titulo,
    next.meta_valor,
    next.economizado_meta,
    next.fixo_aluguel,
    next.fixo_energia,
    next.fixo_celular,
    next.fixo_transporte,
    next.fixo_lazer,
    next.fixo_outros,
    SETTINGS_ID
  );
  return next;
}

function mapLedgerRow(r: {
  id: number;
  kind: LedgerKind;
  amount: number;
  title: string;
  category: string | null;
  occurred_at: string;
  source: string;
  created_at: number;
}): LedgerEntry {
  return {
    id: r.id,
    kind: r.kind,
    amount: r.amount,
    title: r.title,
    category: r.category,
    occurred_at: r.occurred_at,
    source: r.source as LedgerSource,
    created_at: r.created_at,
  };
}

export async function listLedgerInMonth(
  d = new Date()
): Promise<LedgerEntry[]> {
  const { start, end } = monthBounds(d);
  const db = await getFinanceDb();
  const rows = await db.getAllAsync<{
    id: number;
    kind: LedgerKind;
    amount: number;
    title: string;
    category: string | null;
    occurred_at: string;
    source: string;
    created_at: number;
  }>(
    `SELECT * FROM ledger_transactions
     WHERE occurred_at >= ? AND occurred_at <= ?
     ORDER BY occurred_at DESC, id DESC`,
    start,
    end
  );
  return rows.map(mapLedgerRow);
}

export async function listRecentLedger(limit = 40): Promise<LedgerEntry[]> {
  const db = await getFinanceDb();
  const rows = await db.getAllAsync<{
    id: number;
    kind: LedgerKind;
    amount: number;
    title: string;
    category: string | null;
    occurred_at: string;
    source: string;
    created_at: number;
  }>(
    `SELECT * FROM ledger_transactions
     ORDER BY occurred_at DESC, id DESC
     LIMIT ?`,
    limit
  );
  return rows.map(mapLedgerRow);
}

export async function monthTotals(d = new Date()): Promise<{
  income: number;
  expense: number;
}> {
  const { start, end } = monthBounds(d);
  const db = await getFinanceDb();
  const rows = await db.getAllAsync<{ kind: LedgerKind; total: number }>(
    `SELECT kind, SUM(amount) as total FROM ledger_transactions
     WHERE occurred_at >= ? AND occurred_at <= ?
     GROUP BY kind`,
    start,
    end
  );
  let income = 0;
  let expense = 0;
  for (const r of rows) {
    if (r.kind === "income") income = r.total ?? 0;
    if (r.kind === "expense") expense = r.total ?? 0;
  }
  return { income, expense };
}

export async function insertLedgerEntry(input: {
  kind: LedgerKind;
  amount: number;
  title: string;
  category?: string | null;
  occurred_at: string;
  source?: LedgerSource;
}): Promise<number> {
  const db = await getFinanceDb();
  const now = Date.now();
  const res = await db.runAsync(
    `INSERT INTO ledger_transactions (kind, amount, title, category, occurred_at, source, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    input.kind,
    input.amount,
    input.title,
    input.category ?? null,
    input.occurred_at,
    input.source ?? "manual",
    now
  );
  return Number(res.lastInsertRowId);
}

export async function insertLedgerEntriesBulk(
  items: Array<{
    kind: LedgerKind;
    amount: number;
    title: string;
    category?: string | null;
    occurred_at: string;
    source?: LedgerSource;
  }>
): Promise<number> {
  const db = await getFinanceDb();
  let n = 0;
  await db.withTransactionAsync(async () => {
    const now = Date.now();
    for (const input of items) {
      await db.runAsync(
        `INSERT INTO ledger_transactions (kind, amount, title, category, occurred_at, source, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        input.kind,
        input.amount,
        input.title,
        input.category ?? null,
        input.occurred_at,
        input.source ?? "statement_ai",
        now
      );
      n += 1;
    }
  });
  return n;
}

export async function deleteLedgerEntry(id: number): Promise<void> {
  const db = await getFinanceDb();
  await db.runAsync(`DELETE FROM ledger_transactions WHERE id = ?`, id);
}

export function todayISODate(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
