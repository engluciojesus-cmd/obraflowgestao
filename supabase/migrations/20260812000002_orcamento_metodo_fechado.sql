-- ============================================================================
-- ORÇAMENTO — terceiro método: FECHADO
--
--   QUANTITATIVO — item tem qtd × valor unitário (e, adiante, composição
--                  própria ou SINAPI). O valor é a fonte da verdade.
--   PERCENTUAL   — peso % do contrato é a fonte da verdade; o R$ deriva.
--   FECHADO      — serviço básico que não compensa destrinchar: uma descrição
--                  e um valor, ponto.
--
-- FECHADO não é uma exceção no modelo de dados: por baixo ele monta a mesma
-- estrutura serviço → item (um serviço Misto de peso 100 com um item em verba).
-- É o que mantém funcionando tudo que já depende dessa árvore — apropriação da
-- requisição, medição por serviço e o comprometido da obra.
-- ============================================================================

alter table public.orcamentos
  drop constraint if exists orcamentos_metodo_check;

alter table public.orcamentos
  add constraint orcamentos_metodo_check
  check (metodo in ('QUANTITATIVO', 'PERCENTUAL', 'FECHADO'));
