import { supabase } from '@/integrations/supabase/client';

/** base64 puro, sem o prefixo `data:...;base64,` que o FileReader acrescenta. */
function lerComoBase64(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    leitor.onload = () => {
      const resultado = String(leitor.result);
      resolve(resultado.slice(resultado.indexOf(',') + 1));
    };
    leitor.readAsDataURL(arquivo);
  });
}

/** Extrai a mensagem real de dentro do FunctionsHttpError do supabase-js. */
async function lerErroDaFunction(error: unknown): Promise<string | null> {
  const contexto = (error as { context?: Response }).context;
  if (!contexto || typeof contexto.json !== 'function') return null;
  try {
    const corpo = await contexto.json();
    return corpo?.error ?? null;
  } catch {
    return null;
  }
}

export interface SalvarPrecoInput {
  cotacaoId: string;
  companyId: string;
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

export interface FornecedorBusca {
  id: string;
  nome: string;
  razao_social: string | null;
  nome_fantasia: string | null;
  vendedor_nome: string | null;
  cnpj: string | null;
  status: string;
}

export interface CondicaoPagamento {
  id: string;
  nome: string;
}

/** Cadastro rápido, feito de dentro da cotação. */
export interface NovoFornecedor {
  nome: string;
  email?: string;
  celular?: string;
  tipoPessoa?: 'fisica' | 'juridica';
}

export interface AnexoCompra {
  id: string;
  nome: string;
  caminho: string;
  tamanho: number | null;
  mime_type: string | null;
  created_at: string;
}

/** Endereço de entrega ou cobrança da cotação. */
export interface EnderecoCotacao {
  local: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  /** Só entrega tem recebedor. */
  recebedor?: string;
}

export type ProvedorIA = 'anthropic' | 'openai' | 'google';

export interface LinhaExtraida {
  /** null = a IA não achou item correspondente; o usuário decide. */
  cotacao_item_id: string | null;
  descricao_documento: string;
  marca: string | null;
  valor_unitario: number | null;
  valor_total: number | null;
  confianca: 'alta' | 'media' | 'baixa';
}

export interface OrcamentoExtraido {
  fornecedor: string | null;
  condicao_pagamento: string | null;
  frete: number | null;
  validade: string | null;
  linhas: LinhaExtraida[];
  provedor: ProvedorIA;
}

export interface CondicoesFornecedorInput {
  condicao_pagamento?: string | null;
  prazo_pagamento_dias?: number;
  prazo_entrega_dias?: number;
  frete?: number;
  desconto_global_pct?: number;
  observacao?: string | null;
}

export const cotacoesRepository = {
  async buscarMapa(cotacaoId: string) {
    const { data: cotacao } = await supabase
      .from('cotacoes')
      .select('*, obra:obras(nome)')
      .eq('id', cotacaoId)
      .single();
    const { data: items } = await supabase.from('cotacao_itens').select('*').eq('cotacao_id', cotacaoId);
    const { data: fornecedores } = await supabase
      .from('cotacao_fornecedores')
      .select('*, fornecedor:fornecedores(nome, razao_social, nome_fantasia, vendedor_nome)')
      .eq('cotacao_id', cotacaoId);
    const { data: precos } = await supabase.from('cotacao_precos').select('*').eq('cotacao_id', cotacaoId);
    return {
      cotacao: cotacao || null,
      items: items || [],
      fornecedores: fornecedores || [],
      precos: precos || [],
    };
  },

  /**
   * Update-ou-insert explícito em vez de `upsert(onConflict:...)`: o índice
   * único (cotacao_fornecedor_id, cotacao_item_id) não está nas migrations
   * versionadas, e sem ele o upsert falha silenciosamente para o usuário.
   *
   * `cotacao_id` e `company_id` são obrigatórios na escrita — buscarMapa filtra
   * os preços por cotacao_id, então uma linha gravada sem ele nunca voltaria
   * para a tela (era exatamente por isso que o valor digitado sumia).
   */
  async salvarPreco(input: SalvarPrecoInput) {
    const { data: atualizado, error: erroUpdate } = await supabase
      .from('cotacao_precos')
      .update(input.patch)
      .eq('cotacao_fornecedor_id', input.cotacaoFornecedorId)
      .eq('cotacao_item_id', input.cotacaoItemId)
      .select('*');
    if (erroUpdate) throw erroUpdate;
    if (atualizado && atualizado.length > 0) return atualizado[0];

    const { data: inserido, error: erroInsert } = await supabase
      .from('cotacao_precos')
      .insert({
        cotacao_id: input.cotacaoId,
        company_id: input.companyId,
        cotacao_fornecedor_id: input.cotacaoFornecedorId,
        cotacao_item_id: input.cotacaoItemId,
        ...input.patch,
      })
      .select('*')
      .single();
    if (erroInsert) throw erroInsert;
    return inserido;
  },

  async adicionarFornecedor(cotacaoId: string, companyId: string, fornecedorId: string) {
    const { error } = await supabase
      .from('cotacao_fornecedores')
      .insert({ cotacao_id: cotacaoId, company_id: companyId, fornecedor_id: fornecedorId });
    if (error) throw error;
  },

  /**
   * "Só o nome, sem cadastro": cria o fornecedor com o mínimo e já o pendura na
   * cotação. Ele aparece normalmente no módulo Fornecedores depois, para ser
   * completado quando (e se) virar fornecedor recorrente.
   */
  async criarFornecedorAvulso(cotacaoId: string, companyId: string, dados: NovoFornecedor) {
    // Caixa alta no nome: é como o cadastro da empresa já grava (mesma regra
    // dos tipos de pagamento) e evita "Todimo", "TODIMO" e "todimo" virarem
    // três fornecedores na busca.
    const nome = dados.nome.trim().toUpperCase();

    const { data: fornecedor, error: erroFornecedor } = await supabase
      .from('fornecedores')
      .insert({
        company_id: companyId,
        nome,
        // razao_social espelha o nome para o fornecedor avulso já aparecer na
        // busca por razão social antes de alguém completar o cadastro.
        razao_social: nome,
        // E-mail fica minúsculo: caixa alta em endereço quebra integração de
        // envio e é a convenção em todo lugar que consome esse campo.
        email: dados.email?.trim().toLowerCase() || null,
        celular: dados.celular?.trim() || null,
        tipo_pessoa: dados.tipoPessoa || null,
        status: 'ATIVO',
      })
      .select('id, nome')
      .single();
    if (erroFornecedor) throw erroFornecedor;

    await cotacoesRepository.adicionarFornecedor(cotacaoId, companyId, fornecedor.id);
    return fornecedor;
  },

  async removerFornecedor(cotacaoFornecedorId: string) {
    const { error } = await supabase
      .from('cotacao_fornecedores')
      .delete()
      .eq('id', cotacaoFornecedorId);
    if (error) throw error;
  },

  /** Frete, prazo de pagamento e entrega — o que alimenta o ranking a valor presente. */
  async atualizarCondicoesFornecedor(cotacaoFornecedorId: string, patch: CondicoesFornecedorInput) {
    const { error } = await supabase
      .from('cotacao_fornecedores')
      .update(patch)
      .eq('id', cotacaoFornecedorId);
    if (error) throw error;
  },

  async listarFornecedores(companyId: string) {
    const { data } = await supabase.from('fornecedores').select('*').eq('company_id', companyId).order('nome');
    return data || [];
  },

  /**
   * Busca digitada no seletor da cotação. Bate em nome, razão social, nome
   * fantasia e nome do vendedor — o comprador lembra do vendedor com quem
   * falou muito mais vezes do que da razão social da empresa.
   *
   * Termo vazio devolve os primeiros ativos, para o dropdown não abrir vazio
   * quando o campo recebe foco.
   */
  async buscarFornecedores(companyId: string, termo: string, limite = 20): Promise<FornecedorBusca[]> {
    let query = supabase
      .from('fornecedores')
      .select('id, nome, razao_social, nome_fantasia, vendedor_nome, cnpj, status')
      .eq('company_id', companyId)
      .eq('status', 'ATIVO')
      .order('nome')
      .limit(limite);

    const t = termo.trim();
    if (t) {
      // Vírgula e parêntese quebram a gramática do `or` do PostgREST.
      const seguro = t.replace(/[,()]/g, ' ');
      const padrao = `%${seguro}%`;
      query = query.or(
        [
          `nome.ilike.${padrao}`,
          `razao_social.ilike.${padrao}`,
          `nome_fantasia.ilike.${padrao}`,
          `vendedor_nome.ilike.${padrao}`,
        ].join(','),
      );
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as FornecedorBusca[];
  },

  /**
   * Condições de pagamento cadastradas no módulo Segurança (`tipos_pagamento`).
   * É a única fonte da lista — a cotação não aceita mais texto livre, senão
   * "Boleto 30", "boleto30" e "BOL 30" viram três condições diferentes.
   */
  async listarCondicoesPagamento(companyId: string): Promise<CondicaoPagamento[]> {
    const { data, error } = await supabase
      .from('tipos_pagamento')
      .select('id, nome')
      .eq('company_id', companyId)
      .eq('ativo', true)
      .order('ordem')
      .order('nome');
    if (error) throw error;
    return (data ?? []) as CondicaoPagamento[];
  },

  /**
   * Manda o orçamento do fornecedor (PDF ou imagem) para a Edge Function
   * `extrair-cotacao`, que chama a IA configurada e devolve os preços já
   * casados com os itens da cotação.
   *
   * O arquivo vai em base64 no corpo: Edge Function recebe JSON, e converter
   * aqui evita depender de multipart no runtime do Deno. O teto de 10MB é
   * conservador — PDF de orçamento raramente passa de 1MB, e base64 infla o
   * payload em ~33%.
   */
  async extrairOrcamento(input: {
    arquivo: File;
    itens: { id: string; descricao: string; unidade: string; quantidade: number }[];
    provedor?: ProvedorIA;
    modelo?: string;
  }): Promise<OrcamentoExtraido> {
    if (input.arquivo.size > 10 * 1024 * 1024) {
      throw new Error('Arquivo acima de 10 MB. Envie um PDF menor ou uma foto comprimida.');
    }

    const base64 = await lerComoBase64(input.arquivo);

    const { data, error } = await supabase.functions.invoke('extrair-cotacao', {
      body: {
        arquivo: base64,
        media_type: input.arquivo.type,
        nome: input.arquivo.name,
        itens: input.itens,
        provedor: input.provedor,
        modelo: input.modelo,
      },
    });

    // A function devolve {error} com status 4xx/5xx; o supabase-js embrulha
    // isso num FunctionsHttpError cuja mensagem é genérica. Ler o corpo é o
    // que faz o usuário ver "Formato não aceito" em vez de "non-2xx status".
    if (error) {
      const detalhe = await lerErroDaFunction(error);
      throw new Error(detalhe || error.message);
    }
    if (data?.error) throw new Error(data.error);

    return data as OrcamentoExtraido;
  },

  /** Cabeçalho da cotação: endereços, pagamento e faturamento. */
  async atualizarCotacao(cotacaoId: string, patch: Record<string, unknown>) {
    const { error } = await supabase.from('cotacoes').update(patch).eq('id', cotacaoId);
    if (error) throw error;
  },

  async listarAnexos(cotacaoId: string): Promise<AnexoCompra[]> {
    const { data, error } = await supabase
      .from('anexos_compra')
      .select('id, nome, caminho, tamanho, mime_type, created_at')
      .eq('escopo', 'cotacao')
      .eq('cotacao_id', cotacaoId)
      .order('created_at');
    if (error) throw error;
    return (data ?? []) as AnexoCompra[];
  },

  /**
   * Sobe o arquivo e registra o anexo.
   *
   * O primeiro segmento do caminho é o companyId — é o que as policies do
   * Storage usam para amarrar o arquivo à empresa sem consultar a tabela.
   * O nome recebe um timestamp: dois orçamentos chamados "orcamento.pdf" não
   * podem se sobrescrever.
   */
  async enviarAnexo(input: { companyId: string; cotacaoId: string; arquivo: File }) {
    const seguro = input.arquivo.name.replace(/[^\w.\-]+/g, '_');
    const caminho = `${input.companyId}/cotacoes/${input.cotacaoId}/${Date.now()}-${seguro}`;

    const { error: erroUpload } = await supabase.storage
      .from('anexos-compra')
      .upload(caminho, input.arquivo);
    if (erroUpload) throw erroUpload;

    const { error } = await supabase.from('anexos_compra').insert({
      company_id: input.companyId,
      escopo: 'cotacao',
      cotacao_id: input.cotacaoId,
      nome: input.arquivo.name,
      caminho,
      tamanho: input.arquivo.size,
      mime_type: input.arquivo.type || null,
    });
    // Registro falhou depois do upload: o arquivo ficaria órfão no bucket.
    if (error) {
      await supabase.storage.from('anexos-compra').remove([caminho]);
      throw error;
    }
  },

  async removerAnexo(anexo: { id: string; caminho: string }) {
    const { error } = await supabase.from('anexos_compra').delete().eq('id', anexo.id);
    if (error) throw error;
    await supabase.storage.from('anexos-compra').remove([anexo.caminho]);
  },

  /** O bucket é privado — o download sai por URL assinada de curta duração. */
  async urlAnexo(caminho: string): Promise<string> {
    const { data, error } = await supabase.storage
      .from('anexos-compra')
      .createSignedUrl(caminho, 60);
    if (error || !data) throw error ?? new Error('Não foi possível abrir o anexo.');
    return data.signedUrl;
  },

  async removerItemCotacao(cotacaoItemId: string) {
    const { error } = await supabase.rpc('remover_item_cotacao', { p_cotacao_item_id: cotacaoItemId });
    if (error) throw error;
  },

  async adicionarItensCotacao(cotacaoId: string, itemIds: string[]) {
    const { error } = await supabase.rpc('adicionar_itens_cotacao', {
      p_cotacao_id: cotacaoId,
      p_item_ids: itemIds,
    });
    if (error) throw error;
  },

  async listarItensAbertosDaObra(obraId: string) {
    const { data } = await supabase
      .from('requisicao_itens')
      .select('*, requisicao!inner(id, numero, obra_id, status, data_necessidade)')
      .eq('requisicao.obra_id', obraId)
      .eq('requisicao.status', 'ABERTA');
    return data || [];
  },

  async gerarOrdensDaCotacao(cotacaoId: string) {
    const { data, error } = await supabase.rpc('gerar_ordens_da_cotacao', { p_cotacao_id: cotacaoId });
    if (error) throw error;
    return data || [];
  },
};

export default cotacoesRepository;
