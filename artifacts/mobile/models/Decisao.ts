export type DecisaoCategoria =
  | "Alimentação"
  | "Saúde"
  | "Lazer"
  | "Educação"
  | "Vestuário"
  | "Transporte"
  | "Tecnologia"
  | "Outros";

export interface Decisao {
  id: number;
  data: string;
  titulo: string;
  valor: number;
  categoria: DecisaoCategoria | string;
}

export interface CreateDecisaoInput {
  titulo: string;
  valor: number;
  categoria: string;
}

export const DECISAO_CATEGORIAS: DecisaoCategoria[] = [
  "Alimentação",
  "Saúde",
  "Lazer",
  "Educação",
  "Vestuário",
  "Transporte",
  "Tecnologia",
  "Outros",
];
