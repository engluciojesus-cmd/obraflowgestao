import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  requisicoesRepository,
  type CriarRequisicaoInput,
  type AdicionarItemInput,
  type GerarCotacaoInput,
  type ComprarDiretoInput,
} from '@/modules/suprimentos/data/requisicoes.repository';

// Query keys hierárquicas, sempre prefixadas por companyId (docs/01 §4) —
// é o que torna o queryClient.clear() do TenantProvider uma rede de
// segurança em vez da única defesa contra vazamento de dado entre empresas.
export const suprimentosKeys = {
  all: (companyId: string) => ['suprimentos', companyId] as const,
  requisicoes: (companyId: string) => [...suprimentosKeys.all(companyId), 'requisicoes'] as const,
  requisicoesFiltro: (companyId: string, status?: string[]) =>
    [...suprimentosKeys.requisicoes(companyId), status ?? []] as const,
  requisicao: (companyId: string, requisicaoId: string) =>
    [...suprimentosKeys.requisicoes(companyId), requisicaoId] as const,
};

export function useRequisicoes(companyId: string, status?: string[]) {
  return useQuery({
    queryKey: suprimentosKeys.requisicoesFiltro(companyId, status),
    queryFn: () => requisicoesRepository.listar(companyId, status),
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
