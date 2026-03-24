import { api } from "./baseApi";
import type { UserProfile, TommyMemoria } from "@/models/UserProfile";

export const UserService = {
  getProfile: (): Promise<UserProfile> =>
    api.get<UserProfile>("/user-profile"),

  getMemoria: (): Promise<TommyMemoria[]> =>
    api.get<TommyMemoria[]>("/tommy-memoria"),

  addMemoria: (categoria: string, chave: string, valor: string): Promise<TommyMemoria> =>
    api.post<TommyMemoria>("/tommy-memoria", { categoria, chave, valor }),
};
