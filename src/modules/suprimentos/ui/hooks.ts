import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  requisicoesRepository,
  type CriarRequisicaoInput,
  type AdicionarItemInput,
  type GerarCotacaoInput,
  type ComprarDiretoInput,
  type FiltroRequisicoes,
} from '@/modules/suprimentos/data/requisicoes.repository';

// Query keys hierárquicas, sempre prefixadas por companyId (docs/01 §4) —
// é o que torna o queryClient.clear() do TenantProvider uma rede de
// segurança em vez da única defesa contra vazamento de dado entre empresas.
export const suprimentosKeys = {
  all: (companyId: string) => ['suprimentos', companyId] as const,
  requisicoes: (companyId: string) => [...suprimentosKeys.all(companyId), 'requisicoes'] as const,
  requisicoesFiltro: (companyId: string, filtro: FiltroRequisicoes | null) =>
    [...suprimentosKeys.requisicoes(companyId), filtro ?? 'sem-busca'] as const,
  requisicao: (companyId: string, requisicaoId: string) =>
    [...suprimentosKeys.requisicoes(companyId), requisicaoId] as const,
  insumos: (companyId: string, termo: string) =>
    [...suprimentosKeys.all(companyId), 'insumos', termo] as const,
};

/**
 * `filtro === null` significa "o usuário ainda não clicou em Buscar" — a query
 * fica desabilitada e a tela não consulta o banco ao abrir (docs/05 §4).
 */
export function useRequisicoes(companyId: string, filtro: FiltroRequisicoes | null) {
  return useQuery({
    queryKey: suprimentosKeys.requisicoesFiltro(companyId, filtro),
    queryFn: () => requisicoesRepository.listar(companyId, filtro ?? {}),
    enabled: Boolean(companyId) && filtro !== null,
  });
}

/** Autocomplete da descrição do insumo. O componente já entrega o termo com debounce. */
export function useBuscaInsumos(companyId: string, termo: string) {
  return useQuery({
    queryKey: suprimentosKeys.insumos(companyId, termo),
    queryFn: () => requisicoesRepository.buscarInsumos(companyId, termo),
    enabled: Boolean(companyId) && termo.trim().length >= 2,
    staleTime: 60_000,
  });
}

export function useObrasDaEmpresa(companyId: string) {
  return useQuery({
    queryKey: [...suprimentosKeys.all(companyId), 'obras'],
    queryFn: () => requisicoesRepository.listarObras(companyId),
    enabled: Boolean(companyId),
  });
}

/** Árvore de apropriação da obra. Só busca quando há obra escolhida. */
export function useArvoreOrcamento(companyId: string, obraId: string) {
  return useQuery({
    queryKey: [...suprimentosKeys.all(companyId), 'arvore-orcamento', obraId],
    queryFn: () => requisicoesRepository.listarArvoreOrcamento(companyId, obraId),
    enabled: Boolean(companyId && obraId),
  });
}

export function useSolicitantes(companyId: string) {
  return useQuery({
    queryKey: [...suprimentosKeys.all(companyId), 'solicitantes'],
    queryFn: () => requisicoesRepository.listarSolicitantes(companyId),
    enabled: Boolean(companyId),
  });
}

export function useRequisicao(companyId: string, requisicaoId: string) {
  return useQuery({
    queryKey: suprimentosKeys.requisicao(companyId, requisicaoId),
    queryFn: () => requisicoesRepository.buscar(requisicaoId),
    enabled: Boolean(companyId && requisicaoId),
  });
}

export function useCriarRequisicao(companyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CriarRequisicaoInput) => requisicoesRepository.criar(input),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: suprimentosKeys.requisicoes(companyId) });
    },
  });
}

export function useAtualizarRequisicao(companyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      requisicaoId,
      patch,
    }: {
      requisicaoId: string;
      patch: Parameters<typeof requisicoesRepository.atualizar>[1];
    }) => requisicoesRepository.atualizar(requisicaoId, patch),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: suprimentosKeys.requisicoes(companyId) });
    },
  });
}

export function useAdicionarItemRequisicao(companyId: string, requisicaoId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AdicionarItemInput) => requisicoesRepository.adicionarItem(input),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: suprimentosKeys.requisicao(companyId, requisicaoId) });
      queryClient.invalidateQueries({ queryKey: suprimentosKeys.requisicoes(companyId) });
    },
  });
}

export interface SalvarEdicaoInput {
  requisicaoId: string;
  cabecalho: Parameters<typeof requisicoesRepository.atualizar>[1];
  itensEditados: {
    id: string;
    descricao: string;
    quantidade: number;
    unidade: string;
    observacao: string | null;
  }[];
  itensNovos: {
    descricao: string;
    quantidade: number;
    unidade: string;
    orcamentoItemId?: string | null;
    insumoCanonicoId?: string | null;
  }[];
  itensRemovidos: { id: string; motivo: string }[];
  /** Itens já existentes que devem transicionar, e para onde. */
  transicao: { itemIds: string[]; status: string } | null;
}

/**
 * Salva a edição inteira numa ordem que respeita a máquina de estado:
 * cabeçalho → edições → remoções → inclusões → transição de situação.
 *
 * Não é transacional (não há RPC pra isso ainda). Se um passo falhar, os
 * anteriores permanecem — por isso a transição vem por último: é o passo que o
 * banco pode recusar, e é o único que não deixa o resto inconsistente.
 */
export function useSalvarEdicaoRequisicao(companyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SalvarEdicaoInput) => {
      await requisicoesRepository.atualizar(input.requisicaoId, input.cabecalho);

      for (const item of input.itensEditados) {
        await requisicoesRepository.atualizarItem(item.id, {
          descricao: item.descricao,
          quantidade: item.quantidade,
          unidade: item.unidade,
          observacao: item.observacao,
        });
      }

      for (const item of input.itensRemovidos) {
        await requisicoesRepository.cancelarItem(item.id, item.motivo);
      }

      for (const item of input.itensNovos) {
        await requisicoesRepository.adicionarItem({
          companyId,
          requisicaoId: input.requisicaoId,
          descricao: item.descricao,
          quantidade: item.quantidade,
          unidade: item.unidade,
          orcamentoItemId: item.orcamentoItemId ?? null,
          insumoCanonicoId: item.insumoCanonicoId ?? null,
        });
      }

      if (input.transicao && input.transicao.itemIds.length > 0) {
        await requisicoesRepository.alterarStatusItens(input.transicao.itemIds, input.transicao.status);
      }
    },
    onSettled: (_data, _err, input) => {
      queryClient.invalidateQueries({ queryKey: suprimentosKeys.requisicoes(companyId) });
      queryClient.invalidateQueries({
        queryKey: suprimentosKeys.requisicao(companyId, input?.requisicaoId ?? ''),
      });
    },
  });
}

export function useCancelarItemRequisicao(companyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, motivo }: { itemId: string; motivo: string }) =>
      requisicoesRepository.cancelarItem(itemId, motivo),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: suprimentosKeys.requisicoes(companyId) });
    },
  });
}

export function useGerarCotacao(companyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: GerarCotacaoInput) => requisicoesRepository.gerarCotacao(input),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: suprimentosKeys.requisicoes(companyId) });
    },
  });
}

export function useComprarDireto(companyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ComprarDiretoInput) => requisicoesRepository.comprarDireto(input),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: suprimentosKeys.requisicoes(companyId) });
    },
  });
}
