import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/useAuth";
import { ErpLayout, StatusBadge } from "@/components/ErpLayout";
import type { Fornecedor } from "@/types";

export const Route = createFileRoute("/_authenticated/erp/fornecedores")({
  head: () => ({ meta: [{ title: "Fornecedores — ObraFlow Gestão" }] }),
  component: FornecedoresPage,
});

function Stars({ n }: { n: number }) {
  return (
    <span className="text-cta">
      {"★".repeat(n)}
      <span className="text-line">{"★".repeat(5 - n)}</span>
    </span>
  );
}

function FornecedoresPage() {
  const { companyId, loading: companyLoading } = useActiveCompany();
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Fornecedor | null>(null);
  const [selected, setSelected] = useState<Fornecedor | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"TODOS" | "ATIVO" | "INATIVO">("TODOS");
  const [categoriaFilter, setCategoriaFilter] = useState("");

  useEffect(() => {
    if (companyId) load();
  }, [companyId]);

  async function load() {
    if (!companyId) return;
    setLoading(true);
    const { data } = await supabase
      .from("fornecedores")
      .select("*")
      .eq("company_id", companyId)
      .order("nome");
    setFornecedores(data || []);
    setLoading(false);
  }

  async function toggleStatus(f: Fornecedor) {
    await supabase
      .from("fornecedores")
      .update({ status: f.status === "ATIVO" ? "INATIVO" : "ATIVO" })
      .eq("id", f.id);
    load();
  }

  async function duplicar(f: Fornecedor) {
    await supabase.from("fornecedores").insert({
      company_id: f.company_id,
      nome: `${f.nome} (CÓPIA)`,
      cnpj: f.cnpj,
      categoria: f.categoria,
      avaliacao: f.avaliacao,
      status: f.status,
    });
    load();
  }

  async function excluir(f: Fornecedor) {
    if (!confirm(`Excluir o fornecedor "${f.nome}"?`)) return;
    const { error } = await supabase.from("fornecedores").delete().eq("id", f.id);
    if (error) {
      alert("Não foi possível excluir: este fornecedor tem pedidos vinculados. Desative-o em vez de excluir.");
      return;
    }
    setSelected(null);
    load();
  }

  if (companyLoading) return null;

  const filteredFornecedores = fornecedores.filter((f) => {
    return (
      (statusFilter === "TODOS" || f.status === statusFilter) &&
      (f.nome.toLowerCase().includes(search.toLowerCase()) || f.cnpj?.includes(search) || f.categoria?.toLowerCase().includes(search.toLowerCase())) &&
      (!categoriaFilter || f.categoria?.toLowerCase().includes(categoriaFilter.toLowerCase()))
    );
  });

  return (
    <ErpLayout
      title="Fornecedores"
      breadcrumb="Fornecedores"
      actions={
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="btn-cta"
        >
          + Novo Fornecedor
        </button>
      }
    >
      {showForm && (
        <FornecedorForm
          key={editing?.id || "novo"}
          companyId={companyId!}
          fornecedor={editing}
          onDone={() => {
            setShowForm(false);
            setEditing(null);
            setSelected(null);
            load();
          }}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}

      <div className="rounded-lg border border-line bg-card p-4 mb-6 flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setStatusFilter("TODOS")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              statusFilter === "TODOS"
                ? "bg-cta text-cta-foreground"
                : "bg-side text-foreground hover:bg-side/80"
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setStatusFilter("ATIVO")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              statusFilter === "ATIVO"
                ? "bg-cta text-cta-foreground"
                : "bg-side text-foreground hover:bg-side/80"
            }`}
          >
            Ativos
          </button>
          <button
            onClick={() => setStatusFilter("INATIVO")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              statusFilter === "INATIVO"
                ? "bg-cta text-cta-foreground"
                : "bg-side text-foreground hover:bg-side/80"
            }`}
          >
            Inativos
          </button>
        </div>
        <div className="flex gap-2 flex-wrap">
          <input
            className="field w-56"
            placeholder="Buscar fornecedor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <input
            className="field w-56"
            placeholder="Categoria..."
            value={categoriaFilter}
            onChange={(e) => setCategoriaFilter(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 rounded-lg border border-line bg-card p-6">
          <h3 className="font-bold mb-4">Cadastro</h3>
          {loading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : filteredFornecedores.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum fornecedor encontrado.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground uppercase border-b border-line">
                  <th className="pb-2">Fornecedor</th>
                  <th className="pb-2">CNPJ</th>
                  <th className="pb-2">Categoria</th>
                  <th className="pb-2">Avaliação</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredFornecedores.map((f) => (
                  <tr
                    key={f.id}
                    onClick={() => setSelected(f)}
                    className="cursor-pointer hover:bg-side/30"
                  >
                    <td className="py-3 font-semibold">{f.nome}</td>
                    <td className="py-3 text-muted-foreground">{f.cnpj || "—"}</td>
                    <td className="py-3 text-muted-foreground">{f.categoria || "—"}</td>
                    <td className="py-3">
                      <Stars n={f.avaliacao} />
                    </td>
                    <td className="py-3">
                      <StatusBadge status={f.status} />
                    </td>
                    <td className="py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-3">
                        <button
                          onClick={() => {
                            setEditing(f);
                            setShowForm(true);
                          }}
                          className="text-xs text-cta hover:underline"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => duplicar(f)}
                          className="text-xs text-cta hover:underline"
                        >
                          Duplicar
                        </button>
                        <button
                          onClick={() => excluir(f)}
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

        <div className="rounded-lg border border-line bg-card p-6">
          <h3 className="font-bold mb-4">
            {selected ? selected.nome : "Selecione um fornecedor"}
          </h3>
          {!selected ? (
            <p className="text-sm text-muted-foreground">
              Clique em um fornecedor para ver detalhes e ações.
            </p>
          ) : (
            <div className="space-y-3 text-sm">
              <p>
                <span className="text-muted-foreground">Categoria:</span> {selected.categoria || "—"}
              </p>
              <p>
                <span className="text-muted-foreground">CNPJ:</span> {selected.cnpj || "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Avaliação:</span> <Stars n={selected.avaliacao} />
              </p>
              <button
                onClick={() => toggleStatus(selected)}
                className="text-xs text-cta hover:underline"
              >
                {selected.status === "ATIVO" ? "Desativar" : "Ativar"} fornecedor
              </button>
            </div>
          )}
        </div>
      </div>
    </ErpLayout>
  );
}

function FornecedorForm({
  companyId,
  fornecedor,
  onDone,
  onCancel,
}: {
  companyId: string;
  fornecedor?: Fornecedor | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [nome, setNome] = useState(fornecedor?.nome || "");
  const [cnpj, setCnpj] = useState(fornecedor?.cnpj || "");
  const [categoria, setCategoria] = useState(fornecedor?.categoria || "");
  const [avaliacao, setAvaliacao] = useState(fornecedor?.avaliacao ?? 5);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro(null);
    try {
      const { error } = fornecedor
        ? await supabase
            .from("fornecedores")
            .update({ nome, cnpj, categoria, avaliacao })
            .eq("id", fornecedor.id)
        : await supabase.from("fornecedores").insert({
            company_id: companyId,
            nome,
            cnpj,
            categoria,
            avaliacao,
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
      <h3 className="font-bold mb-4">
        {fornecedor ? `Editar: ${fornecedor.nome}` : "Novo Fornecedor"}
      </h3>
      <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">Nome *</label>
          <input required className="field" value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">CNPJ</label>
          <input className="field" value={cnpj} onChange={(e) => setCnpj(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">Categoria</label>
          <input className="field" value={categoria} onChange={(e) => setCategoria(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">Avaliação</label>
          <select className="field" value={avaliacao} onChange={(e) => setAvaliacao(Number(e.target.value))}>
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {n} estrela{n > 1 ? "s" : ""}
              </option>
            ))}
          </select>
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
