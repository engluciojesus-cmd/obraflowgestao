import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser, useActiveCompany, useModulosPermitidos } from "@/hooks/useAuth";
import { COMPRAS_SUBMODULOS, temAcessoComprasSub } from "@/types";
import { SeletorEmpresa } from "@/components/SeletorEmpresa";
import type { ReactNode } from "react";
import { useState } from "react";

const NAV_ITEMS = [
  { id: "inicio", to: "/erp", label: "Início", exact: true },
  { id: "clientes", to: "/erp/clientes", label: "Clientes" },
  { id: "obras", to: "/erp/obras", label: "Obras" },
  { id: "orcamentos", to: "/erp/orcamentos", label: "Orçamentos" },
  { id: "fornecedores", to: "/erp/fornecedores", label: "Fornecedores" },
  { id: "financeiro", to: "/erp/financeiro", label: "Financeiro" },
  { id: "seguranca", to: "/erp/seguranca", label: "Segurança" },
];

function itemVisivel(modulos: string[] | null, id: string) {
  if (!modulos) return true;
  if (modulos.includes(id)) return true;
  return false;
}

export function ErpLayout({
  title,
  breadcrumb,
  actions,
  children,
}: {
  title: string;
  breadcrumb?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const { user } = useAuthUser();
  const { company } = useActiveCompany();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { modulos } = useModulosPermitidos();
  const [comprasAberto, setComprasAberto] = useState(() => pathname.startsWith("/erp/compras"));

  const navItems = NAV_ITEMS.filter((item) => itemVisivel(modulos, item.id));
  const comprasSubItens = COMPRAS_SUBMODULOS.filter((item) => temAcessoComprasSub(modulos, item.id));
  const comprasAtivo = pathname.startsWith("/erp/compras");

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="w-64 shrink-0 bg-card border-r border-line flex flex-col">
        <div className="px-6 py-6 border-b border-line">
          <h1 className="text-xl font-bold">
            Obra<span className="text-cta">Flow</span> Gestão
          </h1>
          {company && (
            <p className="mt-1 text-xs text-muted-foreground truncate">{company.name}</p>
          )}
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.slice(0, 5).map((item) => {
            const active = item.exact
              ? pathname === item.to
              : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`block rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  active
                    ? "bg-cta text-cta-foreground"
                    : "text-foreground hover:bg-side"
                }`}
              >
                {item.label}
              </Link>
            );
          })}

          {comprasSubItens.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setComprasAberto((v) => !v)}
                className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  comprasAtivo
                    ? "bg-cta/10 text-cta"
                    : "text-foreground hover:bg-side"
                }`}
              >
                <span>Compras</span>
                <span className="text-xs">{comprasAberto ? "▾" : "▸"}</span>
              </button>
              {comprasAberto && (
                <div className="mt-1 ml-2 space-y-0.5 border-l-2 border-line pl-2">
                  {comprasSubItens.map((item) => {
                    const active = pathname.startsWith(item.to);
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        className={`block rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                          active
                            ? "bg-cta text-cta-foreground"
                            : "text-muted-foreground hover:bg-side hover:text-foreground"
                        }`}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {navItems.slice(5).map((item) => {
            const active = item.exact
              ? pathname === item.to
              : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`block rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  active
                    ? "bg-cta text-cta-foreground"
                    : "text-foreground hover:bg-side"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-line px-6 py-4">
          <p className="text-sm font-semibold truncate">
            {user?.full_name || user?.username}
          </p>
          <p className="text-xs text-muted-foreground">
            {user?.global_role === "admin_global" ? "Administrador" : "Usuário"}
          </p>
          {user?.global_role === "admin_global" && (
            <Link to="/admin" className="mt-2 block text-xs text-cta hover:underline">
              Painel Admin
            </Link>
          )}
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/auth", replace: true });
            }}
            className="mt-2 text-xs text-cta hover:underline"
          >
            Sair
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <header className="border-b border-line bg-card px-8 py-6 flex items-center justify-between">
          <div>
            {breadcrumb && (
              <p className="text-xs text-muted-foreground mb-1">
                <Link to="/erp" className="hover:text-cta">
                  ObraFlow
                </Link>
                {" / "}
                {breadcrumb}
              </p>
            )}
            <h2 className="text-2xl font-bold">{title}</h2>
          </div>
          <div className="flex items-center gap-4">
            <SeletorEmpresa />
            {actions}
            {company?.logo_url && (
              <img
                src={company.logo_url}
                alt={company.name}
                className="h-10 w-auto max-w-[160px] object-contain"
              />
            )}
          </div>
        </header>
        <main className="p-8">{children}</main>
      </div>
    </div>
  );
}

export function money(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ATIVO: "bg-ok/10 text-ok",
    INATIVO: "bg-err/10 text-err",
    RASCUNHO: "bg-side text-muted-foreground",
    SUBMETIDO: "bg-cta/10 text-cta",
    APROVADO: "bg-ok/10 text-ok",
    REPROVADO: "bg-err/10 text-err",
    PLANEJAMENTO: "bg-side text-muted-foreground",
    "EM EXECUÇÃO": "bg-cta/10 text-cta",
    "MEDIÇÃO": "bg-cta/10 text-cta",
    "CONCLUÍDA": "bg-ok/10 text-ok",
    INATIVA: "bg-err/10 text-err",
    ENVIADO: "bg-cta/10 text-cta",
    CONFIRMADO: "bg-cta/10 text-cta",
    RECEBIDO: "bg-ok/10 text-ok",
    CANCELADO: "bg-err/10 text-err",
    "NOTA RECEBIDA": "bg-cta/10 text-cta",
    PAGA: "bg-ok/10 text-ok",
    ATRASADA: "bg-err/10 text-err",
    FATURADA: "bg-cta/10 text-cta",
    ABERTA: "bg-cta/10 text-cta",
    FECHADA: "bg-ok/10 text-ok",
    GERADA: "bg-side text-muted-foreground",
    "AGUARDANDO ASSINATURA": "bg-cta/10 text-cta",
    ASSINADO: "bg-ok/10 text-ok",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
        map[status] || "bg-side text-muted-foreground"
      }`}
    >
      {status}
    </span>
  );
}
