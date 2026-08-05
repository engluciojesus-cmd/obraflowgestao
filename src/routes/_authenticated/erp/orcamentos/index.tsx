import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany, useAuthUser } from "@/hooks/useAuth";
import { ErpLayout, StatusBadge, money } from "@/components/ErpLayout";
import type { Orcamento, Cliente, Obra } from "@/types";

export const Route = createFileRoute("/_authenticated/erp/orcamentos/")({
  head: () => ({ meta: [{ title: "Orçamentos — ObraFlow Gestão" }] }),
  component: OrcamentosPage,
});

function OrcamentosPage() {
  const { companyId, loading: companyLoading } = useActiveCompany();
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [clienteFilter, setClienteFilter] = useState("");
  const [obraFilter, setObraFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    if (companyId) load();
  }, [companyId]);

  async function load() {
    if (!companyId) return;
    setLoading(true);
    const [{ data: orcData }, { data: clientesData }, { data: obrasData }] = await Promise.all([
      supabase
        .from("orcamentos")
        .select("*, cliente:clientes(nome), obra:obras(nome)")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false }),
      supabase.from("clientes").select("*").eq("company_id", companyId).order("nome"),
      supabase.from("obras").select("*").eq("company_id", companyId).order("nome"),
    ]);
    setOrcamentos(orcData || []);
    setClientes(clientesData || []);
    setObras(obrasData || []);
    setLoading(false);
  }

  const filtered = orcamentos.filter(
    (o) =>
      o.nome.toLowerCase().includes(search.toLowerCase()) &&
      (!clienteFilter || o.cliente_id === clienteFilter) &&
      (!obraFilter || o.obra_id === obraFilter) &&
      (!statusFilter || o.status === statusFilter)
  );

  if (companyLoading) return null;

  return (
    <ErpLayout
      title="Orçamentos"
      breadcrumb="Orçamentos"
      actions={
        <button onClick={() => setShowForm(true)} className="btn-cta">
          + Novo Orçamento
        </button>
      }
    >
      {showForm && (
        <NovoOrcamentoForm
          companyId={companyId!}
          clientes={clientes}
          obras={obras}
          onCancel={() => setShowForm(false)}
        />
      )}

      <div className="rounded-lg border border-line bg-card p-4 mb-6 flex gap-3 flex-wrap items-center">
        <select className="field w-52" value={clienteFilter} onChange={(e) => setClienteFilter(e.target.value)}>
          <option value="">Todos os clientes</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
        <select className="field w-52" value={obraFilter} onChange={(e) => setObraFilter(e.target.value)}>
          <option value="">Todas as obras</option>
          {obras.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nome}
            </option>
          ))}
        </select>
        <select className="field w-44" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Todos os status</option>
          <option value="RASCUNHO">Rascunho</option>
          <option value="APROVADO">Aprovado</option>
        </select>
        <input
          className="field flex-1 min-w-[200px]"
          placeholder="Buscar por nome..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="rounded-lg border border-line bg-card p-6">
        <h3 className="font-bold mb-4">{filtered.length} Orçamento(s)</h3>
        {loading ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum orçamento encontrado.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground uppercase border-b border-line">
                <th className="pb-2">ID</th>
                <th className="pb-2">Nome</th>
                <th className="pb-2">Cliente</th>
                <th className="pb-2">Obra</th>
                <th className="pb-2">Data</th>
                <th className="pb-2">Valor</th>
                <th className="pb-2">% Consumo</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((o, i) => (
                <tr key={o.id} className="hover:bg-side/30">
                  <td className="py-3">
                    <Link
                      to="/erp/orcamentos/$orcamentoId"
                      params={{ orcamentoId: o.id }}
                      className="text-cta hover:underline font-mono text-xs"
                    >
                      ORC-{String(filtered.length - i).padStart(3, "0")}
                    </Link>
                  </td>
                  <td className="py-3 font-semibold">
                    <Link to="/erp/orcamentos/$orcamentoId" params={{ orcamentoId: o.id }} className="hover:text-cta">
                      {o.nome}
                    </Link>
                  </td>
                  <td className="py-3 text-muted-foreground">{o.cliente?.nome || "—"}</td>
                  <td className="py-3 text-muted-foreground">{o.obra?.nome || "Não vinculada"}</td>
                  <td className="py-3 text-muted-foreground">
                    {new Date(o.data).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="py-3">{money(Number(o.valor))}</td>
                  <td className="py-3">
                    <span className={o.percentual_consumo > 100 ? "text-err font-semibold" : ""}>
                      {o.percentual_consumo}%
                    </span>
                  </td>
                  <td className="py-3">
                    <StatusBadge status={o.status} />
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

function NovoOrcamentoForm({
  companyId,
  clientes,
  obras,
  onCancel,
}: {
  companyId: string;
  clientes: Cliente[];
  obras: Obra[];
  onCancel: () => void;
}) {
  const { user } = useAuthUser();
  const [nome, setNome] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [obraId, setObraId] = useState("");
  const [usaFases, setUsaFases] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro(null);
    try {
      const { data, error } = await supabase
        .from("orcamentos")
        .insert({
          company_id: companyId,
          nome: nome.toUpperCase(),
          cliente_id: clienteId || null,
          obra_id: obraId || null,
          usa_fases: usaFases,
          responsavel: user?.full_name || user?.username || null,
          valor: 0,
        })
        .select()
        .single();
      if (error) throw error;
      setCreatedId(data.id);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao criar orçamento");
    } finally {
      setLoading(false);
    }
  }

  if (createdId) {
    return (
      <div className="rounded-lg border border-line bg-card p-6 mb-6 text-center">
        <p className="text-sm text-ok font-semibold mb-3">Orçamento criado! Agora adicione os serviços e itens.</p>
        <Link
          to="/erp/orcamentos/$orcamentoId"
          params={{ orcamentoId: createdId }}
          className="btn-cta inline-block"
        >
          Continuar montagem →
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-line bg-card p-6 mb-6">
      <h3 className="font-bold mb-4">Novo Orçamento</h3>
      <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="block text-xs font-semibold text-muted-foreground mb-1">Nome *</label>
          <input
            required
            className="field"
            placeholder="Ex: ÁREA GOURMET 29M² C/ CHURRASQUEIRA"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">Cliente *</label>
          <select required className="field" value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
            <option value="">Selecione...</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">Obra (opcional)</label>
          <select className="field" value={obraId} onChange={(e) => setObraId(e.target.value)}>
            <option value="">Não vinculada</option>
            {obras.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nome}
              </option>
            ))}
          </select>
        </div>

        <label className="md:col-span-2 flex items-center gap-3 rounded-lg border border-line bg-side p-3">
          <input type="checkbox" checked={usaFases} onChange={(e) => setUsaFases(e.target.checked)} className="w-4 h-4" />
          <div>
            <p className="text-sm font-semibold">Organizar por fases</p>
            <p className="text-xs text-muted-foreground">
              Agrupa os serviços em fases (ex: Fase 1 — Cinza, Fase 2 — Pintura). Deixe desmarcado para lista simples.
            </p>
          </div>
        </label>

        {erro && <p className="md:col-span-2 text-sm text-err">{erro}</p>}

        <div className="md:col-span-2 flex gap-3">
          <button type="submit" disabled={loading} className="btn-cta disabled:opacity-50">
            {loading ? "Criando..." : "Criar e montar orçamento"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg bg-side px-4 py-2.5 text-sm font-semibold hover:bg-side/80"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
