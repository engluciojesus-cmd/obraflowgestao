import { supabase } from '@/integrations/supabase/client';

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
      .select('*, fornecedor:fornecedores(nome)')
      .eq('cotacao_id', cotacaoId);
    const { data: precos } = await supabase.from('cotacao_precos').select('*').eq('cotacao_id', cotacaoId);
    return {
      cotacao: cotacao || null,
      items: items || [],
      fornecedores: fornecedores || [],
      precos: precos || [],
    };
  },
  async salvarPreco(input: any) {
    const { error } = await supabase
      .from('cotacao_precos')
      .upsert(input, { onConflict: 'cotacao_fornecedor_id,cotacao_item_id' });
    if (error) throw error;
  },
  async adicionarFornecedor(cotacaoId: string, fornecedorId: string) {
    const { error } = await supabase.from('cotacao_fornecedores').insert({ cotacao_id: cotacaoId, fornecedor_id: fornecedorId });
    if (error) throw error;
  },
  async listarFornecedores(companyId: string) {
    const { data } = await supabase.from('fornecedores').select('*').eq('company_id', companyId).order('nome');
    return data || [];
  },
  async gerarOrdemCompra(input: any) {
    const { data, error } = await supabase.from('ordens_compra').insert(input).select().single();
    if (error) throw error;
    return { ordemId: data.id };
  },
};

export default cotacoesRepository;
