-- ============================================
-- OBRAFLOW ERP - MÓDULOS: CLIENTES, OBRAS, ORÇAMENTOS,
-- FORNECEDORES, COMPRAS, FINANCEIRO, MEDIÇÕES
-- Todas as tabelas são isoladas por company_id (multi-tenant)
-- ============================================

-- ---------- CLIENTES ----------
CREATE TABLE IF NOT EXISTS public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  documento TEXT,
  tipo TEXT NOT NULL DEFAULT 'Pessoa Física' CHECK (tipo IN ('Pessoa Física', 'Empresa')),
  telefone TEXT,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'ATIVO' CHECK (status IN ('ATIVO', 'INATIVO')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- OBRAS ----------
CREATE TABLE IF NOT EXISTS public.obras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  local TEXT,
  prazo DATE,
  valor NUMERIC(14,2) DEFAULT 0,
  avanco INTEGER NOT NULL DEFAULT 0 CHECK (avanco BETWEEN 0 AND 100),
  status TEXT NOT NULL DEFAULT 'PLANEJAMENTO' CHECK (status IN ('PLANEJAMENTO', 'EM EXECUÇÃO', 'MEDIÇÃO', 'CONCLUÍDA', 'INATIVA')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- ORÇAMENTOS ----------
CREATE TABLE IF NOT EXISTS public.orcamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  obra_id UUID REFERENCES public.obras(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  data DATE DEFAULT CURRENT_DATE,
  valor NUMERIC(14,2) DEFAULT 0,
  percentual_consumo INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'RASCUNHO' CHECK (status IN ('RASCUNHO', 'SUBMETIDO', 'APROVADO', 'REPROVADO')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- FORNECEDORES ----------
CREATE TABLE IF NOT EXISTS public.fornecedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cnpj TEXT,
  categoria TEXT,
  avaliacao INTEGER NOT NULL DEFAULT 5 CHECK (avaliacao BETWEEN 1 AND 5),
  status TEXT NOT NULL DEFAULT 'ATIVO' CHECK (status IN ('ATIVO', 'INATIVO')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- PEDIDOS (COMPRAS) ----------
CREATE TABLE IF NOT EXISTS public.pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  fornecedor_id UUID REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  obra_id UUID REFERENCES public.obras(id) ON DELETE SET NULL,
  data DATE DEFAULT CURRENT_DATE,
  valor NUMERIC(14,2) DEFAULT 0,
  forma_pagamento TEXT,
  status TEXT NOT NULL DEFAULT 'ENVIADO' CHECK (status IN ('ENVIADO', 'CONFIRMADO', 'RECEBIDO', 'CANCELADO')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pedido_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  orcamento_id UUID REFERENCES public.orcamentos(id) ON DELETE SET NULL,
  descricao TEXT NOT NULL,
  quantidade NUMERIC(12,2) DEFAULT 1,
  valor_unitario NUMERIC(14,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- FINANCEIRO: LANÇAMENTOS (A PAGAR) ----------
CREATE TABLE IF NOT EXISTS public.lancamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  fornecedor_id UUID REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  obra_id UUID REFERENCES public.obras(id) ON DELETE SET NULL,
  vencimento DATE,
  valor NUMERIC(14,2) DEFAULT 0,
  forma_pagamento TEXT,
  status TEXT NOT NULL DEFAULT 'NOTA RECEBIDA' CHECK (status IN ('NOTA RECEBIDA', 'PAGA', 'ATRASADA', 'CANCELADA')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- FINANCEIRO: MEDIÇÕES (A RECEBER) ----------
CREATE TABLE IF NOT EXISTS public.medicoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  obra_id UUID REFERENCES public.obras(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  vencimento DATE,
  valor NUMERIC(14,2) DEFAULT 0,
  recebido NUMERIC(14,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'FATURADA' CHECK (status IN ('FATURADA', 'PAGA', 'ATRASADA')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- TIPOS DE PAGAMENTO (cadastro auxiliar) ----------
CREATE TABLE IF NOT EXISTS public.tipos_pagamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_clientes_company ON public.clientes(company_id);
CREATE INDEX IF NOT EXISTS idx_obras_company ON public.obras(company_id);
CREATE INDEX IF NOT EXISTS idx_obras_cliente ON public.obras(cliente_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_company ON public.orcamentos(company_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_obra ON public.orcamentos(obra_id);
CREATE INDEX IF NOT EXISTS idx_fornecedores_company ON public.fornecedores(company_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_company ON public.pedidos(company_id);
CREATE INDEX IF NOT EXISTS idx_pedido_itens_pedido ON public.pedido_itens(pedido_id);
CREATE INDEX IF NOT EXISTS idx_lancamentos_company ON public.lancamentos(company_id);
CREATE INDEX IF NOT EXISTS idx_medicoes_company ON public.medicoes(company_id);
CREATE INDEX IF NOT EXISTS idx_tipos_pagamento_company ON public.tipos_pagamento(company_id);

-- ============================================
-- RLS: todas as tabelas seguem a mesma regra —
-- membro da empresa (via public.my_company_ids()) pode ver/editar;
-- admin_global vê tudo.
-- Escrita (INSERT/UPDATE/DELETE) exige ser membro da empresa
-- com papel admin/manager/operator (todos exceto viewer podem
-- mexer nos módulos operacionais; ajuste fino fica para depois).
-- ============================================

CREATE OR REPLACE FUNCTION public.can_write_company(target_company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT public.is_admin_global() OR EXISTS (
    SELECT 1 FROM public.company_members
    WHERE user_id = auth.uid()
      AND company_id = target_company_id
      AND role IN ('admin', 'manager', 'operator')
  );
$$;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['clientes','obras','orcamentos','fornecedores','pedidos','lancamentos','medicoes','tipos_pagamento']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format('DROP POLICY IF EXISTS "%1$s_select" ON public.%1$s', t);
    EXECUTE format($f$
      CREATE POLICY "%1$s_select" ON public.%1$s
        FOR SELECT USING (
          company_id IN (SELECT public.my_company_ids()) OR public.is_admin_global()
        )
    $f$, t);

    EXECUTE format('DROP POLICY IF EXISTS "%1$s_write" ON public.%1$s', t);
    EXECUTE format($f$
      CREATE POLICY "%1$s_write" ON public.%1$s
        FOR ALL USING (public.can_write_company(company_id))
        WITH CHECK (public.can_write_company(company_id))
    $f$, t);
  END LOOP;
END $$;

-- pedido_itens segue a empresa do pedido pai (via join)
ALTER TABLE public.pedido_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pedido_itens_select" ON public.pedido_itens;
CREATE POLICY "pedido_itens_select" ON public.pedido_itens
  FOR SELECT USING (
    pedido_id IN (
      SELECT id FROM public.pedidos
      WHERE company_id IN (SELECT public.my_company_ids()) OR public.is_admin_global()
    )
  );

DROP POLICY IF EXISTS "pedido_itens_write" ON public.pedido_itens;
CREATE POLICY "pedido_itens_write" ON public.pedido_itens
  FOR ALL USING (
    pedido_id IN (SELECT id FROM public.pedidos WHERE public.can_write_company(company_id))
  )
  WITH CHECK (
    pedido_id IN (SELECT id FROM public.pedidos WHERE public.can_write_company(company_id))
  );

-- ============================================
-- TRIGGERS updated_at
-- ============================================
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['clientes','obras','orcamentos','fornecedores','pedidos','lancamentos','medicoes']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS update_%1$s_updated_at ON public.%1$s', t);
    EXECUTE format($f$
      CREATE TRIGGER update_%1$s_updated_at BEFORE UPDATE ON public.%1$s
        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()
    $f$, t);
  END LOOP;
END $$;
