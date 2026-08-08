-- ============================================================================
-- A OC herda da cotação em vez de nascer vazia.
--
-- Era o buraco do fluxo: o comprador decidia endereço de entrega, forma de
-- pagamento e previsão na cotação, gerava as ordens, e cada OC saía sem nada
-- disso — com `condicao_pagamento` montada de um prazo em dias. Com três
-- fornecedores, eram três OCs para redigitar.
--
-- Precedência: o que o fornecedor ofereceu (cotacao_fornecedores) vence sobre
-- o padrão da cotação, porque condição de pagamento é negociada por fornecedor.
-- O resto — endereço, faturamento, previsão — é da compra e desce igual.
-- ============================================================================

begin;

create or replace function public.gerar_ordens_da_cotacao(p_cotacao_id uuid)
returns uuid[] language plpgsql security invoker set search_path = public as $$
declare
  v_cot     public.cotacoes%rowtype;
  v_ids     uuid[] := '{}';
  v_oc      uuid;
  v_num     bigint;
  v_total   numeric;
  v_endereco text;
  f         record;
  p         record;
begin
  select * into v_cot from public.cotacoes where id = p_cotacao_id;
  if not found then raise exception 'Cotação não encontrada'; end if;

  -- Endereço de entrega em uma linha, do jeito que a OC e o link público
  -- mostram. Montado uma vez, fora do laço: é o mesmo para todas as ordens.
  v_endereco := nullif(btrim(
    concat_ws(', ',
      nullif(concat_ws(' ', nullif(btrim(coalesce(v_cot.entrega_logradouro, '')), ''),
                            nullif(btrim(coalesce(v_cot.entrega_numero, '')), '')), ''),
      nullif(btrim(coalesce(v_cot.entrega_complemento, '')), ''),
      nullif(btrim(coalesce(v_cot.entrega_bairro, '')), ''),
      nullif(concat_ws(' - ', nullif(btrim(coalesce(v_cot.entrega_cidade, '')), ''),
                              nullif(btrim(coalesce(v_cot.entrega_uf, '')), '')), ''),
      nullif(btrim(coalesce(v_cot.entrega_cep, '')), '')
    )), '');

  for f in
    select distinct cf.id as cot_forn_id, cf.fornecedor_id,
           cf.frete, cf.desconto_global_pct, cf.prazo_pagamento_dias,
           cf.prazo_entrega_dias, cf.condicao_pagamento
    from public.cotacao_precos cp
    join public.cotacao_fornecedores cf on cf.id = cp.cotacao_fornecedor_id
    where cp.escolhido = true and cf.cotacao_id = p_cotacao_id
  loop
    v_num := public.proximo_numero(v_cot.company_id, 'ordem_compra');

    insert into public.ordens_compra
      (company_id, processo_id, cotacao_id, requisicao_id, numero, obra_id,
       fornecedor_id, condicao_pagamento, forma_pagamento, previsao_entrega,
       endereco_entrega, observacao, frete, desconto, valor, status)
    values
      (v_cot.company_id, v_cot.processo_id, p_cotacao_id, v_cot.requisicao_id,
       v_num, v_cot.obra_id, f.fornecedor_id,
       -- Condição do fornecedor manda; sem ela, o prazo em dias vira texto.
       coalesce(nullif(btrim(f.condicao_pagamento), ''),
                coalesce(f.prazo_pagamento_dias, 0)::text || ' dias'),
       v_cot.forma_pagamento,
       -- Previsão da cotação manda sobre o prazo de entrega do fornecedor.
       coalesce(v_cot.previsao_entrega,
                current_date + coalesce(f.prazo_entrega_dias, 0)),
       v_endereco,
       v_cot.observacao,
       coalesce(f.frete, 0), 0, 0, 'GERADA')
    returning id into v_oc;

    v_total := 0;

    for p in
      select cp.*, ci.descricao, ci.quantidade, ci.unidade, ci.requisicao_item_id
      from public.cotacao_precos cp
      join public.cotacao_itens ci on ci.id = cp.cotacao_item_id
      where cp.cotacao_fornecedor_id = f.cot_forn_id and cp.escolhido = true
    loop
      insert into public.ordem_compra_itens
        (company_id, ordem_compra_id, requisicao_item_id, descricao,
         quantidade, unidade, valor_unitario, marca)
      values
        (v_cot.company_id, v_oc, p.requisicao_item_id, p.descricao,
         p.quantidade, p.unidade, p.valor_unitario, p.marca);

      v_total := v_total + (p.quantidade * p.valor_unitario);

      if p.requisicao_item_id is not null then
        update public.requisicao_itens set status = 'EM_OC', updated_at = now()
         where id = p.requisicao_item_id;
      end if;
    end loop;

    update public.ordens_compra
       set valor = v_total + coalesce(f.frete,0)
                 - (v_total * coalesce(f.desconto_global_pct,0) / 100.0)
     where id = v_oc;

    v_ids := array_append(v_ids, v_oc);
  end loop;

  if array_length(v_ids, 1) is null then
    raise exception 'Nenhum preço marcado como escolhido nesta cotação';
  end if;

  -- Anexos da cotação acompanham cada OC gerada: o fornecedor precisa do
  -- desenho e da especificação tanto quanto do preço.
  insert into public.anexos_compra
    (company_id, escopo, ordem_id, nome, caminho, tamanho, mime_type, enviado_por)
  select a.company_id, 'ordem_compra', o.id, a.nome, a.caminho, a.tamanho,
         a.mime_type, a.enviado_por
    from public.anexos_compra a
   cross join unnest(v_ids) as o(id)
   where a.escopo = 'cotacao' and a.cotacao_id = p_cotacao_id;

  update public.cotacoes set status = 'OC_GERADA', updated_at = now() where id = p_cotacao_id;

  return v_ids;
end $$;

commit;
