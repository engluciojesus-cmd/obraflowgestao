-- ============================================
-- MIGRAÇÕES OBRAFLOW - MULTI-TENANT SECURITY
-- (versão corrigida: sem recursão de RLS + policies de INSERT)
-- ============================================

-- Tabela de usuários estendida
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  global_role TEXT NOT NULL CHECK (global_role IN ('admin_global', 'user')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de empresas
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cnpj TEXT UNIQUE,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de relacionamento usuário-empresa
CREATE TABLE IF NOT EXISTS public.company_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'operator', 'viewer')),
  can_manage_users BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, company_id)
);

-- ============================================
-- INDEXES (Performance)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_users_global_role ON public.users(global_role);

CREATE INDEX IF NOT EXISTS idx_companies_created_by ON public.companies(created_by);
CREATE INDEX IF NOT EXISTS idx_companies_active ON public.companies(active);

CREATE INDEX IF NOT EXISTS idx_company_members_user_id ON public.company_members(user_id);
CREATE INDEX IF NOT EXISTS idx_company_members_company_id ON public.company_members(company_id);
CREATE INDEX IF NOT EXISTS idx_company_members_role ON public.company_members(role);

-- ============================================
-- FUNÇÕES AUXILIARES (SECURITY DEFINER)
-- Evitam recursão infinita nas policies:
-- uma policy de "users" não pode consultar "users" diretamente,
-- e uma policy de "company_members" não pode consultar
-- "company_members" diretamente.
-- ============================================

CREATE OR REPLACE FUNCTION public.is_admin_global()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND global_role = 'admin_global'
  );
$$;

CREATE OR REPLACE FUNCTION public.my_company_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT company_id FROM public.company_members
  WHERE user_id = auth.uid();
$$;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;

-- ---------- users ----------

DROP POLICY IF EXISTS "users_select_own" ON public.users;
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "users_select_admin_global" ON public.users;
CREATE POLICY "users_select_admin_global" ON public.users
  FOR SELECT USING (public.is_admin_global());

-- Membros da mesma empresa podem ver dados básicos uns dos outros
-- (necessário para a listagem em /company/users)
DROP POLICY IF EXISTS "users_select_same_company" ON public.users;
CREATE POLICY "users_select_same_company" ON public.users
  FOR SELECT USING (
    id IN (
      SELECT user_id FROM public.company_members
      WHERE company_id IN (SELECT public.my_company_ids())
    )
  );

-- Signup: usuário pode inserir a própria linha
DROP POLICY IF EXISTS "users_insert_own" ON public.users;
CREATE POLICY "users_insert_own" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id AND global_role = 'user');

-- Usuário pode atualizar o próprio perfil (sem trocar o role)
DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND global_role = (SELECT global_role FROM public.users u WHERE u.id = auth.uid()));

-- ---------- companies ----------

DROP POLICY IF EXISTS "companies_select_admin_global" ON public.companies;
CREATE POLICY "companies_select_admin_global" ON public.companies
  FOR SELECT USING (public.is_admin_global());

DROP POLICY IF EXISTS "companies_select_member" ON public.companies;
CREATE POLICY "companies_select_member" ON public.companies
  FOR SELECT USING (id IN (SELECT public.my_company_ids()));

-- Apenas admin global cria/edita empresas
DROP POLICY IF EXISTS "companies_insert_admin_global" ON public.companies;
CREATE POLICY "companies_insert_admin_global" ON public.companies
  FOR INSERT WITH CHECK (public.is_admin_global());

DROP POLICY IF EXISTS "companies_update_admin_global" ON public.companies;
CREATE POLICY "companies_update_admin_global" ON public.companies
  FOR UPDATE USING (public.is_admin_global());

-- ---------- company_members ----------

DROP POLICY IF EXISTS "members_select" ON public.company_members;
CREATE POLICY "members_select" ON public.company_members
  FOR SELECT USING (
    company_id IN (SELECT public.my_company_ids())
    OR public.is_admin_global()
  );

-- INSERT/UPDATE/DELETE de membros acontece apenas via Edge Function
-- (service role, que ignora RLS). Nenhuma policy de escrita necessária aqui.

-- ============================================
-- TRIGGERS (Atualizar updated_at automaticamente)
-- ============================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_companies_updated_at ON public.companies;
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_company_members_updated_at ON public.company_members;
CREATE TRIGGER update_company_members_updated_at BEFORE UPDATE ON public.company_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- NOTA
-- Para criar o primeiro admin global, execute:
--   node scripts/create-admin.js
-- com SUPABASE_SERVICE_KEY no .env (requer auth.admin)
-- ============================================
