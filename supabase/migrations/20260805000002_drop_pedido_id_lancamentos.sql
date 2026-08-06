-- Migration: drop pedido_id from lancamentos (rollback)
BEGIN;

ALTER TABLE lancamentos
DROP COLUMN IF EXISTS pedido_id;

DROP INDEX IF EXISTS idx_lancamentos_pedido_id;

COMMIT;
