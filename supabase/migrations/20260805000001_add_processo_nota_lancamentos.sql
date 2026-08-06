-- Migration: add processo_numero and nota_numero to lancamentos
BEGIN;

ALTER TABLE lancamentos
ADD COLUMN IF NOT EXISTS processo_numero text;

ALTER TABLE lancamentos
ADD COLUMN IF NOT EXISTS nota_numero text;

COMMIT;
