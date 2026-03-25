export type AgendaPrioridade = "alta" | "media" | "baixa";
export type AgendaCategoria =
  | "Trabalho"
  | "Pessoal"
  | "Saúde"
  | "Finanças"
  | "Estudo"
  | "Lazer";

export interface AgendaItem {
  id: number;
  titulo: string;
  descricao: string;
  data_hora: string | null;
  categoria: AgendaCategoria | string;
  prioridade: AgendaPrioridade;
  concluido: boolean;
  criado_em: string;
}

export interface CreateAgendaItemInput {
  titulo: string;
  descricao?: string;
  data_hora?: string | null;
  categoria?: string;
  prioridade?: AgendaPrioridade;
}

export interface UpdateAgendaItemInput {
  titulo?: string;
  descricao?: string;
  data_hora?: string | null;
  categoria?: string;
  prioridade?: AgendaPrioridade;
  concluido?: boolean;
}

export const AGENDA_CATEGORIAS: AgendaCategoria[] = [
  "Trabalho",
  "Pessoal",
  "Saúde",
  "Finanças",
  "Estudo",
  "Lazer",
];

export const PRIORIDADE_LABELS: Record<AgendaPrioridade, string> = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};
