export interface UserProfile {
  id: number;
  nome: string;
  cidade: string | null;
  estado: string | null;
  profissao: string | null;
  meta_nome: string | null;
  meta_valor: number | null;
  notas: string | null;
  atualizado_em: string;
}

export interface TommyMemoria {
  id: number;
  categoria: string;
  chave: string;
  valor: string;
  criado_em: string;
}
