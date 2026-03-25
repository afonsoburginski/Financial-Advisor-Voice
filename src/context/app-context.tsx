import React from "react";

/** Mantido por compatibilidade com o layout; estado financeiro está em SQLite + React Query. */
export function AppProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
