import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AgendaService } from "@/services/AgendaService";
import type {
  AgendaItem,
  AgendaPrioridade,
  CreateAgendaItemInput,
  UpdateAgendaItemInput,
} from "@/models/AgendaItem";

const QUERY_KEY = ["agenda"] as const;

function sortByPriority(items: AgendaItem[]): AgendaItem[] {
  const order: Record<AgendaPrioridade, number> = { alta: 0, media: 1, baixa: 2 };
  return [...items].sort((a, b) => {
    if (a.concluido !== b.concluido) return a.concluido ? 1 : -1;
    const pa = order[a.prioridade as AgendaPrioridade] ?? 1;
    const pb = order[b.prioridade as AgendaPrioridade] ?? 1;
    return pa - pb;
  });
}

export function useAgendaController() {
  const queryClient = useQueryClient();

  const {
    data: rawItems = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: AgendaService.listItems,
    staleTime: 15_000,
    retry: 2,
  });

  const items = sortByPriority(rawItems);
  const pending = items.filter((i) => !i.concluido);
  const done = items.filter((i) => i.concluido);

  const createMutation = useMutation({
    mutationFn: (input: CreateAgendaItemInput) =>
      AgendaService.createItem(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateAgendaItemInput }) =>
      AgendaService.updateItem(id, input),
    onMutate: async ({ id, input }) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const prev = queryClient.getQueryData(QUERY_KEY);
      queryClient.setQueryData(QUERY_KEY, (old: AgendaItem[]) =>
        old.map((item) => (item.id === id ? { ...item, ...input } : item))
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(QUERY_KEY, ctx.prev);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => AgendaService.deleteItem(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const prev = queryClient.getQueryData(QUERY_KEY);
      queryClient.setQueryData(QUERY_KEY, (old: AgendaItem[]) =>
        old.filter((i) => i.id !== id)
      );
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(QUERY_KEY, ctx.prev);
    },
  });

  const toggleConcluido = (item: AgendaItem) => {
    updateMutation.mutate({
      id: item.id,
      input: { concluido: !item.concluido },
    });
  };

  return {
    items,
    pending,
    done,
    isLoading,
    isError,
    refetch,
    createItem: createMutation.mutate,
    isCreating: createMutation.isPending,
    updateItem: updateMutation.mutate,
    deleteItem: deleteMutation.mutate,
    toggleConcluido,
  };
}
