-- ============================================================================
-- ORÇAMENTO — aceitar o tipo "Misto" em orcamento_servicos
--
-- A tela (orcamentos/$orcamentoId.tsx) e o tipo TS já ofereciam três opções,
-- mas o CHECK só permitia duas: salvar um serviço como "Misto" estourava
-- check_violation. Este é o mesmo tipo que a Medição vai exigir — obra mede
-- Mão de obra e Misto, nunca Material puro.
-- ============================================================================

alter table public.orcamento_servicos
  drop constraint if exists orcamento_servicos_tipo_check;

alter table public.orcamento_servicos
  add constraint orcamento_servicos_tipo_check
  check (tipo in ('Serviço', 'Material', 'Misto'));
