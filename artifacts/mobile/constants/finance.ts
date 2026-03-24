export const FINANCE = {
  SALARIO_BRUTO: 10460.00,
  SALARIO_LIQUIDO: 7872.72,
  VALE_ALIMENTACAO_DIA: 36.90,
  VALE_ALIMENTACAO_MES: 811.80,

  CUSTOS_FIXOS: {
    aluguel: 1833.95,
    energia: 200.00,
    celular: 17.00,
    transporte: 224.40,
    lazer: 300.00,
  },

  TOTAL_CUSTOS_FIXOS: 2575.35,

  SOBRA_MENSAL: 4797.37,

  META_SANDERO: {
    valor: 30000.00,
    descricao: "Sandero 2015 à vista",
    economizado: 0,
  },

  PERFIL: {
    nome: "PCD - Visão Monocular",
    beneficios: ["Isenção de IPVA", "Isenção de IOF"],
  },

  CATEGORIAS: [
    "Alimentação",
    "Saúde",
    "Lazer",
    "Educação",
    "Vestuário",
    "Transporte",
    "Tecnologia",
    "Outros",
  ],

  DIAS_UTEIS_MES: 22,
};

export const calcularImpactoSandero = (valor: number): number => {
  const sobra = FINANCE.SOBRA_MENSAL;
  const fracaoDaSobra = valor / sobra;
  const diasAtraso = Math.round(fracaoDaSobra * 30);
  return diasAtraso;
};

export const formatCurrency = (value: number): string => {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
};

export const formatDate = (date: string): string => {
  return new Date(date).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

export const isAbril = (): boolean => {
  const now = new Date();
  return now.getMonth() === 3;
};
