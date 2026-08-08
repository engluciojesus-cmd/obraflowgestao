-- ============================================================================
-- Token da OC sem depender de pgcrypto.
--
-- `gen_random_bytes` vem do pgcrypto, que no Supabase é instalado no schema
-- `extensions`. Como gerar_link_oc fixa `search_path = public` (e deve fixar —
-- search_path solto em função é vetor de sequestro de nome), a chamada não
-- resolvia: "function gen_random_bytes(integer) does not exist".
--
-- `gen_random_uuid()` é built-in do Postgres desde a 13 e não precisa de
-- extensão nenhuma. Dois UUIDs concatenados sem hífen dão 64 caracteres hex —
-- os mesmos 32 bytes de entropia que o pgcrypto daria.
-- ============================================================================

begin;

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

  v_token := replace(gen_random_uuid()::text, '-', '')
          || replace(gen_random_uuid()::text, '-', '');

  update public.ordens_compra
     set token_publico = v_token, token_gerado_em = now()
   where id = p_ordem_id;

  if not found then
    raise exception 'Sem permissão para publicar esta ordem de compra';
  end if;

  return v_token;
end $$;

revoke all on function public.gerar_link_oc(uuid) from public, anon;
grant execute on function public.gerar_link_oc(uuid) to authenticated;

commit;
