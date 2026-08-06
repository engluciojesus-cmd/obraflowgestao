import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/app/TenantProvider";
import type { AuthUser, CompanyMember, Company } from "@/types";

/**
 * Hook para obter usuário autenticado com informações estendidas
 * Integra com o sistema de perfil existente
 */
export function useAuthUser() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!isMounted) return;

      if (!data.session) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        // Buscar dados estendidos do usuário
        const { data: userData, error } = await supabase
          .from("users")
          .select("id, email, global_role, username, full_name, created_at")
          .eq("id", data.session.user.id)
          .single();

        if (error && error.code !== "PGRST116") throw error;

        if (userData) {
          setUser({
            id: userData.id,
            email: userData.email,
            global_role: userData.global_role,
            username: userData.username,
            full_name: userData.full_name,
            created_at: userData.created_at,
          });
        } else {
          // Se não encontrar na tabela users, criar automaticamente
          const metadata = data.session.user.user_metadata || {};
          setUser({
            id: data.session.user.id,
            email: data.session.user.email || "",
            global_role: "user",
            username: metadata.username || "usuario",
            full_name: metadata.full_name || "Usuário",
            created_at: new Date().toISOString(),
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar usuário");
      } finally {
        if (isMounted) setLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      if (session?.user?.id) {
        supabase
          .from("users")
          .select("id, email, global_role, username, full_name, created_at")
          .eq("id", session.user.id)
          .single()
          .then(({ data: userData }) => {
            if (isMounted && userData) {
              setUser({
                id: userData.id,
                email: userData.email,
                global_role: userData.global_role,
                username: userData.username,
                full_name: userData.full_name,
                created_at: userData.created_at,
              });
            }
          });
      } else {
        setUser(null);
      }
    });

    return () => {
      isMounted = false;
      listener?.subscription.unsubscribe();
    };
  }, []);

  return { user, loading, error };
}

/**
 * Hook para obter empresas do usuário
 */
export function useUserCompanies() {
  const { user } = useAuthUser();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    if (user.global_role === "admin_global") {
      // Admin global vê todas as empresas
      supabase
        .from("companies")
        .select("*")
        .order("created_at", { ascending: false })
        .then(({ data, error }) => {
          if (error) {
            setError(error.message);
          } else {
            setCompanies(data || []);
          }
          setLoading(false);
        });
    } else {
      // Usuário comum vê só suas empresas
      supabase
        .from("company_members")
        .select("company_id, companies(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .then(({ data, error }) => {
          if (error) {
            setError(error.message);
          } else {
            const companies = data
              ?.map((item: any) => item.companies)
              .filter(Boolean) as Company[];
            setCompanies(companies || []);
          }
          setLoading(false);
        });
    }
  }, [user?.id, user?.global_role]);

  return { companies, loading, error };
}

/**
 * Hook para obter role do usuário em uma empresa
 */
export function useCompanyRole(companyId: string | undefined) {
  const { user } = useAuthUser();
  const [role, setRole] = useState<CompanyMember | null>(null);
  const [loading, setLoading] = useState(!!companyId);

  useEffect(() => {
    if (!companyId || !user) {
      setLoading(false);
      return;
    }

    supabase
      .from("company_members")
      .select("*")
      .eq("user_id", user.id)
      .eq("company_id", companyId)
      .single()
      .then(({ data, error }) => {
        if (error?.code !== "PGRST116") {
          // PGRST116 = not found (é esperado se não há registro)
          setRole(data || null);
        }
        setLoading(false);
      });
  }, [companyId, user?.id]);

  return { role, loading };
}

/**
 * Hook para obter a "empresa ativa" do usuário (companyId selecionado no
 * TenantProvider, persistido em localStorage). Alias fino de useTenant()
 * mantido para não quebrar os módulos ERP existentes.
 */
export function useActiveCompany() {
  const { company, companyId, isLoading } = useTenant();
  return {
    company,
    companyId,
    loading: isLoading,
    error: null as string | null,
  };
}

/**
 * Hook para saber quais módulos o usuário pode ver na empresa ativa.
 * Retorna null quando não há restrição (vê todos).
 */
export function useModulosPermitidos() {
  const { modulos, isAdminGlobal, isLoading } = useTenant();
  if (isAdminGlobal) return { modulos: null, loading: false };
  return { modulos, loading: isLoading };
}

/**
 * Hook para verificar se pode gerenciar usuários
 */
export function useCanManageUsers(companyId: string | undefined) {
  const { user } = useAuthUser();
  const { role } = useCompanyRole(companyId);

  if (user?.global_role === "admin_global") return true;
  if (!role) return false;

  return role.can_manage_users || role.role === "admin";
}
