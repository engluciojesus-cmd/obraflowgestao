import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  cotacoesRepository,
  type CondicoesFornecedorInput,
  type NovoFornecedor,
} from '@/modules/compras/data/cotacoes.repository';
import { gerarRanking } from '@/modules/compras/application/cotacoes.service';

export const comprasKeys = {
  all: (companyId: string) => ['compras', companyId] as const,
  cotacoes: (companyId: string) => [...comprasKeys.all(companyId), 'cotacoes'] as const,
  cotacao: (companyId: string, cotacaoId: string) => [...comprasKeys.cotacoes(companyId), cotacaoId] as const,
  mapa: (companyId: string, cotacaoId: string) => [...comprasKeys.cotacao(companyId, cotacaoId), 'mapa'] as const,
};

export function useCotacaoMapa(companyId: string, cotacaoId: string) {
  return useQuery<any>({
    queryKey: comprasKeys.mapa(companyId, cotacaoId),
    queryFn: async () => cotacoesRepository.buscarMapa(cotacaoId),
    enabled: Boolean(companyId && cotacaoId),
  });
}

export interface SalvarPrecoVars {
  cotacaoFornecedorId: string;
  cotacaoItemId: string;
  patch: {
    valor_unitario?: number;
    marca?: string | null;
    escolhido?: boolean;
    disponivel?: boolean;
    prazo_dias?: number | null;
  };
}

export function useSalvarPreco(companyId: string, cotacaoId: string) {
  const queryClient = useQueryClient();
  return useMutation<any, Error, SalvarPrecoVars, any>({
    mutationFn: async (vars: SalvarPrecoVars) =>
      cotacoesRepository.salvarPreco({
        cotacaoId,
        companyId,
        cotacaoFornecedorId: vars.cotacaoFornecedorId,
        cotacaoItemId: vars.cotacaoItemId,
        patch: vars.patch,
      }),
    onMutate: async (vars: SalvarPrecoVars) => {
      await queryClient.cancelQueries({ queryKey: comprasKeys.mapa(companyId, cotacaoId) });
      const previous = queryClient.getQueryData<any>(comprasKeys.mapa(companyId, cotacaoId));
      if (previous) {
        const next = JSON.parse(JSON.stringify(previous));
        const precos: any[] = next.precos || [];
        const idx = precos.findIndex(
          (p) =>
            p.cotacao_fornecedor_id === vars.cotacaoFornecedorId &&
            p.cotacao_item_id === vars.cotacaoItemId,
        );
        // ⭐ O primeiro valor digitado numa célula ainda não tem linha no banco.
        // Sem este ramo de inserção o número sumia assim que o input perdia o foco.
        if (idx >= 0) precos[idx] = { ...precos[idx], ...vars.patch };
        else
          precos.push({
            id: `otimista-${vars.cotacaoFornecedorId}-${vars.cotacaoItemId}`,
            cotacao_id: cotacaoId,
            company_id: companyId,
            cotacao_fornecedor_id: vars.cotacaoFornecedorId,
            cotacao_item_id: vars.cotacaoItemId,
            valor_unitario: 0,
            marca: null,
            escolhido: false,
            ...vars.patch,
          });
        next.precos = precos;
        queryClient.setQueryData(comprasKeys.mapa(companyId, cotacaoId), next);
      }
      return { previous };
    },
    onError: (_err: unknown, _variables: SalvarPrecoVars, context: any) => {
      queryClient.setQueryData(comprasKeys.mapa(companyId, cotacaoId), context?.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: comprasKeys.mapa(companyId, cotacaoId) });
    },
  });
}

export function useRanking(companyId: string, cotacaoId: string, taxaOportunidadeMensal: number) {
  return useQuery<any[]>({
    queryKey: [...comprasKeys.mapa(companyId, cotacaoId), 'ranking', taxaOportunidadeMensal],
    queryFn: async () => gerarRanking(cotacaoId, taxaOportunidadeMensal),
    enabled: Boolean(companyId && cotacaoId),
  });
}

export function useFornecedoresDisponiveis(companyId: string) {
  return useQuery({
    queryKey: [...comprasKeys.all(companyId), 'fornecedores'],
    queryFn: async () => cotacoesRepository.listarFornecedores(companyId),
    enabled: Boolean(companyId),
  });
}

/** Busca digitada no seletor da cotação. O componente já aplica o debounce. */
export function useBuscaFornecedores(companyId: string, termo: string) {
  return useQuery({
    queryKey: [...comprasKeys.all(companyId), 'fornecedores', 'busca', termo],
    queryFn: async () => cotacoesRepository.buscarFornecedores(companyId, termo),
    enabled: Boolean(companyId),
    staleTime: 30_000,
  });
}

/** Lista de condições de pagamento cadastradas no módulo Segurança. */
export function useCondicoesPagamento(companyId: string) {
  return useQuery({
    queryKey: [...comprasKeys.all(companyId), 'condicoes-pagamento'],
    queryFn: async () => cotacoesRepository.listarCondicoesPagamento(companyId),
    enabled: Boolean(companyId),
    staleTime: 5 * 60_000,
  });
}

export function useItensAbertosDaObra(obraId: string) {
  return useQuery({
    queryKey: ['cotacao', obraId, 'itens_abertos'],
    queryFn: async () => cotacoesRepository.listarItensAbertosDaObra(obraId),
    enabled: Boolean(obraId),
  });
}

export function useAdicionarFornecedor(companyId: string, cotacaoId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { fornecedorId: string }>({
    mutationFn: async ({ fornecedorId }: { fornecedorId: string }) =>
      cotacoesRepository.adicionarFornecedor(cotacaoId, companyId, fornecedorId),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: comprasKeys.mapa(companyId, cotacaoId) });
      queryClient.invalidateQueries({ queryKey: [...comprasKeys.all(companyId), 'fornecedores'] });
    },
  });
}

/** "+" do seletor: cadastro rápido, sem passar pelo cadastro completo. */
export function useCriarFornecedorAvulso(companyId: string, cotacaoId: string) {
  const queryClient = useQueryClient();
  return useMutation<{ id: string; nome: string }, Error, NovoFornecedor>({
    mutationFn: async (dados: NovoFornecedor) =>
      cotacoesRepository.criarFornecedorAvulso(cotacaoId, companyId, dados),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: comprasKeys.mapa(companyId, cotacaoId) });
      queryClient.invalidateQueries({ queryKey: [...comprasKeys.all(companyId), 'fornecedores'] });
    },
  });
}

export function useRemoverFornecedor(companyId: string, cotacaoId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { cotacaoFornecedorId: string }>({
    mutationFn: async ({ cotacaoFornecedorId }: { cotacaoFornecedorId: string }) =>
      cotacoesRepository.removerFornecedor(cotacaoFornecedorId),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: comprasKeys.mapa(companyId, cotacaoId) });
    },
  });
}

export function useAtualizarCondicoesFornecedor(companyId: string, cotacaoId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { cotacaoFornecedorId: string; patch: CondicoesFornecedorInput }, any>({
    mutationFn: async ({ cotacaoFornecedorId, patch }) =>
      cotacoesRepository.atualizarCondicoesFornecedor(cotacaoFornecedorId, patch),
    onMutate: async ({ cotacaoFornecedorId, patch }) => {
      await queryClient.cancelQueries({ queryKey: comprasKeys.mapa(companyId, cotacaoId) });
      const previous = queryClient.getQueryData<any>(comprasKeys.mapa(companyId, cotacaoId));
      if (previous) {
        const next = JSON.parse(JSON.stringify(previous));
        next.fornecedores = (next.fornecedores || []).map((f: any) =>
          f.id === cotacaoFornecedorId ? { ...f, ...patch } : f,
        );
        queryClient.setQueryData(comprasKeys.mapa(companyId, cotacaoId), next);
      }
      return { previous };
    },
    onError: (_err, _vars, context: any) => {
      queryClient.setQueryData(comprasKeys.mapa(companyId, cotacaoId), context?.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: comprasKeys.mapa(companyId, cotacaoId) });
    },
  });
}

export function useRemoverItemCotacao(companyId: string, cotacaoId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { cotacaoItemId: string }>({
    mutationFn: async ({ cotacaoItemId }: { cotacaoItemId: string }) =>
      cotacoesRepository.removerItemCotacao(cotacaoItemId),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: comprasKeys.mapa(companyId, cotacaoId) });
    },
  });
}

export function useAdicionarItensCotacao(companyId: string, cotacaoId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { itemIds: string[] }>({
    mutationFn: async ({ itemIds }: { itemIds: string[] }) =>
      cotacoesRepository.adicionarItensCotacao(cotacaoId, itemIds),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: comprasKeys.mapa(companyId, cotacaoId) });
    },
  });
}

export function useGerarOrdensDaCotacao(companyId: string, cotacaoId: string) {
  const queryClient = useQueryClient();
  return useMutation<string[], Error, void>({
    mutationFn: async () => cotacoesRepository.gerarOrdensDaCotacao(cotacaoId),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: comprasKeys.mapa(companyId, cotacaoId) });
    },
  });
}
