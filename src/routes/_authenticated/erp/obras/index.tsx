import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/useAuth";
import { ErpLayout, StatusBadge, money } from "@/components/ErpLayout";
import type { Obra, ObraStatus, Cliente } from "@/types";

export const Route = createFileRoute("/_authenticated/erp/obras/")({
  head: () => ({ meta: [{ title: "Obras — ObraFlow Gestão" }] }),
  component: ObrasPage,
});

const FILTERS: { label: string; value: ObraStatus | "TODAS" }[] = [
  { label: "Todas", value: "TODAS" },
  { label: "Planejamento", value: "PLANEJAMENTO" },
  { label: "Em Execução", value: "EM EXECUÇÃO" },
  { label: "Medição", value: "MEDIÇÃO" },
  { label: "Concluída", value: "CONCLUÍDA" },
  { label: "Inativa", value: "INATIVA" },
];

function ObrasPage() {
  const { companyId, loading: companyLoading } = useActiveCompany();
  const [obras, setObras] = useState<Obra[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<ObraStatus | "TODAS">("TODAS");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (companyId) load();
  }, [companyId]);

  async function load() {
    if (!companyId) return;
    setLoading(true);
    const [{ data: obrasData }, { data: clientesData }] = await Promise.all([
      supabase
        .from("obras")
        .select("*, cliente:clientes(nome)")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false }),
      supabase
        .from("clientes")
        .select("*")
        .eq("company_id", companyId)
        .eq("status", "ATIVO")
        .order("nome"),
    ]);
    setObras(obrasData || []);
    setClientes(clientesData || []);
    setLoading(false);
  }

  async function setStatus(o: Obra, status: ObraStatus) {
    await supabase.from("obras").update({ status }).eq("id", o.id);
    load();
  }

  async function remove(o: Obra) {
    if (!confirm(`Excluir a obra "${o.nome}"?`)) return;
    await supabase.from("obras").delete().eq("id", o.id);
    load();
  }

  const filtered = obras.filter(
    (o) =>
      (filter === "TODAS" || o.status === filter) &&
      o.nome.toLowerCase().includes(search.toLowerCase())
  );

  if (companyLoading) return null;

  return (
    <ErpLayout
      title="Obras"
      breadcrumb="Obras"
      actions={
        <button onClick={() => setShowForm(true)} className="btn-cta">
          + Nova Obra
        </button>
      }
    >
      {showForm && (
        <ObraForm
          companyId={companyId!}
          clientes={clientes}
          onDone={() => {
            setShowForm(false);
            load();
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      <div className="rounded-lg border border-line bg-card p-4 mb-6 flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                filter === f.value
                  ? "bg-cta text-cta-foreground"
                  : "bg-side text-foreground hover:bg-side/80"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          className="field w-56"
          placeholder="Buscar obra..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="rounded-lg border border-line bg-card p-6">
        <h3 className="font-bold mb-4">Obras ({filtered.length})</h3>
        {loading ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma obra encontrada.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground uppercase border-b border-line">
                <th className="pb-2">Obra</th>
                <th className="pb-2">Cliente</th>
                <th className="pb-2">Prazo</th>
                <th className="pb-2">Valor</th>
                <th className="pb-2">Avanço</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((o) => (
                <tr key={o.id}>
                  <td className="py-3 font-semibold">
                    <Link
                      to="/erp/obras/$obraId"
                      params={{ obraId: o.id }}
                      className="hover:text-cta hover:underline"
                    >
                      {o.nome}
                    </Link>
                  </td>
                  <td className="py-3 text-muted-foreground">{o.cliente?.nome || "—"}</td>
                  <td className="py-3 text-muted-foreground">
                    {o.prazo ? new Date(o.prazo).toLocaleDateString("pt-BR") : "—"}
                  </td>
                  <td className="py-3">{money(Number(o.valor))}</td>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-side overflow-hidden">
                        <div className="h-full bg-cta" style={{ width: `${o.avanco}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground">{o.avanco}%</span>
                    </div>
                  </td>
                  <td className="py-3">
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="py-3">
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => setStatus(o, "EM EXECUÇÃO")}
                        className="text-xs text-cta hover:underline"
                      >
                        Em andamento
                      </button>
                      <button
                        onClick={() => setStatus(o, "CONCLUÍDA")}
                        className="text-xs text-ok hover:underline"
                      >
                        Concluída
                      </button>
                      <button
                        onClick={() => setStatus(o, "INATIVA")}
                        className="text-xs text-muted-foreground hover:underline"
                      >
                        Desativar
                      </button>
                      <button onClick={() => remove(o)} className="text-xs text-err hover:underline">
                        Excluir
                      </button>
                    </div>
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

function ObraForm({
  companyId,
  clientes,
  onDone,
  onCancel,
}: {
  companyId: string;
  clientes: Cliente[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [nome, setNome] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [local, setLocal] = useState("");
  const [prazo, setPrazo] = useState("");
  const [valor, setValor] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro(null);
    try {
      const { error } = await supabase.from("obras").insert({
        company_id: companyId,
        nome,
        cliente_id: clienteId || null,
        local,
        prazo: prazo || null,
        valor: Number(valor) || 0,
      });
      if (error) throw error;
      onDone();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-line bg-card p-6 mb-6">
      <h3 className="font-bold mb-4">Nova Obra</h3>
      <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="block text-xs font-semibold text-muted-foreground mb-1">Nome *</label>
          <input required className="field" value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">Cliente</label>
          <select className="field" value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
            <option value="">Selecione...</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">Local</label>
          <input className="field" value={local} onChange={(e) => setLocal(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">Prazo</label>
          <input type="date" className="field" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">Valor (R$)</label>
          <input
            type="number"
            step="0.01"
            className="field"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
          />
        </div>

        {erro && <p className="md:col-span-2 text-sm text-err">{erro}</p>}

        <div className="md:col-span-2 flex gap-3">
          <button type="submit" disabled={loading} className="btn-cta disabled:opacity-50">
            {loading ? "Salvando..." : "Salvar"}
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
