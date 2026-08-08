-- ============================================================================
-- Link público da Ordem de Compra + os dados que a OC precisa mostrar.
--
-- O comprador gera um link e manda para o fornecedor, que abre a OC sem ter
-- login no sistema. Quem tiver o link vê a OC — é o objetivo, e é por isso que
-- o token é aleatório e longo, e o link só existe depois de gerado
-- explicitamente (OC nenhuma nasce pública).
--
-- Acesso anônimo NÃO passa por policy de RLS na tabela: uma policy que deixasse
-- `anon` ler `ordens_compra` abriria a tabela inteira para quem tem a anon key,
-- que está no bundle do navegador. Em vez disso, uma função SECURITY DEFINER
-- devolve UMA ordem, e só quando o token bate exatamente.
-- ============================================================================

begin;

create extension if not exists pgcrypto;

-- ============================================================================
-- §1 — DADOS DE FATURAMENTO (empresa)
-- A OC diz ao fornecedor em nome de quem emitir a nota. Hoje `companies` só
-- tem nome e CNPJ, então a nota sairia sem endereço.
-- ============================================================================

alter table public.companies
  add column if not exists razao_social      text,
  add column if not exists inscricao_estadual text,
  add column if not exists telefone          text,
  add column if not exists email             text,
  add column if not exists logradouro        text,
  add column if not exists numero            text,
  add column if not exists complemento       text,
  add column if not exists bairro            text,
  add column if not exists cidade            text,
  add column if not exists uf                text,
  add column if not exists cep               text,
  -- "Responsável pela compra": quem o fornecedor procura em caso de dúvida.
  add column if not exists contato_nome      text,
  add column if not exists contato_telefone  text,
  add column if not exists contato_email     text;

update public.companies set razao_social = name where razao_social is null;

-- ============================================================================
-- §2 — ENDEREÇO DE ENTREGA (obra)
-- `ordens_compra.endereco_entrega` já existe e é o que vale na OC; o da obra é
-- o padrão que preenche esse campo na hora de gerar.
-- ============================================================================

alter table public.obras
  add column if not exists endereco_entrega text;

-- `local` é o campo livre que a obra já usava para endereço — vira o padrão
-- de entrega em vez de deixar o comprador redigitar.
update public.obras
   set endereco_entrega = local
 where endereco_entrega is null and coalesce(btrim(local), '') <> '';

-- ============================================================================
-- §3 — CAMPOS DA OC QUE O FORNECEDOR LÊ
-- ============================================================================

alter table public.ordens_compra
  add column if not exists forma_pagamento text,
  add column if not exists parcelas        text,
  add column if not exists token_publico   text unique,
  add column if not exists token_gerado_em timestamptz;

create index if not exists idx_ordens_compra_token
  on public.ordens_compra(token_publico) where token_publico is not null;

-- ============================================================================
-- §4 — GERAR / REVOGAR O LINK (exigem login)
-- ============================================================================

-- `security invoker`: roda com as permissões de quem chamou, então a RLS de
-- ordens_compra é quem decide se este usuário pode publicar esta OC.
create or replace function public.gerar_link_oc(p_ordem_id uuid)
returns text language plpgsql security invoker set search_path = public as $$
declare
  v_token  text;
  v_existe boolean;
begin
  select token_publico, true into v_token, v_existe
  from public.ordens_compra where id = p_ordem_id;

  if not coalesce(v_existe, false) then
    raise exception 'Ordem de compra não encontrada';
  end if;

  -- Idempotente: chamar de novo devolve o mesmo link em vez de invalidar o
  -- que já foi enviado ao fornecedor.
  if v_token is not null then
    return v_token;
  end if;

  -- 32 bytes de entropia. O token é o único segredo protegendo a OC, então
  -- não pode ser sequencial nem derivável do número da ordem.
  v_token := encode(gen_random_bytes(32), 'hex');

  update public.ordens_compra
     set token_publico = v_token, token_gerado_em = now()
   where id = p_ordem_id;

  if not found then
    raise exception 'Sem permissão para publicar esta ordem de compra';
  end if;

  return v_token;
end $$;

create or replace function public.revogar_link_oc(p_ordem_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
begin
  update public.ordens_compra
     set token_publico = null, token_gerado_em = null
   where id = p_ordem_id;

  if not found then
    raise exception 'Sem permissão para revogar esta ordem de compra';
  end if;
end $$;

-- ============================================================================
-- §5 — LEITURA PÚBLICA
-- Devolve só o que o fornecedor precisa ver. Campos internos (preço dos
-- concorrentes, cotação de origem, processo) ficam de fora de propósito.
-- ============================================================================

create or replace function public.oc_publica(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_oc  public.ordens_compra%rowtype;
  v_res jsonb;
begin
  -- Token curto é chute, não link legítimo: corta antes de tocar a tabela.
  if p_token is null or length(p_token) < 32 then
    return null;
  end if;

  select * into v_oc from public.ordens_compra where token_publico = p_token;
  if not found then
    return null;
  end if;

  select jsonb_build_object(
    'numero',             v_oc.numero,
    'created_at',         v_oc.created_at,
    'status',             v_oc.status,
    'condicao_pagamento', v_oc.condicao_pagamento,
    'forma_pagamento',    v_oc.forma_pagamento,
    'parcelas',           v_oc.parcelas,
    'previsao_entrega',   v_oc.previsao_entrega,
    'frete',              v_oc.frete,
    'desconto',           v_oc.desconto,
    'observacao',         v_oc.observacao,
    -- Endereço da OC manda; o da obra é só o padrão de quando ela foi gerada.
    'endereco_entrega',   coalesce(v_oc.endereco_entrega,
                                   (select o.endereco_entrega from public.obras o
                                     where o.id = v_oc.obra_id)),
    'obra',        (select jsonb_build_object('nome', o.nome)
                      from public.obras o where o.id = v_oc.obra_id),
    'fornecedor',  (select jsonb_build_object(
                             'nome',      coalesce(f.razao_social, f.nome),
                             'fantasia',  f.nome_fantasia,
                             'cnpj',      f.cnpj,
                             'vendedor',  f.vendedor_nome,
                             'telefone',  f.vendedor_telefone,
                             'email',     f.vendedor_email)
                      from public.fornecedores f where f.id = v_oc.fornecedor_id),
    'empresa',     (select jsonb_build_object(
                             'nome',        c.name,
                             'razao_social', coalesce(c.razao_social, c.name),
                             'cnpj',        c.cnpj,
                             'ie',          c.inscricao_estadual,
                             'telefone',    c.telefone,
                             'email',       c.email,
                             'logradouro',  c.logradouro,
                             'numero',      c.numero,
                             'complemento', c.complemento,
                             'bairro',      c.bairro,
                             'cidade',      c.cidade,
                             'uf',          c.uf,
                             'cep',         c.cep,
                             'logo_url',    c.logo_url,
                             'contato_nome',     c.contato_nome,
                             'contato_telefone', c.contato_telefone,
                             'contato_email',    c.contato_email)
                      from public.companies c where c.id = v_oc.company_id),
    'itens',       coalesce((
                      select jsonb_agg(jsonb_build_object(
                               'descricao',      i.descricao,
                               'marca',          i.marca,
                               'quantidade',     i.quantidade,
                               'unidade',        i.unidade,
                               'valor_unitario', i.valor_unitario,
                               'ordem',          i.ordem)
                             order by i.ordem)
                        from public.ordem_compra_itens i
                       where i.ordem_compra_id = v_oc.id), '[]'::jsonb)
  ) into v_res;

  return v_res;
end $$;

-- `security definer` ignora RLS, então o default do Postgres (execute para
-- PUBLIC) daria acesso amplo demais. Fecha e libera só quem precisa.
revoke all on function public.oc_publica(text) from public;
grant execute on function public.oc_publica(text) to anon, authenticated;

revoke all on function public.gerar_link_oc(uuid)   from public, anon;
revoke all on function public.revogar_link_oc(uuid) from public, anon;
grant execute on function public.gerar_link_oc(uuid)   to authenticated;
grant execute on function public.revogar_link_oc(uuid) to authenticated;

commit;
