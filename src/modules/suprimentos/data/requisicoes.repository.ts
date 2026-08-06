// Único arquivo do módulo autorizado a importar `supabase` (docs/01 §1).

import { supabase } from '@/integrations/supabase/client';
import { mapSupabaseError } from '@/core/errors/mapSupabaseError';

const SELECT_REQUISICAO =
  '*, obra:obras(nome), solicitante:users(full_name, username), itens:requisicao_itens(*)';

export interface CriarRequisicaoInput {
  companyId: string;
  obraId?: string | null;
  solicitanteId?: string | null;
  descricao?: string | null;
  dataNecessidade?: string | null;
  observacao?: string | null;
  itens: {
    descricao: string;
    quantidade: number;
    unidade: string;
    orcamentoItemId?: string | null;
    observacao?: string | null;
  }[];
}

export interface AdicionarItemInput {
  companyId: string;
  requisicaoId: string;
  descricao: string;
  quantidade: number;
  unidade: string;
  orcamentoItemId?: string | null;
  observacao?: string | null;
  ordem?: number;
}

export interface GerarCotacaoInput {
  companyId: string;
  itemIds: string[];
  descricao?: string;
  dataLimite?: string;
}

export interface ComprarDiretoInput {
  companyId: string;
  itemIds: string[];
  fornecedorId: string;
  /** { "<requisicao_item_id>": valorUnitario } */
  valores: Record<string, number>;
  formaPagamento?: string;
  jaRecebido?: boolean;
  jaPago?: boolean;
  documentoNumero?: string;
  documentoPath?: string;
  vencimento?: string;
}

export const requisicoesRepository = {
  async listar(companyId: string, status?: string[]) {
    let query = supabase
      .from('requisicoes')
      .select(SELECT_REQUISICAO)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (status && status.length > 0) query = query.in('status', status);

    const { data, error } = await query;
    if (error) throw mapSupabaseError(error);
    return data ?? [];
  },

  async buscar(requisicaoId: string) {
    const { data, error } = await supabase
      .from('requisicoes')
      .select(SELECT_REQUISICAO)
      .eq('id', requisicaoId)
      .single();
    if (error) throw mapSupabaseError(error);
    return data;
  },

  /**
   * Cria o processo, numera a requisição e insere os itens.
   * A migration ainda não tem um RPC dedicado pra isso — sem `sequencias`
   * competindo com outra escrita simultânea o risco é baixo, mas isto não é
   * atômico. Se virar ponto de contenção, vira RPC (docs/01 §5).
   */
  async criar(input: CriarRequisicaoInput) {
    const { data: processoId, error: erroProcesso } = await supabase.rpc('criar_processo', {
      p_company: input.companyId,
      p_obra: input.obraId ?? undefined,
      p_origem: 'requisicao',
    });
    if (erroProcesso) throw mapSupabaseError(erroProcesso);

    const { data: numero, error: erroNumero } = await supabase.rpc('proximo_numero', {
      p_company: input.companyId,
      p_entidade: 'requisicao',
    });
    if (erroNumero) throw mapSupabaseError(erroNumero);

    const { data: requisicao, error: erroRequisicao } = await supabase
      .from('requisicoes')
      .insert({
        company_id: input.companyId,
        processo_id: processoId,
        numero: String(numero).padStart(6, '0'),
        obra_id: input.obraId ?? null,
        solicitante_id: input.solicitanteId ?? null,
        descricao: input.descricao ?? null,
        data_necessidade: input.dataNecessidade ?? null,
        observacao: input.observacao ?? null,
        status: 'ABERTA',
      })
      .select()
      .single();
    if (erroRequisicao) throw mapSupabaseError(erroRequisicao);

    if (input.itens.length > 0) {
      const { error: erroItens } = await supabase.from('requisicao_itens').insert(
        input.itens.map((item, ordem) => ({
          company_id: input.companyId,
          requisicao_id: requisicao.id,
          descricao: item.descricao,
          quantidade: item.quantidade,
          unidade: item.unidade,
          orcamento_item_id: item.orcamentoItemId ?? null,
          observacao: item.observacao ?? null,
          ordem,
          status: 'ABERTA',
        })),
      );
      if (erroItens) throw mapSupabaseError(erroItens);
    }

    return requisicao;
  },

  async adicionarItem(input: AdicionarItemInput) {
    const { data, error } = await supabase
      .from('requisicao_itens')
      .insert({
        company_id: input.companyId,
        requisicao_id: input.requisicaoId,
        descricao: input.descricao,
        quantidade: input.quantidade,
        unidade: input.unidade,
        orcamento_item_id: input.orcamentoItemId ?? null,
        observacao: input.observacao ?? null,
        ordem: input.ordem ?? 0,
        status: 'ABERTA',
      })
      .select()
      .single();
    if (error) throw mapSupabaseError(error);
    return data;
  },

  async cancelarItem(itemId: string, motivo: string) {
    const { error } = await supabase.rpc('cancelar_item_requisicao', {
      p_item_id: itemId,
      p_motivo: motivo,
    });
    if (error) throw mapSupabaseError(error);
  },

  /** rpc gerar_cotacao_de_itens — retorna o id da cotação criada. */
  async gerarCotacao(input: GerarCotacaoInput): Promise<string> {
    const { data, error } = await supabase.rpc('gerar_cotacao_de_itens', {
      p_company: input.companyId,
      p_item_ids: input.itemIds,
      p_descricao: input.descricao,
      p_data_limite: input.dataLimite,
    });
    if (error) throw mapSupabaseError(error);
    return data;
  },

  /** rpc comprar_direto — "Já comprei": OC + recebimento + lançamento numa tacada. */
  async comprarDireto(input: ComprarDiretoInput): Promise<string> {
    const { data, error } = await supabase.rpc('comprar_direto', {
      p_company: input.companyId,
      p_item_ids: input.itemIds,
      p_fornecedor_id: input.fornecedorId,
      p_valores: input.valores,
      p_forma_pagamento: input.formaPagamento,
      p_ja_recebido: input.jaRecebido,
      p_ja_pago: input.jaPago,
      p_documento_numero: input.documentoNumero,
      p_documento_path: input.documentoPath,
      p_vencimento: input.vencimento,
    });
    if (error) throw mapSupabaseError(error);
    return data;
  },
};

export default requisicoesRepository;
