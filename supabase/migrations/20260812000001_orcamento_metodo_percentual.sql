-- ============================================================================
-- ORÇAMENTO — método de elaboração
--
-- Dois estilos de planilha que não se misturam:
--
--   QUANTITATIVO — o que a tela já fazia. Item tem qtd × valor unitário (ou
--                  verba); o valor é a fonte da verdade e o peso % é derivado
--                  dele. É o estilo da planilha com códigos de composição.
--
--   PERCENTUAL   — o inverso. O % é a fonte da verdade e o R$ é derivado:
--                  valor_do_item = peso% × orcamentos.valor. Serviço com
--                  subitens tem peso = soma dos subitens; serviço sem subitens
--                  tem o peso digitado direto no macro. O total fecha 100%.
--
-- Default QUANTITATIVO de propósito: orçamento que já existe não muda de
-- comportamento por causa desta migration.
-- ============================================================================

alter table public.orcamentos
  add column if not exists metodo text not null default 'QUANTITATIVO';

alter table public.orcamentos
  drop constraint if exists orcamentos_metodo_check;

alter table public.orcamentos
  add constraint orcamentos_metodo_check
  check (metodo in ('QUANTITATIVO', 'PERCENTUAL'));
