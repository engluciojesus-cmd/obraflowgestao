-- ============================================
-- OBRAFLOW ERP — MODELO REAL DE ORÇAMENTO
-- Orçamento → Fase (opcional) → Serviço (com peso) → Item (aberto ou verba)
-- Compras vinculam por ITEM. Medições vinculam por SERVIÇO.
-- ============================================

-- ---------- FASES (opcional — pode não existir para um orçamento) ----------
CREATE TABLE IF NOT EXISTS public.orcamento_fases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id UUID NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- SERVIÇOS (nível intermediário; fase_id nulo = "sem fase") ----------
CREATE TABLE IF NOT EXISTS public.orcamento_servicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id UUID NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  fase_id UUID REFERENCES public.orcamento_fases(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'Serviço' CHECK (tipo IN ('Serviço', 'Material')),
  peso NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (peso BETWEEN 0 AND 100),
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- ITENS (aberto: qtd × valor_unitario | fechado: verba) ----------
CREATE TABLE IF NOT EXISTS public.orcamento_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  servico_id UUID NOT NULL REFERENCES public.orcamento_servicos(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  modo TEXT NOT NULL DEFAULT 'aberto' CHECK (modo IN ('aberto', 'verba')),
  quantidade NUMERIC(14,4) DEFAULT 1,
  unidade TEXT DEFAULT 'un',
  valor_unitario NUMERIC(14,2) DEFAULT 0,
  valor_verba NUMERIC(14,2) DEFAULT 0,
  memoria_calculo TEXT,
  observacoes TEXT,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- valor_total é sempre calculado em código (qtd*vu se aberto, valor_verba se fechado) —
-- mantido simples aqui, sem coluna gerada, para portabilidade.

-- ---------- Ligar Compras (pedido_itens) ao ITEM de orçamento ----------
-- pedido_itens.orcamento_id já existia apontando pra orcamentos; substituímos
-- pela referência precisa ao item.
ALTER TABLE public.pedido_itens
  DROP CONSTRAINT IF EXISTS pedido_itens_orcamento_id_fkey;
ALTER TABLE public.pedido_itens
  RENAME COLUMN orcamento_id TO orcamento_item_id;
ALTER TABLE public.pedido_itens
  ADD CONSTRAINT pedido_itens_orcamento_item_id_fkey
  FOREIGN KEY (orcamento_item_id) REFERENCES public.orcamento_itens(id) ON DELETE SET NULL;

-- ---------- Ligar Medições ao SERVIÇO (além da obra) ----------
ALTER TABLE public.medicoes
  ADD COLUMN IF NOT EXISTS servico_id UUID REFERENCES public.orcamento_servicos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS percentual_medido NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (percentual_medido BETWEEN 0 AND 100);

-- ---------- orcamentos: campos adicionais do fluxo aprovado ----------
ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS responsavel TEXT,
  ADD COLUMN IF NOT EXISTS usa_fases BOOLEAN NOT NULL DEFAULT FALSE;

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_orc_fases_orcamento ON public.orcamento_fases(orcamento_id);
CREATE INDEX IF NOT EXISTS idx_orc_servicos_orcamento ON public.orcamento_servicos(orcamento_id);
CREATE INDEX IF NOT EXISTS idx_orc_servicos_fase ON public.orcamento_servicos(fase_id);
CREATE INDEX IF NOT EXISTS idx_orc_itens_servico ON public.orcamento_itens(servico_id);
CREATE INDEX IF NOT EXISTS idx_medicoes_servico ON public.medicoes(servico_id);

-- ============================================
-- RLS — seguem a empresa do orçamento pai (via join)
-- ============================================

CREATE OR REPLACE FUNCTION public.orcamento_company(oid UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT company_id FROM public.orcamentos WHERE id = oid;
$$;

ALTER TABLE public.orcamento_fases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "orcamento_fases_select" ON public.orcamento_fases;
CREATE POLICY "orcamento_fases_select" ON public.orcamento_fases
  FOR SELECT USING (
    public.orcamento_company(orcamento_id) IN (SELECT public.my_company_ids())
    OR public.is_admin_global()
  );
DROP POLICY IF EXISTS "orcamento_fases_write" ON public.orcamento_fases;
CREATE POLICY "orcamento_fases_write" ON public.orcamento_fases
  FOR ALL USING (public.can_write_company(public.orcamento_company(orcamento_id)))
  WITH CHECK (public.can_write_company(public.orcamento_company(orcamento_id)));

ALTER TABLE public.orcamento_servicos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "orcamento_servicos_select" ON public.orcamento_servicos;
CREATE POLICY "orcamento_servicos_select" ON public.orcamento_servicos
  FOR SELECT USING (
    public.orcamento_company(orcamento_id) IN (SELECT public.my_company_ids())
    OR public.is_admin_global()
  );
DROP POLICY IF EXISTS "orcamento_servicos_write" ON public.orcamento_servicos;
CREATE POLICY "orcamento_servicos_write" ON public.orcamento_servicos
  FOR ALL USING (public.can_write_company(public.orcamento_company(orcamento_id)))
  WITH CHECK (public.can_write_company(public.orcamento_company(orcamento_id)));

ALTER TABLE public.orcamento_itens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "orcamento_itens_select" ON public.orcamento_itens;
CREATE POLICY "orcamento_itens_select" ON public.orcamento_itens
  FOR SELECT USING (
    servico_id IN (
      SELECT id FROM public.orcamento_servicos
      WHERE public.orcamento_company(orcamento_id) IN (SELECT public.my_company_ids())
    )
    OR public.is_admin_global()
  );
DROP POLICY IF EXISTS "orcamento_itens_write" ON public.orcamento_itens;
CREATE POLICY "orcamento_itens_write" ON public.orcamento_itens
  FOR ALL USING (
    servico_id IN (
      SELECT id FROM public.orcamento_servicos
      WHERE public.can_write_company(public.orcamento_company(orcamento_id))
    )
  )
  WITH CHECK (
    servico_id IN (
      SELECT id FROM public.orcamento_servicos
      WHERE public.can_write_company(public.orcamento_company(orcamento_id))
    )
  );

DROP TRIGGER IF EXISTS update_orcamento_itens_updated_at ON public.orcamento_itens;
CREATE TRIGGER update_orcamento_itens_updated_at BEFORE UPDATE ON public.orcamento_itens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
