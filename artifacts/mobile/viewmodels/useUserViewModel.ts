import { useQuery } from "@tanstack/react-query";
import { UserService } from "@/services/UserService";

export function useUserViewModel() {
  const {
    data: profile,
    isLoading: profileLoading,
  } = useQuery({
    queryKey: ["user-profile"],
    queryFn: UserService.getProfile,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const {
    data: memoria = [],
  } = useQuery({
    queryKey: ["tommy-memoria"],
    queryFn: UserService.getMemoria,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const nome = profile?.nome ?? "Afonso";

  const greeting = (): string => {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return `Bom dia, ${nome}`;
    if (h >= 12 && h < 18) return `Boa tarde, ${nome}`;
    return `Boa noite, ${nome}`;
  };

  return {
    profile,
    memoria,
    profileLoading,
    nome,
    greeting,
  };
}
