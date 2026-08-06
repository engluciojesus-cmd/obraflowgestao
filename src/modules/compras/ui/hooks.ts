import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cotacoesRepository } from '@/modules/compras/data/cotacoes.repository';
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

export function useSalvarPreco(companyId: string, cotacaoId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, any, any>({
    mutationFn: async (input: any) => cotacoesRepository.salvarPreco(input),
    onMutate: async (input: any) => {
      await queryClient.cancelQueries({ queryKey: comprasKeys.mapa(companyId, cotacaoId) });
      const previous = queryClient.getQueryData<any>(comprasKeys.mapa(companyId, cotacaoId));
      queryClient.setQueryData(comprasKeys.mapa(companyId, cotacaoId), (old: any) => old);
      return { previous };
    },
    onError: (_err: unknown, _variables: any, context: any) => {
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

export function useAdicionarFornecedor(companyId: string, cotacaoId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { fornecedorId: string }>({
    mutationFn: async ({ fornecedorId }: { fornecedorId: string }) =>
      cotacoesRepository.adicionarFornecedor(cotacaoId, fornecedorId),
    onMutate: async ({ fornecedorId }: { fornecedorId: string }) => {
      await queryClient.cancelQueries({ queryKey: comprasKeys.mapa(companyId, cotacaoId) });
      const previous = queryClient.getQueryData<any>(comprasKeys.mapa(companyId, cotacaoId));
      return { previous };
    },
    onError: (_err: unknown, _vars: any, context: any) => {
      queryClient.setQueryData(comprasKeys.mapa(companyId, cotacaoId), context?.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: comprasKeys.mapa(companyId, cotacaoId) });
      queryClient.invalidateQueries({ queryKey: [...comprasKeys.all(companyId), 'fornecedores'] });
    },
  });
}

export function useGerarOrdemCompra(companyId: string, cotacaoId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { grupos?: any[] }>({
    mutationFn: async ({ grupos }: { grupos?: any[] }) => {
      // if grupos provided, create orders for each group; otherwise, compute from current mapa
      if (!grupos) {
        const mapa = queryClient.getQueryData<any>(comprasKeys.mapa(companyId, cotacaoId));
        grupos = [];
        // simple grouping: take chosen prices
        const precos = mapa?.precos || [];
        const fornecedores = mapa?.fornecedores || [];
        for (const f of fornecedores) {
          const linhas = precos.filter((p: any) => p.cotacao_fornecedor_id === f.id && p.escolhido).map((p: any) => ({ item: p.cotacao_item_id, preco: p }));
          if (linhas.length > 0) grupos.push({ fornecedor: f, linhas, total: linhas.reduce((s: number, l: any) => s + Number(l.preco.valor_unitario) * 1, 0) + (Number(f.frete) || 0) });
        }
      }
      for (const g of grupos) {
        await cotacoesRepository.gerarOrdemCompra({ company_id: companyId, cotacao_id: cotacaoId, fornecedor_id: g.fornecedor.id, valor: g.total, status: 'GERADA' });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: comprasKeys.mapa(companyId, cotacaoId) });
    },
  });
}
