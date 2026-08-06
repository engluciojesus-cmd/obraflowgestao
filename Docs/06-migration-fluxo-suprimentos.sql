-- ============================================================================
-- OBRAFLOW — MIGRATION: FLUXO DE SUPRIMENTOS
-- Arquivo: supabase/migrations/20260811000000_fluxo_suprimentos.sql
--
-- Requisição → Cotação → Ordem de Compra → Recebimento → Financeiro
--
-- PRINCÍPIO CENTRAL: o status vive no ITEM (requisicao_itens.status).
-- O status do documento é DERIVADO por trigger, nunca digitado.
--
-- ✅ Validado contra o schema real (projeto qvunifarckesfnfhyzfu, 2026-08-06)
-- via information_schema.columns. Correções já aplicadas neste arquivo:
--   - ordem_compra_itens: a FK para a ordem é `ordem_compra_id`, não `ordem_id`
--     (5 ocorrências corrigidas em §6, §7, §9.4, §9.6).
--   - cotacoes.numero e ordens_compra.numero são `integer`, não `text` — as
--     RPCs agora inserem o bigint puro em vez de lpad(...::text,...) (§9.1,
--     §9.4, §9.6). O padding para exibição continua no front-end.
--   - Havia 1 cotação de teste com status='ABERTA' (vocabulário antigo);
--     normalizada para 'NOVA' antes do novo CHECK constraint (§5).
--   - comprar_direto() usa coalesce(p_forma_pagamento, 'A definir') porque
--     ordens_compra.condicao_pagamento é NOT NULL sem default.
-- ============================================================================

begin;

-- ============================================================================
-- §1 — PROCESSO DE COMPRA (o fio que atravessa tudo)
-- ============================================================================

create table if not exists public.processos_compra (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  numero_processo text not null,                 -- "2026-0001"
  ano             integer not null default extract(year from current_date),
  sequencial      bigint not null,
  obra_id         uuid references public.obras(id) on delete set null,
  origem          text not null default 'requisicao'
                  check (origem in ('requisicao','oc_avulsa','contrato')),
  criado_por      uuid references public.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  unique (company_id, numero_processo)
);

create index if not exists idx_processos_company on public.processos_compra(company_id, created_at desc);
create index if not exists idx_processos_obra    on public.processos_compra(obra_id);


-- ============================================================================
-- §2 — SEQUÊNCIAS POR EMPRESA (corrige a race condition do "order desc limit 1")
-- ============================================================================

create table if not exists public.sequencias (
  company_id uuid   not null references public.companies(id) on delete cascade,
  entidade   text   not null,      -- 'processo','requisicao','cotacao','ordem_compra','lancamento'
  valor      bigint not null default 0,
  primary key (company_id, entidade)
);

create or replace function public.proximo_numero(p_company uuid, p_entidade text)
returns bigint language plpgsql security definer set search_path = public as $$
declare v bigint;
begin
  insert into public.sequencias (company_id, entidade, valor)
  values (p_company, p_entidade, 1)
  on conflict (company_id, entidade)
    do update set valor = public.sequencias.valor + 1
  returning valor into v;
  return v;
end $$;

-- Cria um processo novo já numerado
create or replace function public.criar_processo(
  p_company uuid,
  p_obra    uuid default null,
  p_origem  text default 'requisicao'
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_seq bigint;
  v_id  uuid;
begin
  v_seq := public.proximo_numero(p_company, 'processo');
  insert into public.processos_compra
    (company_id, numero_processo, ano, sequencial, obra_id, origem, criado_por)
  values (
    p_company,
    extract(year from current_date)::text || '-' || lpad(v_seq::text, 4, '0'),
    extract(year from current_date), v_seq, p_obra, p_origem, auth.uid()
  )
  returning id into v_id;
  return v_id;
end $$;


-- ============================================================================
-- §3 — REQUISIÇÃO (a antiga tela "Itens")
-- ============================================================================

create table if not exists public.requisicoes (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies(id) on delete cascade,
  processo_id      uuid references public.processos_compra(id) on delete set null,
  numero           text not null,                -- "000616"
  obra_id          uuid references public.obras(id) on delete set null,
  solicitante_id   uuid references public.users(id) on delete set null,
  descricao        text,
  data_solicitacao timestamptz not null default now(),
  data_necessidade date,
  observacao       text,
  -- DERIVADO por trigger a partir dos itens — nunca escrever direto
  status           text not null default 'RASCUNHO'
                   check (status in ('RASCUNHO','ABERTA','PARCIAL','COTADA',
                                     'OC_GERADA','CONTRATO_GERADO','ATENDIDA',
                                     'REJEITADA','CANCELADA')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (company_id, numero)
);

create index if not exists idx_requisicoes_company on public.requisicoes(company_id, status, created_at desc);
create index if not exists idx_requisicoes_obra    on public.requisicoes(obra_id);
create index if not exists idx_requisicoes_proc    on public.requisicoes(processo_id);

-- ---------- ITENS: aqui mora o estado real ----------
create table if not exists public.requisicao_itens (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references public.companies(id) on delete cascade,
  requisicao_id      uuid not null references public.requisicoes(id) on delete cascade,
  insumo_canonico_id uuid references public.insumos_canonicos(id) on delete set null,
  orcamento_item_id  uuid references public.orcamento_itens(id) on delete set null,
  descricao          text not null,
  quantidade         numeric(14,4) not null check (quantidade > 0),
  unidade            text not null default 'un',
  observacao         text,
  ordem              integer not null default 0,

  -- ⭐ FONTE DA VERDADE DO FLUXO
  status             text not null default 'ABERTA'
                     check (status in ('RASCUNHO','ABERTA','EM_COTACAO','COTADA',
                                       'EM_OC','RECEBIDO_PARCIAL','RECEBIDA',
                                       'REJEITADA','CANCELADA')),
  quantidade_atendida numeric(14,4) not null default 0,
  motivo_cancelamento text,
  cancelado_por       uuid references public.users(id) on delete set null,
  cancelado_em        timestamptz,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists idx_req_itens_requisicao on public.requisicao_itens(requisicao_id, ordem);
create index if not exists idx_req_itens_status     on public.requisicao_itens(company_id, status);
create index if not exists idx_req_itens_insumo     on public.requisicao_itens(insumo_canonico_id);


-- ============================================================================
-- §4 — VALIDAÇÃO DA MÁQUINA DE ESTADO (no banco, não no front)
-- ============================================================================

create or replace function public.validar_transicao_item()
returns trigger language plpgsql as $$
declare
  ok boolean := false;
begin
  if tg_op = 'INSERT' or old.status = new.status then
    return new;
  end if;

  ok := case old.status
    when 'RASCUNHO'         then new.status in ('ABERTA','CANCELADA')
    when 'ABERTA'           then new.status in ('EM_COTACAO','EM_OC','REJEITADA','CANCELADA')
    when 'EM_COTACAO'       then new.status in ('COTADA','ABERTA','CANCELADA')
    when 'COTADA'           then new.status in ('EM_OC','ABERTA','CANCELADA')
    when 'EM_OC'            then new.status in ('RECEBIDO_PARCIAL','RECEBIDA','ABERTA','CANCELADA')
    when 'RECEBIDO_PARCIAL' then new.status in ('RECEBIDA','CANCELADA')
    when 'RECEBIDA'         then false
    when 'REJEITADA'        then new.status in ('ABERTA','CANCELADA')
    when 'CANCELADA'        then new.status in ('ABERTA')
    else false
  end;

  if not ok then
    raise exception 'Transição inválida: % → % (item %)', old.status, new.status, new.id
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

drop trigger if exists trg_validar_transicao_item on public.requisicao_itens;
create trigger trg_validar_transicao_item
  before update on public.requisicao_itens
  for each row execute function public.validar_transicao_item();


-- ---------- STATUS DA REQUISIÇÃO DERIVADO DOS ITENS ----------
create or replace function public.recalcular_status_requisicao()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_req uuid := coalesce(new.requisicao_id, old.requisicao_id);
  n_total int; n_rascunho int; n_aberta int; n_cotacao int;
  n_oc int; n_recebida int; n_morta int;
  v_novo text;
begin
  select count(*),
         count(*) filter (where status = 'RASCUNHO'),
         count(*) filter (where status = 'ABERTA'),
         count(*) filter (where status in ('EM_COTACAO','COTADA')),
         count(*) filter (where status in ('EM_OC','RECEBIDO_PARCIAL')),
         count(*) filter (where status = 'RECEBIDA'),
         count(*) filter (where status in ('CANCELADA','REJEITADA'))
    into n_total, n_rascunho, n_aberta, n_cotacao, n_oc, n_recebida, n_morta
  from public.requisicao_itens where requisicao_id = v_req;

  if n_total = 0 then
    return coalesce(new, old);
  end if;

  v_novo := case
    when n_morta    = n_total then 'CANCELADA'
    when n_rascunho = n_total then 'RASCUNHO'
    when n_recebida + n_morta = n_total then 'ATENDIDA'
    when n_aberta   = n_total then 'ABERTA'
    when n_oc > 0 and n_aberta = 0 and n_cotacao = 0 then 'OC_GERADA'
    when n_cotacao > 0 and n_aberta = 0 and n_oc = 0 then 'COTADA'
    else 'PARCIAL'
  end;

  update public.requisicoes
     set status = v_novo, updated_at = now()
   where id = v_req and status is distinct from v_novo;

  return coalesce(new, old);
end $$;

drop trigger if exists trg_status_requisicao on public.requisicao_itens;
create trigger trg_status_requisicao
  after insert or update of status or delete on public.requisicao_itens
  for each row execute function public.recalcular_status_requisicao();


-- ============================================================================
-- §5 — COTAÇÕES: acrescentar o que falta
-- ============================================================================

alter table public.cotacoes
  add column if not exists processo_id   uuid references public.processos_compra(id) on delete set null,
  add column if not exists requisicao_id uuid references public.requisicoes(id) on delete set null,
  add column if not exists data_limite   date,
  add column if not exists observacao    text;

-- Normaliza status legado ("ABERTA"/"FECHADA") para o novo vocabulário antes
-- de trocar o CHECK constraint, senão o ALTER abaixo aborta em dado existente.
update public.cotacoes set status = 'NOVA' where status = 'ABERTA';
update public.cotacoes set status = 'CANCELADA' where status = 'FECHADA';

-- Status alinhado ao Obra Prima
alter table public.cotacoes drop constraint if exists cotacoes_status_check;
alter table public.cotacoes
  add constraint cotacoes_status_check check (status in (
    'NOVA','ENVIADA','PENDENTE_REENVIO','RESPONDIDA_PARCIAL','RESPONDIDA',
    'OC_PARCIAL','OC_GERADA','CONTRATO_PARCIAL','CONTRATO_GERADO','CANCELADA'));

-- Liga o item de cotação ao item de requisição (rastreabilidade)
alter table public.cotacao_itens
  add column if not exists requisicao_item_id uuid references public.requisicao_itens(id) on delete set null,
  add column if not exists company_id uuid references public.companies(id) on delete cascade;

create index if not exists idx_cot_itens_req_item on public.cotacao_itens(requisicao_item_id);

-- Condições comerciais por fornecedor — necessárias para o ranking a valor presente
alter table public.cotacao_fornecedores
  add column if not exists company_id            uuid references public.companies(id) on delete cascade,
  add column if not exists frete                 numeric(14,2) not null default 0,
  add column if not exists desconto_global_pct   numeric(6,3)  not null default 0,
  add column if not exists prazo_pagamento_dias  integer       not null default 0,
  add column if not exists prazo_entrega_dias    integer       not null default 0,
  add column if not exists respondeu             boolean       not null default false,
  add column if not exists respondido_em         timestamptz,
  add column if not exists observacao            text;

alter table public.cotacao_precos
  add column if not exists company_id  uuid references public.companies(id) on delete cascade,
  add column if not exists disponivel  boolean not null default true,
  add column if not exists prazo_dias  integer;


-- ============================================================================
-- §6 — ORDENS DE COMPRA: status completo + saldo por item
-- ============================================================================

alter table public.ordens_compra
  add column if not exists processo_id        uuid references public.processos_compra(id) on delete set null,
  add column if not exists requisicao_id      uuid references public.requisicoes(id) on delete set null,
  add column if not exists data_envio         timestamptz,
  add column if not exists enviado_por        uuid references public.users(id) on delete set null,
  add column if not exists desconto           numeric(14,2) not null default 0,
  add column if not exists avaliacao_prazo    integer check (avaliacao_prazo between 1 and 5),
  add column if not exists avaliacao_qualidade integer check (avaliacao_qualidade between 1 and 5),
  add column if not exists avaliacao_obs      text,
  add column if not exists motivo_cancelamento text,
  add column if not exists endereco_entrega   text;

alter table public.ordens_compra drop constraint if exists ordens_compra_status_check;
alter table public.ordens_compra
  add constraint ordens_compra_status_check check (status in (
    'EM_APROVACAO','NAO_APROVADA','GERADA','ENVIADA','PENDENTE_REENVIO',
    'PROCESSADA','PARCIALMENTE_RECEBIDA','RECEBIDA','RECUSADA','CANCELADA'));

alter table public.ordem_compra_itens
  add column if not exists company_id          uuid references public.companies(id) on delete cascade,
  add column if not exists requisicao_item_id  uuid references public.requisicao_itens(id) on delete set null,
  add column if not exists insumo_canonico_id  uuid references public.insumos_canonicos(id) on delete set null,
  -- ⭐ SALDO: o que permite recebimento parcial
  add column if not exists quantidade_recebida numeric(14,4) not null default 0;

create index if not exists idx_oc_itens_req_item on public.ordem_compra_itens(requisicao_item_id);

-- Percentual recebido (a coluna "Recebidos (%)" com barra de progresso)
create or replace view public.vw_oc_recebimento as
select
  oc.id                                                    as ordem_compra_id,
  oc.company_id,
  coalesce(sum(oci.quantidade), 0)                         as qtd_pedida,
  coalesce(sum(oci.quantidade_recebida), 0)                as qtd_recebida,
  case when coalesce(sum(oci.quantidade),0) = 0 then 0
       else round(100.0 * sum(oci.quantidade_recebida) / sum(oci.quantidade), 2)
  end                                                      as percentual_recebido
from public.ordens_compra oc
left join public.ordem_compra_itens oci on oci.ordem_compra_id = oc.id
group by oc.id, oc.company_id;


-- ============================================================================
-- §7 — RECEBIMENTOS (⭐ 1 OC → N recebimentos → N lançamentos)
-- ============================================================================

create table if not exists public.recebimentos (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies(id) on delete cascade,
  ordem_compra_id   uuid not null references public.ordens_compra(id) on delete cascade,
  processo_id       uuid references public.processos_compra(id) on delete set null,
  sequencia         integer not null default 1,      -- 1º, 2º, 3º recebimento da OC
  data_recebimento  date not null default current_date,
  recebido_por      uuid references public.users(id) on delete set null,

  -- Documento fiscal deste recebimento específico
  documento_numero  text,
  documento_serie   text,
  documento_path    text,                            -- Supabase Storage (bucket privado)
  documento_valor   numeric(14,2),
  chave_nfe         text,

  -- Preenchido pela Edge Function ler-nota
  ocr_payload       jsonb,
  divergencia       jsonb,                           -- {item, oc_valor, nota_valor, diff_pct}
  divergencia_aceita boolean,

  observacao        text,
  created_at        timestamptz not null default now(),
  unique (ordem_compra_id, sequencia)
);

create index if not exists idx_receb_oc      on public.recebimentos(ordem_compra_id, sequencia);
create index if not exists idx_receb_company on public.recebimentos(company_id, data_recebimento desc);

create table if not exists public.recebimento_itens (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references public.companies(id) on delete cascade,
  recebimento_id        uuid not null references public.recebimentos(id) on delete cascade,
  ordem_compra_item_id  uuid not null references public.ordem_compra_itens(id) on delete cascade,
  quantidade            numeric(14,4) not null check (quantidade > 0),
  valor_unitario        numeric(14,4),
  conforme              boolean not null default true,
  observacao            text,
  created_at            timestamptz not null default now()
);

create index if not exists idx_receb_itens on public.recebimento_itens(recebimento_id);


-- ---------- Ao inserir item de recebimento: atualiza saldo e propaga status ----------
create or replace function public.processar_recebimento_item()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_oc_item  public.ordem_compra_itens%rowtype;
  v_novo_rec numeric;
  v_req_item uuid;
  v_oc       uuid;
  n_pend     int;
begin
  select * into v_oc_item from public.ordem_compra_itens where id = new.ordem_compra_item_id;
  if not found then
    raise exception 'Item de ordem de compra não encontrado';
  end if;

  v_novo_rec := v_oc_item.quantidade_recebida + new.quantidade;

  if v_novo_rec > v_oc_item.quantidade * 1.05 then
    raise exception 'Quantidade recebida (%) excede o pedido (%) em mais de 5%%',
      v_novo_rec, v_oc_item.quantidade using errcode = 'check_violation';
  end if;

  update public.ordem_compra_itens
     set quantidade_recebida = v_novo_rec
   where id = new.ordem_compra_item_id;

  -- Propaga para o item de requisição
  v_req_item := v_oc_item.requisicao_item_id;
  if v_req_item is not null then
    update public.requisicao_itens
       set quantidade_atendida = quantidade_atendida + new.quantidade,
           status = case
             when quantidade_atendida + new.quantidade >= quantidade then 'RECEBIDA'
             else 'RECEBIDO_PARCIAL' end,
           updated_at = now()
     where id = v_req_item;
  end if;

  -- Recalcula o status da OC
  v_oc := v_oc_item.ordem_compra_id;
  select count(*) into n_pend
  from public.ordem_compra_itens
  where ordem_compra_id = v_oc and quantidade_recebida < quantidade;

  update public.ordens_compra
     set status = case when n_pend = 0 then 'RECEBIDA' else 'PARCIALMENTE_RECEBIDA' end,
         updated_at = now()
   where id = v_oc
     and status not in ('CANCELADA','RECUSADA');

  return new;
end $$;

drop trigger if exists trg_processar_receb_item on public.recebimento_itens;
create trigger trg_processar_receb_item
  after insert on public.recebimento_itens
  for each row execute function public.processar_recebimento_item();


-- ============================================================================
-- §8 — FINANCEIRO: um lançamento por recebimento
-- ============================================================================

alter table public.lancamentos
  add column if not exists processo_id     uuid references public.processos_compra(id) on delete set null,
  add column if not exists ordem_compra_id uuid references public.ordens_compra(id) on delete set null,
  add column if not exists recebimento_id  uuid references public.recebimentos(id) on delete set null,
  add column if not exists numero          text,
  add column if not exists anexo_path      text,
  add column if not exists documento_numero text,
  add column if not exists data_pagamento  date;

create index if not exists idx_lanc_processo on public.lancamentos(processo_id);
create index if not exists idx_lanc_receb    on public.lancamentos(recebimento_id);


-- ============================================================================
-- §9 — RPCs TRANSACIONAIS
-- SECURITY INVOKER: a RLS do usuário continua valendo dentro da função.
-- ============================================================================

-- ---------- 9.1 Requisição → Cotação (seleção de itens em lote) ----------
create or replace function public.gerar_cotacao_de_itens(
  p_company     uuid,
  p_item_ids    uuid[],
  p_descricao   text default null,
  p_data_limite date default null
)
returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_cotacao uuid;
  v_num     bigint;
  v_proc    uuid;
  v_obra    uuid;
  v_req     uuid;
  r         record;
  v_ordem   int := 0;
begin
  if array_length(p_item_ids, 1) is null then
    raise exception 'Nenhum item selecionado';
  end if;

  select ri.requisicao_id, r2.obra_id, r2.processo_id
    into v_req, v_obra, v_proc
  from public.requisicao_itens ri
  join public.requisicoes r2 on r2.id = ri.requisicao_id
  where ri.id = p_item_ids[1];

  v_num := public.proximo_numero(p_company, 'cotacao');

  insert into public.cotacoes
    (company_id, processo_id, requisicao_id, numero, obra_id, descricao,
     data_limite, status)
  values
    (p_company, v_proc, v_req, v_num, v_obra,
     coalesce(p_descricao, 'Cotação ' || lpad(v_num::text, 6, '0')),
     p_data_limite, 'NOVA')
  returning id into v_cotacao;

  for r in
    select * from public.requisicao_itens
    where id = any(p_item_ids) and status = 'ABERTA'
    order by ordem, created_at
  loop
    v_ordem := v_ordem + 1;
    insert into public.cotacao_itens
      (company_id, cotacao_id, requisicao_item_id, descricao,
       quantidade, unidade, ordem)
    values
      (p_company, v_cotacao, r.id, r.descricao, r.quantidade, r.unidade, v_ordem);

    update public.requisicao_itens set status = 'EM_COTACAO', updated_at = now()
     where id = r.id;
  end loop;

  if v_ordem = 0 then
    raise exception 'Nenhum item elegível (só itens com status ABERTA podem ir para cotação)';
  end if;

  return v_cotacao;
end $$;


-- ---------- 9.2 Puxar mais insumos para uma cotação existente ----------
create or replace function public.adicionar_itens_cotacao(
  p_cotacao_id uuid,
  p_item_ids   uuid[]
)
returns integer language plpgsql security invoker set search_path = public as $$
declare
  v_company uuid;
  v_ordem   int;
  r         record;
  n         int := 0;
begin
  select company_id into v_company from public.cotacoes where id = p_cotacao_id;
  select coalesce(max(ordem), 0) into v_ordem from public.cotacao_itens where cotacao_id = p_cotacao_id;

  for r in
    select * from public.requisicao_itens
    where id = any(p_item_ids) and status = 'ABERTA'
  loop
    v_ordem := v_ordem + 1; n := n + 1;
    insert into public.cotacao_itens
      (company_id, cotacao_id, requisicao_item_id, descricao, quantidade, unidade, ordem)
    values (v_company, p_cotacao_id, r.id, r.descricao, r.quantidade, r.unidade, v_ordem);

    update public.requisicao_itens set status = 'EM_COTACAO', updated_at = now() where id = r.id;
  end loop;

  return n;
end $$;


-- ---------- 9.3 Remover item da cotação (devolve para ABERTA) ----------
create or replace function public.remover_item_cotacao(p_cotacao_item_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare v_req_item uuid;
begin
  select requisicao_item_id into v_req_item
  from public.cotacao_itens where id = p_cotacao_item_id;

  delete from public.cotacao_precos where cotacao_item_id = p_cotacao_item_id;
  delete from public.cotacao_itens  where id = p_cotacao_item_id;

  if v_req_item is not null then
    update public.requisicao_itens set status = 'ABERTA', updated_at = now()
     where id = v_req_item and status in ('EM_COTACAO','COTADA');
  end if;
end $$;


-- ---------- 9.4 Cotação → Ordens de compra (uma por fornecedor escolhido) ----------
create or replace function public.gerar_ordens_da_cotacao(p_cotacao_id uuid)
returns uuid[] language plpgsql security invoker set search_path = public as $$
declare
  v_cot     public.cotacoes%rowtype;
  v_ids     uuid[] := '{}';
  v_oc      uuid;
  v_num     bigint;
  f         record;
  p         record;
  v_total   numeric;
begin
  select * into v_cot from public.cotacoes where id = p_cotacao_id;
  if not found then raise exception 'Cotação não encontrada'; end if;

  -- Um agrupamento por fornecedor que tenha ao menos um preço escolhido
  for f in
    select distinct cf.id as cot_forn_id, cf.fornecedor_id,
           cf.frete, cf.desconto_global_pct, cf.prazo_pagamento_dias, cf.prazo_entrega_dias
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
       f.prazo_pagamento_dias::text || ' dias',
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


-- ---------- 9.5 Confirmar recebimento (gera lançamento financeiro) ----------
create or replace function public.confirmar_recebimento(
  p_ordem_id         uuid,
  p_itens            jsonb,        -- [{"ordem_compra_item_id":"...","quantidade":60}]
  p_documento_numero text default null,
  p_documento_path   text default null,
  p_documento_valor  numeric default null,
  p_data             date default null,
  p_observacao       text default null,
  p_gerar_lancamento boolean default true,
  p_vencimento       date default null
)
returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_oc      public.ordens_compra%rowtype;
  v_receb   uuid;
  v_seq     int;
  v_num     bigint;
  v_valor   numeric := 0;
  it        jsonb;
  v_vu      numeric;
begin
  select * into v_oc from public.ordens_compra where id = p_ordem_id;
  if not found then raise exception 'Ordem de compra não encontrada'; end if;

  select coalesce(max(sequencia), 0) + 1 into v_seq
  from public.recebimentos where ordem_compra_id = p_ordem_id;

  insert into public.recebimentos
    (company_id, ordem_compra_id, processo_id, sequencia, data_recebimento,
     recebido_por, documento_numero, documento_path, documento_valor, observacao)
  values
    (v_oc.company_id, p_ordem_id, v_oc.processo_id, v_seq,
     coalesce(p_data, current_date), auth.uid(),
     p_documento_numero, p_documento_path, p_documento_valor, p_observacao)
  returning id into v_receb;

  for it in select * from jsonb_array_elements(p_itens)
  loop
    select valor_unitario into v_vu
    from public.ordem_compra_itens
    where id = (it->>'ordem_compra_item_id')::uuid;

    insert into public.recebimento_itens
      (company_id, recebimento_id, ordem_compra_item_id, quantidade, valor_unitario)
    values
      (v_oc.company_id, v_receb, (it->>'ordem_compra_item_id')::uuid,
       (it->>'quantidade')::numeric, v_vu);

    v_valor := v_valor + ((it->>'quantidade')::numeric * coalesce(v_vu, 0));
  end loop;

  -- ⭐ Um lançamento POR RECEBIMENTO, com a nota daquele recebimento
  if p_gerar_lancamento then
    v_num := public.proximo_numero(v_oc.company_id, 'lancamento');

    insert into public.lancamentos
      (company_id, processo_id, ordem_compra_id, recebimento_id, numero,
       titulo, fornecedor_id, obra_id, vencimento, valor,
       documento_numero, anexo_path, status)
    values
      (v_oc.company_id, v_oc.processo_id, p_ordem_id, v_receb,
       'FIN-' || lpad(v_num::text, 6, '0'),
       coalesce(p_documento_numero, 'OC ' || v_oc.numero) || ' — recebimento ' || v_seq,
       v_oc.fornecedor_id, v_oc.obra_id,
       coalesce(p_vencimento, current_date + 30),
       coalesce(p_documento_valor, v_valor),
       p_documento_numero, p_documento_path, 'NOTA RECEBIDA');
  end if;

  return v_receb;
end $$;


-- ---------- 9.6 Atalho: "já comprei" — requisição direto para recebida/paga ----------
create or replace function public.comprar_direto(
  p_company        uuid,
  p_item_ids       uuid[],
  p_fornecedor_id  uuid,
  p_valores        jsonb,        -- {"<requisicao_item_id>": 32.50}
  p_forma_pagamento text default null,
  p_ja_recebido    boolean default true,
  p_ja_pago        boolean default false,
  p_documento_numero text default null,
  p_documento_path text default null,
  p_vencimento     date default null
)
returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_oc     uuid;
  v_num    bigint;
  v_proc   uuid;
  v_obra   uuid;
  v_req    uuid;
  v_total  numeric := 0;
  r        record;
  v_vu     numeric;
  v_itens  jsonb := '[]'::jsonb;
  v_oci    uuid;
begin
  select ri.requisicao_id, rq.obra_id, rq.processo_id
    into v_req, v_obra, v_proc
  from public.requisicao_itens ri
  join public.requisicoes rq on rq.id = ri.requisicao_id
  where ri.id = p_item_ids[1];

  v_num := public.proximo_numero(p_company, 'ordem_compra');

  insert into public.ordens_compra
    (company_id, processo_id, requisicao_id, numero, obra_id, fornecedor_id,
     condicao_pagamento, valor, status)
  values
    (p_company, v_proc, v_req, v_num, v_obra, p_fornecedor_id,
     coalesce(p_forma_pagamento, 'A definir'), 0, 'GERADA')
  returning id into v_oc;

  for r in select * from public.requisicao_itens where id = any(p_item_ids)
  loop
    v_vu := coalesce((p_valores ->> r.id::text)::numeric, 0);

    insert into public.ordem_compra_itens
      (company_id, ordem_compra_id, requisicao_item_id, descricao,
       quantidade, unidade, valor_unitario)
    values
      (p_company, v_oc, r.id, r.descricao, r.quantidade, r.unidade, v_vu)
    returning id into v_oci;

    v_total := v_total + (r.quantidade * v_vu);

    update public.requisicao_itens set status = 'EM_OC', updated_at = now() where id = r.id;

    v_itens := v_itens || jsonb_build_object(
      'ordem_compra_item_id', v_oci, 'quantidade', r.quantidade);
  end loop;

  update public.ordens_compra set valor = v_total where id = v_oc;

  if p_ja_recebido then
    perform public.confirmar_recebimento(
      v_oc, v_itens, p_documento_numero, p_documento_path, v_total,
      current_date, 'Compra direta', true, p_vencimento);

    if p_ja_pago then
      update public.lancamentos
         set status = 'PAGA', data_pagamento = current_date
       where ordem_compra_id = v_oc;
    end if;
  end if;

  return v_oc;
end $$;


-- ---------- 9.7 Cancelar item (devolve rastro) ----------
create or replace function public.cancelar_item_requisicao(
  p_item_id uuid,
  p_motivo  text
)
returns void language plpgsql security invoker set search_path = public as $$
begin
  update public.requisicao_itens
     set status = 'CANCELADA',
         motivo_cancelamento = p_motivo,
         cancelado_por = auth.uid(),
         cancelado_em = now(),
         updated_at = now()
   where id = p_item_id;
end $$;


-- ============================================================================
-- §10 — VIEW DE RASTREABILIDADE ("Registros vinculados")
-- ============================================================================

create or replace view public.vw_processo_cadeia as
select
  pc.id                as processo_id,
  pc.company_id,
  pc.numero_processo,
  pc.obra_id,
  r.id                 as requisicao_id,
  r.numero             as requisicao_numero,
  r.status             as requisicao_status,
  c.id                 as cotacao_id,
  c.numero             as cotacao_numero,
  c.status             as cotacao_status,
  oc.id                as ordem_id,
  oc.numero            as ordem_numero,
  oc.status            as ordem_status,
  oc.valor             as ordem_valor,
  rec.id               as recebimento_id,
  rec.sequencia        as recebimento_seq,
  rec.documento_numero,
  l.id                 as lancamento_id,
  l.numero             as lancamento_numero,
  l.status             as lancamento_status,
  l.valor              as lancamento_valor
from public.processos_compra pc
left join public.requisicoes  r   on r.processo_id  = pc.id
left join public.cotacoes     c   on c.processo_id  = pc.id
left join public.ordens_compra oc on oc.processo_id = pc.id
left join public.recebimentos rec on rec.ordem_compra_id = oc.id
left join public.lancamentos  l   on l.recebimento_id = rec.id;


-- ============================================================================
-- §11 — RLS
-- ============================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'processos_compra','requisicoes','requisicao_itens',
    'recebimentos','recebimento_itens','sequencias'
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


-- ============================================================================
-- §12 — TRIGGERS updated_at
-- ============================================================================

do $$
declare t text;
begin
  foreach t in array array['requisicoes','requisicao_itens']
  loop
    execute format('drop trigger if exists update_%1$s_updated_at on public.%1$s', t);
    execute format($f$
      create trigger update_%1$s_updated_at before update on public.%1$s
        for each row execute function public.update_updated_at_column()
    $f$, t);
  end loop;
end $$;

commit;

-- ============================================================================
-- PÓS-MIGRATION
--
-- 1. npm run types
--
-- 2. Inicializar as sequências para as empresas existentes. Semeie 'cotacao'
--    e 'ordem_compra' com o maior número já usado (não 0 fixo), senão a
--    próxima cotação/OC gerada colide com números de dados de teste existentes:
--    insert into public.sequencias (company_id, entidade, valor)
--    select c.id, e.ent,
--      case e.ent
--        when 'cotacao'      then coalesce((select max(numero) from public.cotacoes      where company_id = c.id), 0)
--        when 'ordem_compra' then coalesce((select max(numero) from public.ordens_compra where company_id = c.id), 0)
--        else 0
--      end
--    from public.companies c,
--         unnest(array['processo','requisicao','cotacao','ordem_compra','lancamento']) e(ent)
--    on conflict do nothing;
--
-- 3. Criar o bucket privado de documentos no Supabase Storage:
--    nome: "documentos-compra"
--    público: NÃO
--    policy: apenas membros da empresa (path prefixado por company_id)
--
-- 4. Os dados de teste em `pedidos` podem ser recriados como requisições.
--    Com 1 registro, refazer à mão é mais seguro que script de migração.
--    Depois que as telas migrarem, dropar `pedidos` e `pedido_itens`.
-- ============================================================================
