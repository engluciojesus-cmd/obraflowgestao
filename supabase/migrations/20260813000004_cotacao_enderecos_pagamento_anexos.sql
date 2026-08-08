-- ============================================================================
-- A cotação passa a carregar o que a OC precisa herdar.
--
-- Hoje a OC nasce quase vazia (condição de pagamento derivada de um prazo em
-- dias, endereço nenhum) porque a cotação não captura nada disso — o comprador
-- teria que redigitar depois, por ordem, para cada fornecedor.
--
-- Espelha o fluxo do Obra Prima: os dados de entrega, cobrança e pagamento são
-- decididos na cotação (valem para a compra inteira) e descem para cada OC
-- gerada a partir dela.
-- ============================================================================

begin;

-- ============================================================================
-- §1 — ENDEREÇOS (entrega e cobrança)
--
-- Colunas com prefixo em vez de tabela separada: são no máximo dois endereços
-- por cotação, sempre lidos junto com ela. Uma tabela filha custaria um join
-- em toda leitura para modelar uma cardinalidade que é fixa.
-- ============================================================================

alter table public.cotacoes
  -- 'empresa' ou 'cliente' — quem recebe. Espelha o campo "Local" do modelo.
  add column if not exists entrega_local       text,
  add column if not exists entrega_cep         text,
  add column if not exists entrega_logradouro  text,
  add column if not exists entrega_numero      text,
  add column if not exists entrega_complemento text,
  add column if not exists entrega_bairro      text,
  add column if not exists entrega_cidade      text,
  add column if not exists entrega_uf          text,
  add column if not exists entrega_recebedor   text,

  add column if not exists cobranca_local       text,
  add column if not exists cobranca_cep         text,
  add column if not exists cobranca_logradouro  text,
  add column if not exists cobranca_numero      text,
  add column if not exists cobranca_complemento text,
  add column if not exists cobranca_bairro      text,
  add column if not exists cobranca_cidade      text,
  add column if not exists cobranca_uf          text,

-- ============================================================================
-- §2 — PAGAMENTO E FATURAMENTO
-- Valem para a cotação inteira; a condição por fornecedor continua em
-- cotacao_fornecedores (cada um oferece a sua, e é isso que o mapa compara).
-- ============================================================================
  add column if not exists faturamento_para     text,   -- 'empresa' | 'cliente'
  add column if not exists lancamento_financeiro text,  -- 'no_recebimento' | 'antes'
  add column if not exists forma_pagamento      text,
  add column if not exists previsao_entrega     date,
  add column if not exists responsavel_id       uuid references public.users(id) on delete set null;

-- ============================================================================
-- §3 — ANEXOS
-- Um registro por arquivo; o binário vive no Storage. `escopo` deixa a mesma
-- tabela servir cotação e OC sem duplicar estrutura.
-- ============================================================================

create table if not exists public.anexos_compra (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  escopo       text not null check (escopo in ('cotacao', 'ordem_compra')),
  cotacao_id   uuid references public.cotacoes(id) on delete cascade,
  ordem_id     uuid references public.ordens_compra(id) on delete cascade,
  nome         text not null,
  caminho      text not null,          -- path dentro do bucket
  tamanho      bigint,
  mime_type    text,
  enviado_por  uuid references public.users(id) on delete set null,
  created_at   timestamptz not null default now(),

  -- O escopo tem que casar com o vínculo preenchido, senão um anexo de cotação
  -- poderia apontar para uma OC e sumir das duas telas.
  constraint anexo_vinculo_coerente check (
    (escopo = 'cotacao'       and cotacao_id is not null and ordem_id is null) or
    (escopo = 'ordem_compra'  and ordem_id  is not null and cotacao_id is null)
  )
);

create index if not exists idx_anexos_compra_cotacao on public.anexos_compra(cotacao_id);
create index if not exists idx_anexos_compra_ordem   on public.anexos_compra(ordem_id);

alter table public.anexos_compra enable row level security;

drop policy if exists anexos_compra_select on public.anexos_compra;
create policy anexos_compra_select on public.anexos_compra
  for select using (public.is_admin_global() or company_id in (select public.my_company_ids()));

drop policy if exists anexos_compra_write on public.anexos_compra;
create policy anexos_compra_write on public.anexos_compra
  for all using (public.can_write_company(company_id))
  with check (public.can_write_company(company_id));

-- ---------- Bucket ----------

-- Privado: anexo de compra tem preço e condição comercial. O acesso é por URL
-- assinada de curta duração, não por link permanente.
insert into storage.buckets (id, name, public)
values ('anexos-compra', 'anexos-compra', false)
on conflict (id) do nothing;

-- Primeiro segmento do path é o company_id — é o que amarra o arquivo à
-- empresa sem precisar consultar a tabela de anexos a cada operação.
drop policy if exists anexos_compra_storage_ler on storage.objects;
create policy anexos_compra_storage_ler on storage.objects
  for select to authenticated
  using (
    bucket_id = 'anexos-compra'
    and (storage.foldername(name))[1] in (select public.my_company_ids()::text)
  );

drop policy if exists anexos_compra_storage_escrever on storage.objects;
create policy anexos_compra_storage_escrever on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'anexos-compra'
    and public.can_write_company(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists anexos_compra_storage_apagar on storage.objects;
create policy anexos_compra_storage_apagar on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'anexos-compra'
    and public.can_write_company(((storage.foldername(name))[1])::uuid)
  );

commit;
