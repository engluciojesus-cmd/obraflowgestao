-- ============================================================================
-- cotacao_precos.cotacao_id — a coluna que o front sempre assumiu existir.
--
-- `cotacoes.repository.salvarPreco` grava `cotacao_id` e `buscarMapa` filtra
-- por ele; a coluna nunca foi criada (a 20260811000000 §5 acrescentou só
-- company_id, disponivel e prazo_dias). Resultado: todo insert de preço
-- falhava com "column cotacao_precos.cotacao_id does not exist", o valor
-- digitado sumia no blur, e o mapa lia zero preços.
--
-- O vínculo já existe indiretamente por cotacao_itens.cotacao_id — é dele que
-- o backfill sai, sem inventar dado.
-- ============================================================================

begin;

alter table public.cotacao_precos
  add column if not exists cotacao_id uuid references public.cotacoes(id) on delete cascade;

update public.cotacao_precos cp
   set cotacao_id = ci.cotacao_id
  from public.cotacao_itens ci
 where ci.id = cp.cotacao_item_id
   and cp.cotacao_id is null;

-- company_id na mesma viagem: também é escrito pelo front e pode estar nulo
-- nas linhas antigas, o que esconderia o preço de qualquer filtro por empresa.
update public.cotacao_precos cp
   set company_id = c.company_id
  from public.cotacoes c
 where c.id = cp.cotacao_id
   and cp.company_id is null;

create index if not exists idx_cotacao_precos_cotacao
  on public.cotacao_precos(cotacao_id);

-- Preço é único por (fornecedor da cotação, item da cotação). Sem esta
-- restrição, um duplo clique no checkbox de "escolhido" gera duas linhas e o
-- total do fornecedor conta o item duas vezes. Remove as duplicatas existentes
-- mantendo a última antes de criar o índice, senão o create aborta.
delete from public.cotacao_precos a
 using public.cotacao_precos b
 where a.cotacao_fornecedor_id = b.cotacao_fornecedor_id
   and a.cotacao_item_id       = b.cotacao_item_id
   and a.ctid < b.ctid;

create unique index if not exists uq_cotacao_precos_fornecedor_item
  on public.cotacao_precos(cotacao_fornecedor_id, cotacao_item_id);

commit;
