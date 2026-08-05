import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/useAuth";
import { ErpLayout, StatusBadge } from "@/components/ErpLayout";
import type { Cliente } from "@/types";

export const Route = createFileRoute("/_authenticated/erp/clientes")({
  head: () => ({ meta: [{ title: "Clientes — ObraFlow Gestão" }] }),
  component: ClientesPage,
});

function ClientesPage() {
  const { companyId, loading: companyLoading } = useActiveCompany();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (companyId) load();
  }, [companyId]);

  async function load() {
    if (!companyId) return;
    setLoading(true);
    const { data } = await supabase
      .from("clientes")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    setClientes(data || []);
    setLoading(false);
  }

  async function toggleStatus(c: Cliente) {
    await supabase
      .from("clientes")
      .update({ status: c.status === "ATIVO" ? "INATIVO" : "ATIVO" })
      .eq("id", c.id);
    load();
  }

  async function remove(c: Cliente) {
    if (!confirm(`Excluir o cliente "${c.nome}"?`)) return;
    await supabase.from("clientes").delete().eq("id", c.id);
    load();
  }

  const filtered = clientes.filter((c) =>
    c.nome.toLowerCase().includes(search.toLowerCase())
  );

  if (companyLoading) return null;

  return (
    <ErpLayout
      title="Clientes"
      breadcrumb="Clientes"
      actions={
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="btn-cta"
        >
          + Novo Cliente
        </button>
      }
    >
      {showForm && (
        <ClienteForm
          companyId={companyId!}
          initial={editing}
          onDone={() => {
            setShowForm(false);
            load();
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      <div className="rounded-lg border border-line bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold">Cadastro</h3>
          <input
            className="field w-64"
            placeholder="Buscar cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum cliente encontrado.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground uppercase border-b border-line">
                <th className="pb-2">Nome</th>
                <th className="pb-2">Documento</th>
                <th className="pb-2">Tipo</th>
                <th className="pb-2">Contato</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td className="py-3 font-semibold">{c.nome}</td>
                  <td className="py-3 text-muted-foreground">{c.documento || "—"}</td>
                  <td className="py-3 text-muted-foreground">{c.tipo}</td>
                  <td className="py-3 text-muted-foreground">
                    {[c.telefone, c.email].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="py-3">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditing(c);
                          setShowForm(true);
                        }}
                        className="text-xs text-cta hover:underline"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => toggleStatus(c)}
                        className="text-xs text-muted-foreground hover:underline"
                      >
                        {c.status === "ATIVO" ? "Desativar" : "Ativar"}
                      </button>
                      <button
                        onClick={() => remove(c)}
                        className="text-xs text-err hover:underline"
                      >
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

function ClienteForm({
  companyId,
  initial,
  onDone,
  onCancel,
}: {
  companyId: string;
  initial: Cliente | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [nome, setNome] = useState(initial?.nome || "");
  const [documento, setDocumento] = useState(initial?.documento || "");
  const [tipo, setTipo] = useState<"Pessoa Física" | "Empresa">(
    initial?.tipo || "Pessoa Física"
  );
  const [telefone, setTelefone] = useState(initial?.telefone || "");
  const [email, setEmail] = useState(initial?.email || "");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro(null);
    try {
      if (initial) {
        const { error } = await supabase
          .from("clientes")
          .update({ nome, documento, tipo, telefone, email })
          .eq("id", initial.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("clientes").insert({
          company_id: companyId,
          nome,
          documento,
          tipo,
          telefone,
          email,
        });
        if (error) throw error;
      }
      onDone();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-line bg-card p-6 mb-6">
      <h3 className="font-bold mb-4">{initial ? "Editar Cliente" : "Novo Cliente"}</h3>
      <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">Nome *</label>
          <input required className="field" value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">Documento</label>
          <input className="field" value={documento} onChange={(e) => setDocumento(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">Tipo</label>
          <select className="field" value={tipo} onChange={(e) => setTipo(e.target.value as any)}>
            <option value="Pessoa Física">Pessoa Física</option>
            <option value="Empresa">Empresa</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">Telefone</label>
          <input className="field" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-semibold text-muted-foreground mb-1">Email</label>
          <input className="field" value={email} onChange={(e) => setEmail(e.target.value)} />
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
