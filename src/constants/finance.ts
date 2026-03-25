/** Categorias sugeridas para gastos / classificação pela IA. */
export const FINANCE_CATEGORIAS = [
  "Alimentação",
  "Saúde",
  "Lazer",
  "Educação",
  "Vestuário",
  "Transporte",
  "Tecnologia",
  "Moradia",
  "Outros",
] as const;

/** Dias de atraso na meta se gastar `valor` num mês, dado a sobra mensal atual. */
export function calcularImpactoSandero(valor: number, sobraMensal: number): number {
  if (sobraMensal <= 0 || valor <= 0) return 0;
  return Math.round((valor / sobraMensal) * 30);
}

export const formatCurrency = (value: number): string => {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
};

export const formatDate = (date: string): string => {
  return new Date(date + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

export const isAbril = (): boolean => {
  const now = new Date();
  return now.getMonth() === 3;
};
