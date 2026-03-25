import { USER_PROFILE } from "@/constants/userProfile";
import type { TommyMemoria, UserProfile } from "@/models/UserProfile";

const staticProfile: UserProfile = {
  id: 1,
  nome: USER_PROFILE.nomeTratamento,
  cidade: "Vitória",
  estado: "Espírito Santo",
  profissao: USER_PROFILE.profissao,
  meta_nome: null,
  meta_valor: null,
  notas: null,
  atualizado_em: new Date().toISOString(),
};

export function useUserController() {
  const nome = USER_PROFILE.nomeTratamento;

  const greeting = (): string => {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return `Bom dia, ${nome}`;
    if (h >= 12 && h < 18) return `Boa tarde, ${nome}`;
    return `Boa noite, ${nome}`;
  };

  return {
    profile: staticProfile,
    memoria: [] as TommyMemoria[],
    profileLoading: false,
    nome,
    greeting,
  };
}
