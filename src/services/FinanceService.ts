import { api } from "./baseApi";
import type { Decisao, CreateDecisaoInput } from "@/models/Decisao";

export const FinanceService = {
  listDecisoes: (): Promise<Decisao[]> =>
    api.get<Decisao[]>("/decisoes"),

  createDecisao: (input: CreateDecisaoInput): Promise<Decisao> =>
    api.post<Decisao>("/decisoes", input),

  deleteDecisao: (id: number): Promise<void> =>
    api.delete(`/decisoes/${id}`),
};
