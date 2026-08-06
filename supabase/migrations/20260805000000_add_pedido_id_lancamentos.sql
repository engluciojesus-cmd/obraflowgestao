-- Migration: add pedido_id to lancamentos
BEGIN;

ALTER TABLE lancamentos
ADD COLUMN IF NOT EXISTS pedido_id uuid REFERENCES pedidos(id);

CREATE INDEX IF NOT EXISTS idx_lancamentos_pedido_id ON lancamentos(pedido_id);

COMMIT;
