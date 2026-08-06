import React, { createContext, useContext, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthUser, useUserCompanies, useCompanyRole } from "@/hooks/useAuth";
import type { Company, CompanyRole } from "@/types";

interface TenantContextType {
  companyId: string | null;
  company: Company | null;
  companies: Company[];
  role: CompanyRole | null;
  modulos: string[] | null;
  isAdminGlobal: boolean;
  isLoading: boolean;
  trocarEmpresa: (id: string) => void;
  pode: (modulo: string) => boolean;
}

const TenantContext = createContext<TenantContextType | null>(null);

const STORAGE_KEY = "obraflow.company_id";

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: userLoading } = useAuthUser();
  const { companies, loading: companiesLoading } = useUserCompanies();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const { role } = useCompanyRole(companyId || undefined);
  const queryClient = useQueryClient();

  const isAdminGlobal = user?.global_role === "admin_global";

  // Restaura a empresa ativa do localStorage no boot, validando que o
  // usuário ainda é membro dela. admin_global nunca entra automaticamente
  // em uma empresa — precisa escolher pelo SeletorEmpresa.
  useEffect(() => {
    if (companiesLoading) return;

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && companies.some((c) => c.id === saved)) {
      setCompanyId(saved);
      return;
    }

    if (saved) localStorage.removeItem(STORAGE_KEY);

    if (companies.length > 0 && !isAdminGlobal) {
      setCompanyId(companies[0].id);
    }
  }, [companies, companiesLoading, isAdminGlobal]);

  const company = companies.find((c) => c.id === companyId) || null;
  const isLoading = userLoading || companiesLoading;

  // "modulos" vazio ou ausente = sem restrição (vê tudo), igual ao
  // critério já usado no resto do app para CompanyMember.modulos.
  const modulosLiberados = role?.modulos && role.modulos.length > 0 ? role.modulos : null;

  const trocarEmpresa = (id: string) => {
    // CRÍTICO: limpar o cache do React Query ANTES de trocar de empresa.
    // Sem isso, dados da empresa anterior continuam servidos do cache
    // enquanto as telas ainda não refizeram as queries com o novo companyId.
    queryClient.clear();
    setCompanyId(id || null);
    if (id) {
      localStorage.setItem(STORAGE_KEY, id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const pode = (modulo: string): boolean => {
    if (isAdminGlobal) return true;
    if (!modulosLiberados) return true;
    return modulosLiberados.includes(modulo);
  };

  return (
    <TenantContext.Provider
      value={{
        companyId,
        company,
        companies,
        role: role?.role || null,
        modulos: modulosLiberados,
        isAdminGlobal,
        isLoading,
        trocarEmpresa,
        pode,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant deve ser usado dentro de TenantProvider");
  return ctx;
}
