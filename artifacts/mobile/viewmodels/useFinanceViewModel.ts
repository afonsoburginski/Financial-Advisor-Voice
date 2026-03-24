import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FinanceService } from "@/services/FinanceService";
import type { CreateDecisaoInput } from "@/models/Decisao";
import { FINANCE, calcularImpactoSandero } from "@/constants/finance";

const QUERY_KEY = ["decisoes"] as const;

export function useFinanceViewModel() {
  const queryClient = useQueryClient();

  const {
    data: decisoes = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: FinanceService.listDecisoes,
    staleTime: 30_000,
    retry: 2,
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateDecisaoInput) =>
      FinanceService.createDecisao(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => FinanceService.deleteDecisao(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const prev = queryClient.getQueryData(QUERY_KEY);
      queryClient.setQueryData(QUERY_KEY, (old: typeof decisoes) =>
        old.filter((d) => d.id !== id)
      );
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(QUERY_KEY, ctx.prev);
    },
  });

  // Computed values
  const totalExtras = decisoes.reduce((sum, d) => sum + Number(d.valor), 0);
  const sobraMensal = FINANCE.SOBRA_MENSAL - totalExtras;
  const progressSandero = Math.min(
    sobraMensal / FINANCE.META_SANDERO.valor,
    1
  );
  const mesesParaSandero =
    sobraMensal > 0
      ? Math.ceil(FINANCE.META_SANDERO.valor / sobraMensal)
      : 0;

  return {
    // State
    decisoes,
    isLoading,
    isError,
    // Computed
    totalExtras,
    sobraMensal,
    progressSandero,
    mesesParaSandero,
    // Actions
    createDecisao: createMutation.mutate,
    isCreating: createMutation.isPending,
    deleteDecisao: deleteMutation.mutate,
    refetch,
    // Helpers
    calcularImpactoSandero,
  };
}
