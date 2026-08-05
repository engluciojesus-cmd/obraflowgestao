import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/useAuth";
import { ErpLayout, StatusBadge } from "@/components/ErpLayout";
import { ComprasSubNav } from "@/components/ComprasSubNav";
import type { Cotacao } from "@/types";

export const Route = createFileRoute("/_authenticated/erp/compras/cotacoes/")({
  head: () => ({ meta: [{ title: "Cotações — ObraFlow Gestão" }] }),
  component: CotacoesPage,
});

function CotacoesPage() {
  const { companyId, loading: companyLoading } = useActiveCompany();
  const [cotacoes, setCotacoes] = useState<Cotacao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (companyId) load();
  }, [companyId]);

  async function load() {
    if (!companyId) return;
    setLoading(true);
    const { data } = await supabase
      .from("cotacoes")
      .select("*, obra:obras(nome), cotacao_itens(id), cotacao_fornecedores(id)")
      .eq("company_id", companyId)
      .order("numero", { ascending: false });
    setCotacoes((data as any) || []);
    setLoading(false);
  }

  if (companyLoading) return null;

  return (
    <ErpLayout title="Cotação" breadcrumb="Compras / Cotação">
      <ComprasSubNav />
      <div className="rounded-lg border border-line bg-card p-6">
        {loading ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : cotacoes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma cotação ainda. Crie uma a partir de um pedido em Itens.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground uppercase border-b border-line">
                <th className="pb-2">Cotação</th>
                <th className="pb-2">Obra</th>
                <th className="pb-2">Descrição</th>
                <th className="pb-2 text-right">Itens</th>
                <th className="pb-2 text-right">Fornecedores</th>
                <th className="pb-2">Data</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {cotacoes.map((c: any) => (
                <tr key={c.id}>
                  <td className="py-3 font-semibold">
                    <Link
                      to="/erp/compras/cotacoes/$cotacaoId"
                      params={{ cotacaoId: c.id }}
                      className="hover:text-cta hover:underline"
                    >
                      COT-{String(c.numero).padStart(3, "0")}
                    </Link>
                  </td>
                  <td className="py-3 text-muted-foreground">{c.obra?.nome || "—"}</td>
                  <td className="py-3 text-muted-foreground">{c.descricao || "—"}</td>
                  <td className="py-3 text-right">{c.cotacao_itens?.length || 0}</td>
                  <td className="py-3 text-right">{c.cotacao_fornecedores?.length || 0}</td>
                  <td className="py-3 text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="py-3">
                    <StatusBadge status={c.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </ErpLayout>
  );
}
