// Único arquivo do módulo autorizado a importar `supabase` (docs/01 §1).

import { supabase } from '@/integrations/supabase/client';
import { mapSupabaseError } from '@/core/errors/mapSupabaseError';
import { itensDaSituacaoRequisicao } from '@/modules/suprimentos/domain/rules';

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
    insumoCanonicoId?: string | null;
    observacao?: string | null;
  }[];
}

export interface ArvoreOrcamentoItem {
  id: string;
  descricao: string;
  unidade: string;
  quantidade: number;
}

export interface ArvoreOrcamentoServico {
  id: string;
  faseId: string | null;
  nome: string;
  itens: ArvoreOrcamentoItem[];
}

export interface ArvoreOrcamento {
  id: string;
  nome: string;
  usaFases: boolean;
  fases: { id: string; nome: string }[];
  servicos: ArvoreOrcamentoServico[];
}

export interface AdicionarItemInput {
  companyId: string;
  requisicaoId: string;
  descricao: string;
  quantidade: number;
  unidade: string;
  orcamentoItemId?: string | null;
  insumoCanonicoId?: string | null;
  observacao?: string | null;
  ordem?: number;
}

/**
 * Tudo que a barra lateral de filtros manda para o banco. Antes só `status`
 * ia para a query e o resto era peneirado no navegador — o que só funcionava
 * porque a tela carregava a tabela inteira ao abrir. Agora que a busca é sob
 * demanda, o banco filtra tudo e devolve só o que o usuário pediu.
 */
export interface FiltroRequisicoes {
  /** Uma situação, ou '' para todas (docs/05 §4 — o filtro virou select). */
  situacao?: string;
  numero?: string;
  obraId?: string;
  solicitanteId?: string;
  dataSolicDe?: string;
  dataSolicAte?: string;
  dataNecDe?: string;
  dataNecAte?: string;
}

export interface InsumoEncontrado {
  id: string;
  codigo: string | null;
  descricao: string;
  unidade: string;
  categoria: string | null;
  /** Preenchido quando o casamento veio de um apelido, não do nome canônico. */
  via?: string | null;
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
  /**
   * Sobe o anexo da nota para o bucket "documentos-compra". O bucket ainda
   * não existe neste ambiente (fica pra quando o Prompt F provisionar) —
   * se o upload falhar, retorna null e o fluxo segue sem anexo. Anexo nunca
   * pode bloquear o fluxo operacional (mesmo princípio do docs/05 §4.5).
   */
  async uploadAnexo(companyId: string, file: File): Promise<string | null> {
    const path = `${companyId}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from('documentos-compra').upload(path, file);
    if (error) return null;
    return path;
  },

  /** Alimenta os selects do filtro — não faz parte do fluxo, só da tela. */
  async listarObras(companyId: string) {
    const { data, error } = await supabase
      .from('obras')
      .select('id, nome')
      .eq('company_id', companyId)
      .order('nome');
    if (error) throw mapSupabaseError(error);
    return data ?? [];
  },

  async listarSolicitantes(companyId: string) {
    const { data, error } = await supabase
      .from('company_members')
      .select('user:users(id, full_name, username)')
      .eq('company_id', companyId);
    if (error) throw mapSupabaseError(error);
    return (data ?? [])
      .map((row: any) => row.user)
      .filter(Boolean)
      .map((u: any) => ({ id: u.id, nome: u.full_name || u.username || '—' }))
      .sort((a: { nome: string }, b: { nome: string }) => a.nome.localeCompare(b.nome));
  },

  /**
   * Árvore de apropriação da obra: Orçamento → Fase (opcional) → Serviço → Item.
   * A migration 20260804010000 é explícita: "Compras vinculam por ITEM,
   * medições por SERVIÇO" — por isso o que a requisição grava é
   * `orcamento_itens.id` em `requisicao_itens.orcamento_item_id`.
   */
  async listarArvoreOrcamento(companyId: string, obraId: string): Promise<ArvoreOrcamento[]> {
    const { data: orcamentos, error } = await supabase
      .from('orcamentos')
      .select('id, nome, usa_fases')
      .eq('company_id', companyId)
      .eq('obra_id', obraId)
      .order('data', { ascending: false });
    if (error) throw mapSupabaseError(error);
    if (!orcamentos || orcamentos.length === 0) return [];

    const ids = orcamentos.map((o) => o.id);
    const [fasesRes, servicosRes] = await Promise.all([
      supabase.from('orcamento_fases').select('id, orcamento_id, nome, ordem').in('orcamento_id', ids).order('ordem'),
      supabase
        .from('orcamento_servicos')
        .select('id, orcamento_id, fase_id, nome, ordem, itens:orcamento_itens(id, descricao, unidade, quantidade, ordem)')
        .in('orcamento_id', ids)
        .order('ordem'),
    ]);
    if (fasesRes.error) throw mapSupabaseError(fasesRes.error);
    if (servicosRes.error) throw mapSupabaseError(servicosRes.error);

    return orcamentos.map((orc) => ({
      id: orc.id,
      nome: orc.nome,
      usaFases: Boolean(orc.usa_fases),
      fases: (fasesRes.data ?? [])
        .filter((f: any) => f.orcamento_id === orc.id)
        .map((f: any) => ({ id: f.id, nome: f.nome })),
      servicos: (servicosRes.data ?? [])
        .filter((s: any) => s.orcamento_id === orc.id)
        .map((s: any) => ({
          id: s.id,
          faseId: s.fase_id ?? null,
          nome: s.nome,
          itens: [...(s.itens ?? [])]
            .sort((a: any, b: any) => a.ordem - b.ordem)
            .map((i: any) => ({
              id: i.id,
              descricao: i.descricao,
              unidade: i.unidade || 'un',
              quantidade: Number(i.quantidade) || 0,
            })),
        })),
    }));
  },

  /**
   * Busca sob demanda: só roda quando a tela manda um filtro (o usuário
   * clicou em "Buscar"). Abrir a tela não consulta mais nada.
   *
   * A situação é procurada no cabeçalho E nos itens — ver
   * `itensDaSituacaoRequisicao` em domain/rules.ts para o porquê.
   */
  async listar(companyId: string, filtro: FiltroRequisicoes = {}) {
    let query = supabase
      .from('requisicoes')
      .select(SELECT_REQUISICAO)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    const situacao = filtro.situacao?.trim();
    if (situacao) {
      const statusItem = itensDaSituacaoRequisicao(situacao);
      const ids = new Set<string>();

      if (statusItem.length > 0) {
        const { data: itens, error: erroItens } = await supabase
          .from('requisicao_itens')
          .select('requisicao_id')
          .eq('company_id', companyId)
          .in('status', statusItem);
        if (erroItens) throw mapSupabaseError(erroItens);
        for (const it of itens ?? []) if (it.requisicao_id) ids.add(it.requisicao_id);
      }

      // `or` do PostgREST: cabeçalho bate OU o id veio da varredura de itens.
      query =
        ids.size > 0
          ? query.or(`status.eq.${situacao},id.in.(${[...ids].join(',')})`)
          : query.eq('status', situacao);
    }

    const numero = filtro.numero?.trim();
    if (numero) query = query.ilike('numero', `%${numero}%`);
    if (filtro.obraId) query = query.eq('obra_id', filtro.obraId);
    if (filtro.solicitanteId) query = query.eq('solicitante_id', filtro.solicitanteId);

    // data_solicitacao é timestamptz: o "até" precisa cobrir o dia inteiro,
    // senão uma requisição das 14h fica de fora do próprio dia filtrado.
    if (filtro.dataSolicDe) query = query.gte('data_solicitacao', filtro.dataSolicDe);
    if (filtro.dataSolicAte) query = query.lt('data_solicitacao', `${filtro.dataSolicAte}T23:59:59.999`);
    if (filtro.dataNecDe) query = query.gte('data_necessidade', filtro.dataNecDe);
    if (filtro.dataNecAte) query = query.lte('data_necessidade', filtro.dataNecAte);

    const { data, error } = await query;
    if (error) throw mapSupabaseError(error);
    return data ?? [];
  },

  /**
   * Autocomplete da descrição do insumo. Procura no catálogo canônico por
   * código e descrição, e nos apelidos (`insumo_aliases.descricao_original`) —
   * é assim que "CIM CPII 50KG" do fornecedor acha "Cimento CP II 50kg".
   *
   * `company_id is null` são os itens do catálogo global; a empresa vê os dois.
   */
  async buscarInsumos(companyId: string, termo: string, limite = 20): Promise<InsumoEncontrado[]> {
    const t = termo.trim();
    if (t.length < 2) return [];
    const padrao = `%${t}%`;

    const [canonicosRes, aliasesRes] = await Promise.all([
      supabase
        .from('insumos_canonicos')
        .select('id, codigo, descricao, unidade, categoria')
        .or(`company_id.is.null,company_id.eq.${companyId}`)
        .eq('ativo', true)
        .or(`descricao.ilike.${padrao},codigo.ilike.${padrao}`)
        .order('descricao')
        .limit(limite),
      supabase
        .from('insumo_aliases')
        .select('descricao_original, insumo:insumos_canonicos(id, codigo, descricao, unidade, categoria, ativo)')
        .or(`company_id.is.null,company_id.eq.${companyId}`)
        .ilike('descricao_original', padrao)
        .limit(limite),
    ]);
    if (canonicosRes.error) throw mapSupabaseError(canonicosRes.error);
    if (aliasesRes.error) throw mapSupabaseError(aliasesRes.error);

    const porId = new Map<string, InsumoEncontrado>();
    for (const i of canonicosRes.data ?? []) {
      porId.set(i.id, {
        id: i.id,
        codigo: i.codigo,
        descricao: i.descricao,
        unidade: i.unidade || 'un',
        categoria: i.categoria,
        via: null,
      });
    }
    for (const row of (aliasesRes.data ?? []) as any[]) {
      const i = row.insumo;
      if (!i || !i.ativo || porId.has(i.id)) continue;
      porId.set(i.id, {
        id: i.id,
        codigo: i.codigo,
        descricao: i.descricao,
        unidade: i.unidade || 'un',
        categoria: i.categoria,
        via: row.descricao_original,
      });
    }

    return [...porId.values()].slice(0, limite);
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
          insumo_canonico_id: item.insumoCanonicoId ?? null,
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
        insumo_canonico_id: input.insumoCanonicoId ?? null,
        observacao: input.observacao ?? null,
        ordem: input.ordem ?? 0,
        status: 'ABERTA',
      })
      .select()
      .single();
    if (error) throw mapSupabaseError(error);
    return data;
  },

  /** Edita campos de cabeçalho — não mexe na máquina de estado dos itens. */
  async atualizar(
    requisicaoId: string,
    patch: {
      obraId?: string | null;
      descricao?: string | null;
      dataNecessidade?: string | null;
      observacao?: string | null;
    },
  ) {
    const { data, error } = await supabase
      .from('requisicoes')
      .update({
        obra_id: patch.obraId,
        descricao: patch.descricao,
        data_necessidade: patch.dataNecessidade,
        observacao: patch.observacao,
      })
      .eq('id', requisicaoId)
      .select()
      .single();
    if (error) throw mapSupabaseError(error);
    return data;
  },

  /**
   * Edita um item existente. Não toca em `status`, então o trigger
   * validar_transicao_item passa direto (old.status = new.status).
   */
  async atualizarItem(
    itemId: string,
    patch: { descricao?: string; quantidade?: number; unidade?: string; observacao?: string | null },
  ) {
    const { data, error } = await supabase
      .from('requisicao_itens')
      .update(patch)
      .eq('id', itemId)
      .select()
      .single();
    if (error) throw mapSupabaseError(error);
    return data;
  },

  /**
   * Situação da requisição é DERIVADA dos itens por trigger — não existe update
   * em `requisicoes.status` que sobreviva. Mudar a situação, na prática, é
   * transicionar os itens; o cabeçalho se recalcula sozinho.
   *
   * O banco recusa transição ilegal (validar_transicao_item), então o chamador
   * já manda só os itens que podem mudar.
   */
  async alterarStatusItens(itemIds: string[], status: string) {
    if (itemIds.length === 0) return;
    const { error } = await supabase.from('requisicao_itens').update({ status }).in('id', itemIds);
    if (error) throw mapSupabaseError(error);
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
