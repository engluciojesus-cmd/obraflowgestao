-- Migration: create orcamento_debitos for audit of verba consumption
BEGIN;

CREATE TABLE IF NOT EXISTS orcamento_debitos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lancamento_id uuid REFERENCES lancamentos(id),
  pedido_id uuid REFERENCES pedidos(id),
  orcamento_item_id uuid REFERENCES orcamento_itens(id),
  valor numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orcamento_debitos_orc_item ON orcamento_debitos(orcamento_item_id);
CREATE INDEX IF NOT EXISTS idx_orcamento_debitos_lanc ON orcamento_debitos(lancamento_id);

COMMIT;
