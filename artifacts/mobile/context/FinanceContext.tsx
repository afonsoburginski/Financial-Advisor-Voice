import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { FINANCE } from "@/constants/finance";

export type Decisao = {
  id: number;
  data: string;
  titulo: string;
  valor: number;
  categoria: string;
};

type FinanceContextType = {
  decisoes: Decisao[];
  sobraMensal: number;
  savedAmount: number;
  isLoading: boolean;
  addDecisao: (titulo: string, valor: number, categoria: string) => Promise<void>;
  removeDecisao: (id: number) => Promise<void>;
  refetch: () => Promise<void>;
};

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const [decisoes, setDecisoes] = useState<Decisao[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const totalGastos = decisoes.reduce((acc, d) => acc + Math.abs(d.valor), 0);
  const sobraMensal = FINANCE.SOBRA_MENSAL - totalGastos;
  const savedAmount = Math.max(0, sobraMensal);

  const fetchDecisoes = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/decisoes`);
      if (res.ok) {
        const data = await res.json();
        setDecisoes(data);
      }
    } catch (e) {
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addDecisao = useCallback(async (titulo: string, valor: number, categoria: string) => {
    const res = await fetch(`${BASE_URL}/api/decisoes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titulo, valor, categoria }),
    });
    if (res.ok) {
      await fetchDecisoes();
    }
  }, [fetchDecisoes]);

  const removeDecisao = useCallback(async (id: number) => {
    await fetch(`${BASE_URL}/api/decisoes/${id}`, { method: "DELETE" });
    setDecisoes((prev) => prev.filter((d) => d.id !== id));
  }, []);

  useEffect(() => {
    fetchDecisoes();
  }, [fetchDecisoes]);

  return (
    <FinanceContext.Provider
      value={{
        decisoes,
        sobraMensal,
        savedAmount,
        isLoading,
        addDecisao,
        removeDecisao,
        refetch: fetchDecisoes,
      }}
    >
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error("useFinance must be used within FinanceProvider");
  return ctx;
}
