import { api } from "./baseApi";
import type {
  AgendaItem,
  CreateAgendaItemInput,
  UpdateAgendaItemInput,
} from "@/models/AgendaItem";

export const AgendaService = {
  listItems: (): Promise<AgendaItem[]> =>
    api.get<AgendaItem[]>("/agenda"),

  createItem: (input: CreateAgendaItemInput): Promise<AgendaItem> =>
    api.post<AgendaItem>("/agenda", input),

  updateItem: (id: number, input: UpdateAgendaItemInput): Promise<AgendaItem> =>
    api.patch<AgendaItem>(`/agenda/${id}`, input),

  deleteItem: (id: number): Promise<void> =>
    api.delete(`/agenda/${id}`),
};
