-- ============================================================================
-- OBRAFLOW — MIGRATION: FUNDAÇÃO DE IA
-- Arquivo: supabase/migrations/20260810000000_fundacao_ia.sql
--
-- PRÉ-REQUISITO OBRIGATÓRIO: rodar `supabase db pull` ANTES desta migration,
-- para versionar as 8 tabelas que hoje só existem no banco de produção
-- (cotacoes, cotacao_itens, cotacao_fornecedores, cotacao_precos,
--  contratos, contrato_itens, ordens_compra, ordem_compra_itens).
--
-- Esta migration cria a camada que nenhum ERP de construção de pequeno/médio
-- porte tem: catálogo canônico com busca semântica, série histórica de preços,
-- composições paramétricas, trilha de eventos e fila de sugestões.
-- ============================================================================

begin;

-- ============================================================================
-- §0 — PERMISSÃO GRANULAR NO BANCO  (corrige P1.3)
-- Hoje a permissão por módulo existe só no React. Qualquer usuário com a
-- anon key (que está no bundle do navegador) escreve em qualquer módulo.
-- ============================================================================

alter table public.company_members
  add column if not exists modulos text[] default null;   -- null = todos

comment on column public.company_members.modulos is
  'Módulos liberados. NULL = acesso total. Espelha src/types/index.ts MODULOS.';

create or replace function public.tem_modulo(p_company uuid, p_modulo text)
returns boolean language sql security definer set search_path = public stable as $$
  select public.is_admin_global() or exists (
    select 1 from public.company_members
    where user_id = auth.uid()
      and company_id = p_company
      and role in ('admin','manager','operator')
      and (modulos is null or p_modulo = any(modulos))
  );
$$;

-- Papéis que só leem
create or replace function public.pode_ler(p_company uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select public.is_admin_global()
      or p_company in (select public.my_company_ids());
$$;

-- Corrige a recursão de RLS diagnosticada em P0.3
create or replace function public.my_global_role()
returns text language sql security definer set search_path = public stable as $$
  select global_role from public.users where id = auth.uid();
$$;

drop policy if exists "users_update_own" on public.users;
create policy "users_update_own" on public.users
  for update using (auth.uid() = id)
  with check (auth.uid() = id and global_role = public.my_global_role());


-- ============================================================================
-- §1 — DENORMALIZAR company_id NAS TABELAS-FILHO  (corrige P1.6)
-- RLS por JOIN em cascata (item -> serviço -> orçamento -> membros) não escala.
-- Passa a ser: company_id = any(my_company_ids()). Um índice, uma comparação.
-- ============================================================================

alter table public.orcamento_itens    add column if not exists company_id uuid references public.companies(id) on delete cascade;
alter table public.orcamento_servicos add column if not exists company_id uuid references public.companies(id) on delete cascade;
alter table public.orcamento_fases    add column if not exists company_id uuid references public.companies(id) on delete cascade;
alter table public.pedido_itens       add column if not exists company_id uuid references public.companies(id) on delete cascade;

-- Backfill
update public.orcamento_fases f
   set company_id = o.company_id
  from public.orcamentos o
 where o.id = f.orcamento_id and f.company_id is null;

update public.orcamento_servicos s
   set company_id = o.company_id
  from public.orcamentos o
 where o.id = s.orcamento_id and s.company_id is null;

update public.orcamento_itens i
   set company_id = s.company_id
  from public.orcamento_servicos s
 where s.id = i.servico_id and i.company_id is null;

update public.pedido_itens pi
   set company_id = p.company_id
  from public.pedidos p
 where p.id = pi.pedido_id and pi.company_id is null;

-- Trigger genérica: herda company_id do pai automaticamente em novos inserts
create or replace function public.herdar_company_id()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_company uuid;
  v_parent_table text := tg_argv[0];
  v_parent_col   text := tg_argv[1];
  v_parent_id    uuid;
begin
  if new.company_id is not null then
    return new;
  end if;
  execute format('select ($1).%I', v_parent_col) into v_parent_id using new;
  execute format('select company_id from public.%I where id = $1', v_parent_table)
    into v_company using v_parent_id;
  new.company_id := v_company;
  return new;
end $$;

drop trigger if exists trg_company_orc_fases on public.orcamento_fases;
create trigger trg_company_orc_fases before insert on public.orcamento_fases
  for each row execute function public.herdar_company_id('orcamentos','orcamento_id');

drop trigger if exists trg_company_orc_servicos on public.orcamento_servicos;
create trigger trg_company_orc_servicos before insert on public.orcamento_servicos
  for each row execute function public.herdar_company_id('orcamentos','orcamento_id');

drop trigger if exists trg_company_orc_itens on public.orcamento_itens;
create trigger trg_company_orc_itens before insert on public.orcamento_itens
  for each row execute function public.herdar_company_id('orcamento_servicos','servico_id');

drop trigger if exists trg_company_pedido_itens on public.pedido_itens;
create trigger trg_company_pedido_itens before insert on public.pedido_itens
  for each row execute function public.herdar_company_id('pedidos','pedido_id');

create index if not exists idx_orc_fases_company    on public.orcamento_fases(company_id);
create index if not exists idx_orc_servicos_company on public.orcamento_servicos(company_id);
create index if not exists idx_orc_itens_company    on public.orcamento_itens(company_id);
create index if not exists idx_pedido_itens_company on public.pedido_itens(company_id);

-- Substitui as policies antigas por JOIN
do $$
declare t text;
begin
  foreach t in array array['orcamento_fases','orcamento_servicos','orcamento_itens','pedido_itens']
  loop
    execute format('drop policy if exists "%1$s_select" on public.%1$s', t);
    execute format('drop policy if exists "%1$s_write"  on public.%1$s', t);
    execute format($f$
      create policy "%1$s_select" on public.%1$s
        for select using (public.pode_ler(company_id))
    $f$, t);
    execute format($f$
      create policy "%1$s_write" on public.%1$s
        for all using (public.can_write_company(company_id))
             with check (public.can_write_company(company_id))
    $f$, t);
  end loop;
end $$;


-- ============================================================================
-- §2 — CATÁLOGO CANÔNICO DE INSUMOS  ⭐ O DIFERENCIAL
--
-- Problema real: o mesmo cimento chega como
--   "CIM CP-II-E-32 SC 50KG", "Cimento CPII 50kg", "CIMENTO CP II E32 50 KG"
-- de três fornecedores. Nenhum ERP pequeno consegue comparar preço, porque
-- compara strings. Sem catálogo canônico não existe histórico de preço, não
-- existe índice de inflação de material, não existe sugestão inteligente.
--
-- Solução: entidade canônica + embedding + tabela de apelidos aprendida.
-- ============================================================================

create extension if not exists vector;

create table if not exists public.insumos_canonicos (
  id            uuid primary key default gen_random_uuid(),
  -- NULL = catálogo global compartilhado entre todos os tenants.
  -- Preenchido = insumo privado daquela construtora.
  company_id    uuid references public.companies(id) on delete cascade,
  codigo        text,                     -- SINAPI / SICRO / interno
  descricao     text not null,
  unidade       text not null,            -- unidade CANÔNICA (kg, m2, m3, un, sc)
  categoria     text,                     -- Cimento, Aço, Cerâmica, Elétrica...
  subcategoria  text,
  ncm           text,
  especificacoes jsonb not null default '{}'::jsonb,  -- {"resistencia":"32MPa","peso_kg":50}
  -- 384 dims = Supabase.ai gte-small (roda na própria Edge Function, custo zero,
  -- sem chave externa). Para trocar por voyage-3 (1024) veja o arquivo 03 §7.
  embedding     vector(384),
  ativo         boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_insumos_can_company  on public.insumos_canonicos(company_id);
create index if not exists idx_insumos_can_categoria on public.insumos_canonicos(categoria);
create index if not exists idx_insumos_can_trgm
  on public.insumos_canonicos using gin (descricao gin_trgm_ops);

-- HNSW: busca vetorial aproximada, ~O(log n). Criar DEPOIS de popular o catálogo
-- (se criado em tabela vazia o índice fica mal calibrado).
create index if not exists idx_insumos_can_embedding
  on public.insumos_canonicos using hnsw (embedding vector_cosine_ops);

create extension if not exists pg_trgm;

-- ---------- APELIDOS: como cada fornecedor escreve o mesmo insumo ----------
-- Esta tabela é o ativo que a IA constrói ao longo do tempo. Quanto mais o
-- sistema roda, mais preciso ele fica. É defensável competitivamente.
create table if not exists public.insumo_aliases (
  id                  uuid primary key default gen_random_uuid(),
  insumo_canonico_id  uuid not null references public.insumos_canonicos(id) on delete cascade,
  company_id          uuid references public.companies(id) on delete cascade,
  fornecedor_id       uuid references public.fornecedores(id) on delete set null,
  descricao_original  text not null,
  descricao_norm      text generated always as (lower(unaccent_imut(descricao_original))) stored,
  unidade_original    text,
  -- Conversão para a unidade canônica: "SC 50KG" -> kg tem fator 50
  fator_conversao     numeric(14,6) not null default 1,
  origem              text not null default 'ia' check (origem in ('manual','ia','importacao')),
  confianca           numeric(4,3),            -- 0..1 (similaridade do cosseno)
  confirmado          boolean not null default false,   -- ⭐ human-in-the-loop
  confirmado_por      uuid references public.users(id) on delete set null,
  confirmado_em       timestamptz,
  created_at          timestamptz not null default now()
);

create index if not exists idx_alias_canonico on public.insumo_aliases(insumo_canonico_id);
create index if not exists idx_alias_company  on public.insumo_aliases(company_id);
create unique index if not exists uq_alias_desc
  on public.insumo_aliases(company_id, descricao_norm, coalesce(fornecedor_id,'00000000-0000-0000-0000-000000000000'::uuid));


-- ============================================================================
-- §3 — SÉRIE HISTÓRICA DE PREÇOS
-- Alimentada automaticamente por trigger sempre que um preço real acontece.
-- É o que permite: "este preço está 18% acima da mediana dos últimos 90 dias".
-- ============================================================================

create table if not exists public.precos_historicos (
  id                 bigint generated always as identity primary key,
  company_id         uuid not null references public.companies(id) on delete cascade,
  insumo_canonico_id uuid references public.insumos_canonicos(id) on delete set null,
  fornecedor_id      uuid references public.fornecedores(id) on delete set null,
  obra_id            uuid references public.obras(id) on delete set null,
  origem             text not null check (origem in ('cotacao','pedido','nota','contrato','manual')),
  origem_id          uuid,
  descricao_original text,
  data               date not null default current_date,
  quantidade         numeric(14,4) not null default 1,
  unidade            text,
  valor_unitario     numeric(14,4) not null,
  -- Normalizado para a unidade canônica (valor_unitario / fator_conversao)
  valor_canonico     numeric(14,6),
  municipio          text,
  uf                 char(2),
  created_at         timestamptz not null default now()
);

create index if not exists idx_precos_insumo_data
  on public.precos_historicos(insumo_canonico_id, data desc);
create index if not exists idx_precos_company_data
  on public.precos_historicos(company_id, data desc);
create index if not exists idx_precos_fornecedor
  on public.precos_historicos(fornecedor_id, data desc);

-- Estatística por insumo nos últimos 90 dias — base do detector de anomalia
create or replace view public.vw_preco_referencia as
select
  ph.insumo_canonico_id,
  ph.company_id,
  count(*)                                                                      as amostras,
  percentile_cont(0.50) within group (order by ph.valor_canonico)                as mediana,
  percentile_cont(0.25) within group (order by ph.valor_canonico)                as p25,
  percentile_cont(0.75) within group (order by ph.valor_canonico)                as p75,
  min(ph.valor_canonico)                                                         as minimo,
  max(ph.valor_canonico)                                                         as maximo,
  stddev_samp(ph.valor_canonico)                                                 as desvio,
  max(ph.data)                                                                   as ultima_data
from public.precos_historicos ph
where ph.data >= current_date - interval '90 days'
  and ph.valor_canonico is not null
group by ph.insumo_canonico_id, ph.company_id;


-- ============================================================================
-- §4 — COMPOSIÇÕES PARAMÉTRICAS  ⭐ "INTELIGÊNCIA DA OBRA"
--
-- O documento sugeriu: "comprou 500 m² de porcelanato -> sugerir argamassa,
-- rejunte, nivelador, espaçador, rodapé".
--
-- DECISÃO ARQUITETURAL IMPORTANTE: essa sugestão NÃO pode vir de um LLM.
-- Se um LLM disser "compre 1.200 kg de argamassa" ele está alucinando um
-- número. Em ERP, número alucinado destrói a confiança do cliente na hora.
--
-- O padrão correto:
--   LLM        -> CLASSIFICA ("este item é a composição REV-CER-POR")
--   SQL/código -> CALCULA    (500 m² x 5,0 kg/m² x 1,10 de perda = 2.750 kg)
--
-- O LLM nunca produz um número que vira dinheiro. Só produz um vínculo,
-- que fica gravado e auditável.
-- ============================================================================

create table if not exists public.composicoes (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid references public.companies(id) on delete cascade,  -- NULL = global
  codigo      text,
  descricao   text not null,
  unidade     text not null,               -- m2, m3, m, un
  fonte       text not null default 'propria' check (fonte in ('TCPO','SINAPI','SICRO','propria')),
  embedding   vector(384),
  ativo       boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists idx_composicoes_embedding
  on public.composicoes using hnsw (embedding vector_cosine_ops);

create table if not exists public.composicao_itens (
  id                 uuid primary key default gen_random_uuid(),
  composicao_id      uuid not null references public.composicoes(id) on delete cascade,
  insumo_canonico_id uuid not null references public.insumos_canonicos(id) on delete cascade,
  -- Consumo por UNIDADE da composição. Ex: 5.0 kg de argamassa por m² de piso.
  coeficiente        numeric(14,6) not null check (coeficiente > 0),
  perda_percentual   numeric(6,3)  not null default 0 check (perda_percentual >= 0),
  obrigatorio        boolean not null default true,
  observacao         text,
  created_at         timestamptz not null default now(),
  unique (composicao_id, insumo_canonico_id)
);

create index if not exists idx_comp_itens_composicao on public.composicao_itens(composicao_id);

-- Vínculo aprendido: item de orçamento <-> composição
create table if not exists public.orcamento_item_composicao (
  orcamento_item_id uuid primary key references public.orcamento_itens(id) on delete cascade,
  composicao_id     uuid not null references public.composicoes(id) on delete cascade,
  company_id        uuid not null references public.companies(id) on delete cascade,
  confianca         numeric(4,3),
  origem            text not null default 'ia' check (origem in ('manual','ia')),
  confirmado        boolean not null default false,
  created_at        timestamptz not null default now()
);

-- ---------- FUNÇÃO DETERMINÍSTICA: explode a composição ----------
-- Chamada pela UI e pelo agente. Zero LLM. Números 100% auditáveis.
create or replace function public.explodir_composicao(
  p_composicao_id uuid,
  p_quantidade    numeric
)
returns table (
  insumo_canonico_id uuid,
  descricao          text,
  unidade            text,
  quantidade_bruta   numeric,
  perda_percentual   numeric,
  quantidade_total   numeric,
  obrigatorio        boolean
)
language sql stable security invoker as $$
  select
    ic.id,
    ic.descricao,
    ic.unidade,
    round(p_quantidade * ci.coeficiente, 4),
    ci.perda_percentual,
    round(p_quantidade * ci.coeficiente * (1 + ci.perda_percentual / 100.0), 4),
    ci.obrigatorio
  from public.composicao_itens ci
  join public.insumos_canonicos ic on ic.id = ci.insumo_canonico_id
  where ci.composicao_id = p_composicao_id
  order by ci.obrigatorio desc, ic.descricao;
$$;


-- ============================================================================
-- §5 — ESTOQUE (pré-requisito da sugestão útil)
-- Sem saldo, "compre 2.750 kg de argamassa" é ruído: pode já haver 3.000 kg
-- no canteiro. A sugestão precisa ser SEMPRE líquida do saldo.
-- ============================================================================

create table if not exists public.estoque_movimentos (
  id                 bigint generated always as identity primary key,
  company_id         uuid not null references public.companies(id) on delete cascade,
  obra_id            uuid references public.obras(id) on delete cascade,
  insumo_canonico_id uuid not null references public.insumos_canonicos(id) on delete restrict,
  tipo               text not null check (tipo in ('entrada','saida','ajuste','transferencia','devolucao')),
  quantidade         numeric(14,4) not null,     -- sempre positiva; `tipo` dá o sinal
  valor_unitario     numeric(14,4),
  origem             text check (origem in ('nota','pedido','requisicao','inventario','manual')),
  origem_id          uuid,
  documento          text,
  observacao         text,
  criado_por         uuid references public.users(id) on delete set null,
  created_at         timestamptz not null default now()
);

create index if not exists idx_estoque_obra_insumo
  on public.estoque_movimentos(obra_id, insumo_canonico_id, created_at desc);

create or replace view public.vw_estoque_saldo as
select
  em.company_id,
  em.obra_id,
  em.insumo_canonico_id,
  ic.descricao,
  ic.unidade,
  sum(case when em.tipo in ('entrada','devolucao','ajuste') then em.quantidade
           else -em.quantidade end)                                    as saldo,
  max(em.created_at)                                                   as ultimo_movimento
from public.estoque_movimentos em
join public.insumos_canonicos ic on ic.id = em.insumo_canonico_id
group by em.company_id, em.obra_id, em.insumo_canonico_id, ic.descricao, ic.unidade;


-- ============================================================================
-- §6 — SCORECARD DE FORNECEDOR  ⭐ "RADAR DE COMPRAS"
-- Nenhum ERP pequeno mede isso. É o dado que o comprador tem "no feeling"
-- e que a empresa perde quando o comprador sai.
-- ============================================================================

alter table public.pedidos
  add column if not exists data_entrega_prevista date,
  add column if not exists data_entrega_real     date,
  add column if not exists quantidade_divergente boolean not null default false,
  add column if not exists houve_devolucao       boolean not null default false;
/*
create or replace view public.vw_fornecedor_scorecard as
with entregas as (
  select
    p.company_id,
    p.fornecedor_id,
    count(*) filter (where p.data_entrega_real is not null)                        as entregas_total,
    count(*) filter (where p.data_entrega_real <= p.data_entrega_prevista)          as entregas_no_prazo,
    avg(p.data_entrega_real - p.data_entrega_prevista)
      filter (where p.data_entrega_real is not null)                               as atraso_medio_dias,
    count(*) filter (where p.houve_devolucao)                                      as devolucoes,
    count(*) filter (where p.quantidade_divergente)                                as divergencias,
    sum(p.valor)                                                                   as volume_total
  from public.pedidos p
  where p.status in ('CONFIRMADO','RECEBIDO')
    and p.data >= current_date - interval '365 days'
  group by p.company_id, p.fornecedor_id
),
competitividade as (
  -- Quanto o preço do fornecedor desvia da mediana de mercado do MESMO insumo
  select
    ph.company_id,
    ph.fornecedor_id,
    avg((ph.valor_canonico - vr.mediana) / nullif(vr.mediana,0)) as desvio_medio_preco,
    count(*)                                                    as itens_comparaveis
  from public.precos_historicos ph
  join public.vw_preco_referencia vr
    on vr.insumo_canonico_id = ph.insumo_canonico_id
   and vr.company_id = ph.company_id
  where ph.data >= current_date - interval '180 days'
    and ph.valor_canonico is not null
  group by ph.company_id, ph.fornecedor_id
),
resposta as (
  select
    cf.company_id,
    cf.fornecedor_id,
    count(*)                                                        as convites,
    count(*) filter (where cf.respondeu)                            as respostas
  from public.vw_cotacao_fornecedor_resposta cf
  group by cf.company_id, cf.fornecedor_id
)
select
  f.id                                              as fornecedor_id,
  f.company_id,
  f.nome,
  f.categoria,
  coalesce(e.entregas_total, 0)                     as entregas_12m,
  case when coalesce(e.entregas_total,0) = 0 then null
       else round(100.0 * e.entregas_no_prazo / e.entregas_total, 1) end
                                                    as pontualidade_pct,
  round(coalesce(e.atraso_medio_dias, 0), 1)        as atraso_medio_dias,
  coalesce(e.devolucoes, 0)                         as devolucoes_12m,
  coalesce(e.divergencias, 0)                       as divergencias_12m,
  coalesce(e.volume_total, 0)                       as volume_12m,
  round(coalesce(c.desvio_medio_preco, 0) * 100, 2) as desvio_preco_pct,
  coalesce(c.itens_comparaveis, 0)                  as itens_comparaveis,
  case when coalesce(r.convites,0) = 0 then null
       else round(100.0 * r.respostas / r.convites, 1) end
                                                    as taxa_resposta_pct,
  -- Score 0-100. Pesos explícitos e auditáveis — o cliente PODE discordar,
  -- e por isso ficam visíveis na tela, não escondidos num modelo.
  round(
      0.40 * coalesce(case when e.entregas_total > 0
                           then 100.0 * e.entregas_no_prazo / e.entregas_total end, 60)
    + 0.30 * greatest(0, least(100, 100 - coalesce(c.desvio_medio_preco,0) * 300))
    + 0.15 * coalesce(case when r.convites > 0
                           then 100.0 * r.respostas / r.convites end, 60)
    + 0.15 * greatest(0, 100 - coalesce(e.devolucoes,0) * 10 - coalesce(e.divergencias,0) * 5)
  , 1)                                              as score
from public.fornecedores f
left join entregas        e on e.fornecedor_id = f.id and e.company_id = f.company_id
left join competitividade c on c.fornecedor_id = f.id and c.company_id = f.company_id
left join resposta        r on r.fornecedor_id = f.id and r.company_id = f.company_id
where f.status = 'ATIVO';
*/
-- NOTA: `vw_cotacao_fornecedor_resposta` depende do schema real de
-- cotacao_fornecedores/cotacao_precos, que você vai versionar com `db pull`.
-- Definição esperada (ajuste os nomes de coluna após o pull):
--
-- create or replace view public.vw_cotacao_fornecedor_resposta as
-- select cf.id, c.company_id, cf.fornecedor_id,
--        exists (select 1 from public.cotacao_precos cp
--                 where cp.cotacao_fornecedor_id = cf.id
--                   and cp.valor_unitario > 0) as respondeu
-- from public.cotacao_fornecedores cf
-- join public.cotacoes c on c.id = cf.cotacao_id;


-- ============================================================================
-- §7 — TRILHA DE EVENTOS (auditoria + memória do agente)
-- Append-only. Serve para (a) compliance B2B e (b) contexto temporal da IA:
-- "o preço deste item mudou 3 vezes em 40 dias, sempre para cima".
-- ============================================================================

create table if not exists public.eventos (
  id           bigint generated always as identity primary key,
  company_id   uuid not null references public.companies(id) on delete cascade,
  actor_id     uuid references public.users(id) on delete set null,
  entidade     text not null,          -- 'pedido','orcamento','cotacao_preco',...
  entidade_id  uuid,
  acao         text not null,          -- 'criado','atualizado','aprovado','cancelado'
  diff         jsonb,                  -- { campo: {de, para} }
  metadata     jsonb not null default '{}'::jsonb,
  ocorrido_em  timestamptz not null default now()
);

create index if not exists idx_eventos_company_tempo on public.eventos(company_id, ocorrido_em desc);
create index if not exists idx_eventos_entidade      on public.eventos(entidade, entidade_id, ocorrido_em desc);

-- Trigger genérica de auditoria — aplicar nas tabelas sensíveis
create or replace function public.registrar_evento()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_diff jsonb := '{}'::jsonb;
  v_acao text;
  k text;
begin
  if tg_op = 'INSERT' then
    v_acao := 'criado';
    v_diff := to_jsonb(new);
  elsif tg_op = 'UPDATE' then
    v_acao := 'atualizado';
    for k in select jsonb_object_keys(to_jsonb(new)) loop
      if to_jsonb(new)->k is distinct from to_jsonb(old)->k
         and k not in ('updated_at','created_at') then
        v_diff := v_diff || jsonb_build_object(k, jsonb_build_object(
          'de',   to_jsonb(old)->k,
          'para', to_jsonb(new)->k));
      end if;
    end loop;
    if v_diff = '{}'::jsonb then return new; end if;
  else
    v_acao := 'excluido';
    v_diff := to_jsonb(old);
  end if;

  insert into public.eventos (company_id, actor_id, entidade, entidade_id, acao, diff)
  values (
    coalesce((to_jsonb(coalesce(new, old))->>'company_id')::uuid, null),
    auth.uid(),
    tg_table_name,
    (to_jsonb(coalesce(new, old))->>'id')::uuid,
    v_acao,
    v_diff
  );
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['pedidos','orcamentos','medicoes','lancamentos','obras','fornecedores']
  loop
    execute format('drop trigger if exists trg_evento_%1$s on public.%1$s', t);
    execute format($f$
      create trigger trg_evento_%1$s
        after insert or update or delete on public.%1$s
        for each row execute function public.registrar_evento()
    $f$, t);
  end loop;
end $$;


-- ============================================================================
-- §8 — FILA DE SUGESTÕES DA IA  ⭐ PADRÃO CENTRAL DE UX
--
-- Princípio inegociável: A IA NUNCA EXECUTA. A IA SUGERE, O HUMANO ACEITA.
--
-- Um ERP que faz pedido sozinho não é vendável — o engenheiro responde com o
-- CREA dele pelo que sai da obra. Toda saída de IA vira uma linha aqui, com
-- justificativa, e passa por aprovação. Isso também gera o dado de feedback
-- (aceita/rejeitada) que você usa depois para medir a precisão do sistema.
-- ============================================================================

create table if not exists public.sugestoes_ia (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  obra_id       uuid references public.obras(id) on delete cascade,
  tipo          text not null check (tipo in (
                  'insumo_complementar',    -- comprou piso, faltou rejunte
                  'preco_anomalo',          -- 18% acima da mediana 90d
                  'fornecedor_risco',       -- atrasando / score caindo
                  'compra_sem_cotacao',     -- pedido acima do limite sem 3 cotações
                  'estouro_orcamento',      -- comprado > previsto no item
                  'item_sem_medicao',       -- serviço executado e não medido
                  'contrato_vencendo',
                  'saldo_critico'           -- estoque abaixo do consumo previsto
                )),
  severidade    text not null default 'media' check (severidade in ('baixa','media','alta','critica')),
  titulo        text not null,
  descricao     text not null,             -- linguagem natural, gerada por LLM
  -- Números SEMPRE vêm de SQL, nunca do LLM. O payload é a prova.
  payload       jsonb not null default '{}'::jsonb,
  entidade      text,
  entidade_id   uuid,
  economia_estimada numeric(14,2),
  status        text not null default 'nova'
                check (status in ('nova','vista','aceita','rejeitada','expirada')),
  motivo_rejeicao text,
  resolvido_por uuid references public.users(id) on delete set null,
  resolvido_em  timestamptz,
  expira_em     timestamptz,
  gerado_por    text not null default 'radar',   -- qual rotina gerou
  hash_dedupe   text,                            -- evita sugerir a mesma coisa 40x
  created_at    timestamptz not null default now()
);

create index if not exists idx_sug_company_status
  on public.sugestoes_ia(company_id, status, severidade, created_at desc);
create unique index if not exists uq_sug_dedupe
  on public.sugestoes_ia(company_id, hash_dedupe)
  where status in ('nova','vista');


-- ============================================================================
-- §9 — DOCUMENTOS + RAG (memória documental da obra)
-- Contratos, ART, memoriais, diários, e-mails, notas. É o que permite
-- perguntar "o contrato prevê SPDA?" e receber a cláusula com a página.
-- ============================================================================

create table if not exists public.documentos (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  obra_id      uuid references public.obras(id) on delete cascade,
  tipo         text not null default 'outro' check (tipo in (
                 'contrato','aditivo','projeto','memorial','art','nota_fiscal',
                 'diario','medicao','email','laudo','outro')),
  nome         text not null,
  storage_path text not null,               -- bucket privado do Supabase Storage
  mime         text,
  tamanho_bytes bigint,
  paginas      integer,
  metadata     jsonb not null default '{}'::jsonb,
  indexado_em  timestamptz,
  criado_por   uuid references public.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists idx_documentos_obra on public.documentos(obra_id, tipo);

create table if not exists public.documento_chunks (
  id            bigint generated always as identity primary key,
  documento_id  uuid not null references public.documentos(id) on delete cascade,
  company_id    uuid not null references public.companies(id) on delete cascade,
  ordem         integer not null,
  pagina        integer,
  conteudo      text not null,
  embedding     vector(384),
  created_at    timestamptz not null default now()
);

create index if not exists idx_chunks_documento on public.documento_chunks(documento_id, ordem);
create index if not exists idx_chunks_embedding
  on public.documento_chunks using hnsw (embedding vector_cosine_ops);


-- ============================================================================
-- §10 — RPC DE BUSCA SEMÂNTICA
-- SECURITY INVOKER: a RLS do usuário continua valendo dentro da função.
-- É isso que garante que o agente de IA NÃO consegue ler dados de outro tenant,
-- por construção — não por prompt, não por confiança no modelo.
-- ============================================================================

create or replace function public.buscar_insumo_semantico(
  p_embedding  vector(384),
  p_company    uuid,
  p_limite     integer default 5,
  p_similaridade_min real default 0.60
)
returns table (
  id          uuid,
  descricao   text,
  unidade     text,
  categoria   text,
  similaridade real
)
language sql stable security invoker as $$
  select ic.id, ic.descricao, ic.unidade, ic.categoria,
         (1 - (ic.embedding <=> p_embedding))::real as similaridade
  from public.insumos_canonicos ic
  where ic.ativo
    and ic.embedding is not null
    and (ic.company_id is null or ic.company_id = p_company)
    and (1 - (ic.embedding <=> p_embedding)) >= p_similaridade_min
  order by ic.embedding <=> p_embedding
  limit p_limite;
$$;

create or replace function public.buscar_documento_semantico(
  p_embedding vector(384),
  p_company   uuid,
  p_obra      uuid default null,
  p_limite    integer default 8
)
returns table (
  chunk_id      bigint,
  documento_id  uuid,
  documento_nome text,
  tipo          text,
  pagina        integer,
  conteudo      text,
  similaridade  real
)
language sql stable security invoker as $$
  select dc.id, d.id, d.nome, d.tipo, dc.pagina, dc.conteudo,
         (1 - (dc.embedding <=> p_embedding))::real
  from public.documento_chunks dc
  join public.documentos d on d.id = dc.documento_id
  where dc.company_id = p_company
    and (p_obra is null or d.obra_id = p_obra)
    and dc.embedding is not null
  order by dc.embedding <=> p_embedding
  limit p_limite;
$$;


-- ============================================================================
-- §11 — RLS DAS TABELAS NOVAS
-- ============================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'precos_historicos','estoque_movimentos','sugestoes_ia',
    'documentos','documento_chunks','orcamento_item_composicao'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%1$s_select" on public.%1$s', t);
    execute format('drop policy if exists "%1$s_write"  on public.%1$s', t);
    execute format($f$
      create policy "%1$s_select" on public.%1$s
        for select using (public.pode_ler(company_id))
    $f$, t);
    execute format($f$
      create policy "%1$s_write" on public.%1$s
        for all using (public.can_write_company(company_id))
             with check (public.can_write_company(company_id))
    $f$, t);
  end loop;
end $$;

-- Catálogo: linhas globais (company_id IS NULL) são legíveis por todos,
-- mas graváveis apenas por admin_global.
alter table public.insumos_canonicos enable row level security;
drop policy if exists "insumos_can_select" on public.insumos_canonicos;
create policy "insumos_can_select" on public.insumos_canonicos
  for select using (company_id is null or public.pode_ler(company_id));

drop policy if exists "insumos_can_write" on public.insumos_canonicos;
create policy "insumos_can_write" on public.insumos_canonicos
  for all using (
    case when company_id is null then public.is_admin_global()
         else public.can_write_company(company_id) end
  ) with check (
    case when company_id is null then public.is_admin_global()
         else public.can_write_company(company_id) end
  );

alter table public.composicoes enable row level security;
drop policy if exists "composicoes_select" on public.composicoes;
create policy "composicoes_select" on public.composicoes
  for select using (company_id is null or public.pode_ler(company_id));
drop policy if exists "composicoes_write" on public.composicoes;
create policy "composicoes_write" on public.composicoes
  for all using (
    case when company_id is null then public.is_admin_global()
         else public.can_write_company(company_id) end
  ) with check (
    case when company_id is null then public.is_admin_global()
         else public.can_write_company(company_id) end
  );

alter table public.composicao_itens enable row level security;
drop policy if exists "composicao_itens_select" on public.composicao_itens;
create policy "composicao_itens_select" on public.composicao_itens
  for select using (exists (
    select 1 from public.composicoes c
    where c.id = composicao_id
      and (c.company_id is null or public.pode_ler(c.company_id))
  ));

alter table public.insumo_aliases enable row level security;
drop policy if exists "insumo_aliases_select" on public.insumo_aliases;
create policy "insumo_aliases_select" on public.insumo_aliases
  for select using (company_id is null or public.pode_ler(company_id));
drop policy if exists "insumo_aliases_write" on public.insumo_aliases;
create policy "insumo_aliases_write" on public.insumo_aliases
  for all using (public.can_write_company(company_id))
       with check (public.can_write_company(company_id));

-- eventos: somente leitura para membros; escrita apenas via trigger
alter table public.eventos enable row level security;
drop policy if exists "eventos_select" on public.eventos;
create policy "eventos_select" on public.eventos
  for select using (public.pode_ler(company_id));


-- ============================================================================
-- §12 — ALIMENTAÇÃO AUTOMÁTICA DO HISTÓRICO DE PREÇOS
-- Todo preço real que entra no sistema vira uma linha em precos_historicos.
-- Sem isso o catálogo é um cadastro morto.
-- ============================================================================

create or replace function public.capturar_preco_pedido_item()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_pedido       public.pedidos%rowtype;
  v_canonico     uuid;
  v_fator        numeric := 1;
begin
  select * into v_pedido from public.pedidos where id = new.pedido_id;
  if not found then return new; end if;

  -- Tenta resolver o insumo canônico via apelido já confirmado
  select ia.insumo_canonico_id, ia.fator_conversao
    into v_canonico, v_fator
  from public.insumo_aliases ia
  where ia.company_id = v_pedido.company_id
    and ia.descricao_norm = lower(unaccent_imut(new.descricao))
  order by ia.confirmado desc, ia.confianca desc nulls last
  limit 1;

  insert into public.precos_historicos (
    company_id, insumo_canonico_id, fornecedor_id, obra_id,
    origem, origem_id, descricao_original, data,
    quantidade, valor_unitario, valor_canonico
  ) values (
    v_pedido.company_id, v_canonico, v_pedido.fornecedor_id, v_pedido.obra_id,
    'pedido', new.pedido_id, new.descricao, coalesce(v_pedido.data, current_date),
    new.quantidade, new.valor_unitario,
    case when v_canonico is not null and coalesce(v_fator,0) <> 0
         then new.valor_unitario / v_fator end
  );
  return new;
end $$;

drop trigger if exists trg_preco_pedido_item on public.pedido_itens;
create trigger trg_preco_pedido_item
  after insert on public.pedido_itens
  for each row execute function public.capturar_preco_pedido_item();


-- ============================================================================
-- §13 — unaccent imutável (necessário para índice em coluna gerada)
-- ============================================================================
create extension if not exists unaccent;

create or replace function public.unaccent_imut(text)
returns text language sql immutable strict parallel safe as $$
  select public.unaccent('public.unaccent', $1);
$$;

commit;

-- ============================================================================
-- PÓS-MIGRATION
--
-- 1. Regenerar tipos:
--      npx supabase gen types typescript --linked > src/core/supabase/database.types.ts
--
-- 2. Popular o catálogo canônico. Comece pequeno: os 200 insumos que a ZBuild
--    mais compra. Extraia de precos_historicos após backfill, ou importe a
--    lista de insumos SINAPI do seu estado.
--
-- 3. Gerar os embeddings dos insumos (Edge Function `indexar-catalogo`,
--    arquivo 03 §2).
--
-- 4. Só DEPOIS de popular, recriar o índice HNSW:
--      reindex index concurrently idx_insumos_can_embedding;
--
-- 5. Cadastrar as 20 composições mais usadas. Sugestão de partida:
--    alvenaria de bloco, contrapiso, revestimento cerâmico, pintura látex,
--    laje treliçada, forro de gesso, instalação de porta, impermeabilização.
-- ============================================================================
