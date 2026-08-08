-- ============================================================================
-- Busca de fornecedor por razão social / nome fantasia / vendedor,
-- e condição de pagamento vinda do cadastro (módulo Segurança).
--
-- Contexto: o mapa de cotação pedia "digite e o sistema busca o fornecedor",
-- mas `fornecedores` só tinha `nome`. E a condição de pagamento era texto
-- livre por fornecedor da cotação — cada comprador escrevia de um jeito, e a
-- OC gerada nem lia esse campo (montava "N dias" a partir do prazo).
-- ============================================================================

begin;

-- ============================================================================
-- §1 — FORNECEDOR: identificação fiscal + contato do vendedor
-- ============================================================================

alter table public.fornecedores
  add column if not exists razao_social      text,
  add column if not exists nome_fantasia     text,
  add column if not exists vendedor_nome     text,
  add column if not exists vendedor_telefone text,
  add column if not exists vendedor_email    text;

-- `nome` sempre existiu e é o que está preenchido hoje. Ele vira a razão
-- social dos cadastros antigos para a busca não nascer cega.
update public.fornecedores
   set razao_social = nome
 where razao_social is null;

-- Busca é `ilike '%termo%'` — sem trigram nenhum índice btree serve.
create extension if not exists pg_trgm;

create index if not exists idx_fornecedores_busca_nome
  on public.fornecedores using gin (nome gin_trgm_ops);
create index if not exists idx_fornecedores_busca_razao
  on public.fornecedores using gin (razao_social gin_trgm_ops);
create index if not exists idx_fornecedores_busca_fantasia
  on public.fornecedores using gin (nome_fantasia gin_trgm_ops);
create index if not exists idx_fornecedores_busca_vendedor
  on public.fornecedores using gin (vendedor_nome gin_trgm_ops);

-- ============================================================================
-- §2 — CONDIÇÃO DE PAGAMENTO: cadastro do módulo Segurança
-- ============================================================================

-- `tipos_pagamento` já existe (20260804000000) e é gerenciado em /erp/seguranca.
-- Falta só ordenação estável e a possibilidade de aposentar uma condição sem
-- apagá-la (senão some das cotações antigas que a referenciam por texto).
alter table public.tipos_pagamento
  add column if not exists ordem int  not null default 0,
  add column if not exists ativo boolean not null default true;

create index if not exists idx_tipos_pagamento_ordem
  on public.tipos_pagamento(company_id, ordem, nome);

-- Semeia o conjunto padrão SÓ para empresa que ainda não cadastrou nenhuma —
-- quem já montou a própria lista não é sobrescrito.
insert into public.tipos_pagamento (company_id, nome, ordem)
select c.id, padrao.nome, padrao.ordem
from public.companies c
cross join (values
  ('À vista',                  10),
  ('Cartão de crédito 1x',     20),
  ('Cartão de crédito 2x',     21),
  ('Cartão de crédito 3x',     22),
  ('Cartão de crédito 6x',     23),
  ('Cartão de crédito 12x',    24),
  ('Boleto 15',                30),
  ('Boleto 30',                31),
  ('Boleto 45',                32),
  ('Boleto 30/60',             33),
  ('Boleto 30/60/90',          34),
  ('Permuta',                  40)
) as padrao(nome, ordem)
where not exists (
  select 1 from public.tipos_pagamento t where t.company_id = c.id
);

-- ============================================================================
-- §3 — A OC passa a herdar a condição escolhida na cotação
--
-- Antes: condicao_pagamento = prazo_pagamento_dias || ' dias'. O campo
-- `cotacao_fornecedores.condicao_pagamento` era preenchido na tela e ignorado
-- aqui — a OC saía com "0 dias" mesmo com "Boleto 30/60" selecionado.
-- ============================================================================

create or replace function public.gerar_ordens_da_cotacao(p_cotacao_id uuid)
returns uuid[] language plpgsql security invoker set search_path = public as $$
declare
  v_cot   public.cotacoes%rowtype;
  v_ids   uuid[] := '{}';
  v_oc    uuid;
  v_num   bigint;
  v_total numeric;
  f       record;
  p       record;
begin
  select * into v_cot from public.cotacoes where id = p_cotacao_id;
  if not found then raise exception 'Cotação não encontrada'; end if;

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
       fornecedor_id, condicao_pagamento, previsao_entrega, frete, desconto,
       valor, status)
    values
      (v_cot.company_id, v_cot.processo_id, p_cotacao_id, v_cot.requisicao_id,
       v_num, v_cot.obra_id, f.fornecedor_id,
       coalesce(nullif(btrim(f.condicao_pagamento), ''),
                coalesce(f.prazo_pagamento_dias, 0)::text || ' dias'),
       current_date + coalesce(f.prazo_entrega_dias, 0),
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
         quantidade, unidade, valor_unitario)
      values
        (v_cot.company_id, v_oc, p.requisicao_item_id, p.descricao,
         p.quantidade, p.unidade, p.valor_unitario);

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

  update public.cotacoes set status = 'OC_GERADA', updated_at = now() where id = p_cotacao_id;

  return v_ids;
end $$;

commit;
