-- ============================================================================
-- Cadastro rápido de fornecedor a partir da cotação.
--
-- O "+" do seletor criava o fornecedor só com o nome. Na prática o comprador
-- já tem o e-mail e o celular na mão (acabou de pedir preço), e sem eles a OC
-- não tem para onde ser enviada — alguém teria que voltar no cadastro depois.
--
-- `vendedor_email` / `vendedor_telefone` (já existentes) são o contato da
-- pessoa; estes são o contato da empresa. São coisas diferentes: o vendedor
-- troca, o e-mail do fornecedor fica.
-- ============================================================================

begin;

alter table public.fornecedores
  add column if not exists email       text,
  add column if not exists celular     text,
  add column if not exists tipo_pessoa text
    check (tipo_pessoa is null or tipo_pessoa in ('fisica', 'juridica'));

comment on column public.fornecedores.tipo_pessoa is
  'fisica | juridica — define se o documento esperado é CPF ou CNPJ.';

commit;
