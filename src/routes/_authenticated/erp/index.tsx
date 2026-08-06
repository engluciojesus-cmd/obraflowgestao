import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/useAuth";
import { ErpLayout, StatusBadge, money } from "@/components/ErpLayout";
import type { Obra, Orcamento, Pedido } from "@/types";

export const Route = createFileRoute("/_authenticated/erp/")({
  head: () => ({ meta: [{ title: "Início — ObraFlow Gestão" }] }),
  component: ErpDashboard,
});

function ErpDashboard() {
  const { companyId, loading: companyLoading } = useActiveCompany();
  const [obras, setObras] = useState<Obra[]>([]);
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [clientesCount, setClientesCount] = useState(0);
  const [aPagar, setAPagar] = useState(0);
  const [aReceber, setAReceber] = useState(0);
  const [caixa, setCaixa] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showCamera, setShowCamera] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    load();
  }, [companyId]);

  async function load() {
    if (!companyId) return;
    setLoading(true);
    const [
      { data: obrasData },
      { data: orcData },
      { data: pedData },
      { count: clientesN },
      { data: lancData },
      { data: medData },
    ] = await Promise.all([
      supabase
        .from("obras")
        .select("*, cliente:clientes(nome)")
        .eq("company_id", companyId)
        .neq("status", "INATIVA")
        .order("created_at", { ascending: false }),
      supabase
        .from("orcamentos")
        .select("*, cliente:clientes(nome)")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(3),
      supabase
        .from("pedidos")
        .select("*, fornecedor:fornecedores(nome)")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(3),
      supabase
        .from("clientes")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("status", "ATIVO"),
      supabase
        .from("lancamentos")
        .select("valor, status")
        .eq("company_id", companyId),
      supabase
        .from("medicoes")
        .select("valor, recebido, status")
        .eq("company_id", companyId),
    ]);

    setObras(obrasData || []);
    setOrcamentos(orcData || []);
    setPedidos(pedData || []);
    setClientesCount(clientesN || 0);

    const pagar = (lancData || [])
      .filter((l) => l.status !== "PAGA" && l.status !== "CANCELADA")
      .reduce((s, l) => s + Number(l.valor), 0);
    setAPagar(pagar);

    const receber = (medData || [])
      .filter((m) => m.status !== "PAGA")
      .reduce((s, m) => s + (Number(m.valor) - Number(m.recebido)), 0);
    setAReceber(receber);

    const pago = (lancData || [])
      .filter((l) => l.status === "PAGA")
      .reduce((s, l) => s + Number(l.valor), 0);
    const recebido = (medData || []).reduce((s, m) => s + Number(m.recebido), 0);
    setCaixa(recebido - pago);

    setLoading(false);
  }

  if (companyLoading || loading) {
    return (
      <ErpLayout title="Painel Geral">
        <p className="text-muted-foreground">Carregando...</p>
      </ErpLayout>
    );
  }

  if (!companyId) {
    return (
      <ErpLayout title="Painel Geral">
        <div className="rounded-lg border border-line bg-card p-8 text-center text-muted-foreground">
          Nenhuma empresa associada. Peça ao administrador para criar uma empresa.
        </div>
      </ErpLayout>
    );
  }

  return (
    <ErpLayout
      title="Painel Geral"
      actions={
        <button onClick={() => setShowCamera(true)} className="btn-cta flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          Ler nota
        </button>
      }
    >
      {showCamera && <LeitorNota onClose={() => setShowCamera(false)} />}

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <div className="rounded-lg border border-line bg-card p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Obras ativas</p>
          <p className="mt-1 text-2xl font-bold">{obras.length}</p>
          <p className="text-xs text-muted-foreground mt-1">{clientesCount} clientes cadastrados</p>
        </div>
        <div className="rounded-lg border border-line bg-card p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Total orçado</p>
          <p className="mt-1 text-2xl font-bold">
            {money(orcamentos.reduce((s, o) => s + Number(o.valor), 0))}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{orcamentos.length} orçamentos recentes</p>
        </div>
        <div className="rounded-lg border border-line bg-card p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase">A pagar</p>
          <p className="mt-1 text-2xl font-bold text-err">{money(aPagar)}</p>
        </div>
        <div className="rounded-lg border border-line bg-card p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase">A receber (medições)</p>
          <p className="mt-1 text-2xl font-bold text-ok">{money(aReceber)}</p>
          <p className="text-xs text-muted-foreground mt-1">Caixa: {money(caixa)}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 mb-6">
        {/* Orçamentos recentes */}
        <div className="rounded-lg border border-line bg-card p-6">
          <h3 className="font-bold mb-4">Orçamentos recentes</h3>
          {orcamentos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum orçamento ainda.</p>
          ) : (
            <div className="space-y-3">
              {orcamentos.map((o) => (
                <div key={o.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-semibold">{o.nome}</p>
                    <p className="text-xs text-muted-foreground">{o.cliente?.nome || "—"}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{money(Number(o.valor))}</p>
                    <StatusBadge status={o.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pedidos em aberto */}
        <div className="rounded-lg border border-line bg-card p-6">
          <h3 className="font-bold mb-4">Pedidos recentes</h3>
          {pedidos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum pedido ainda.</p>
          ) : (
            <div className="space-y-3">
              {pedidos.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-semibold">{p.fornecedor?.nome || "—"}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{money(Number(p.valor))}</p>
                    <StatusBadge status={p.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Obras */}
      <div className="rounded-lg border border-line bg-card p-6">
        <h3 className="font-bold mb-4">Obras</h3>
        {obras.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma obra ainda.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground uppercase">
                <th className="pb-2">Obra</th>
                <th className="pb-2">Cliente</th>
                <th className="pb-2">Prazo</th>
                <th className="pb-2">Avanço</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {obras.map((o) => (
                <tr key={o.id}>
                  <td className="py-3 font-semibold">{o.nome}</td>
                  <td className="py-3 text-muted-foreground">{o.cliente?.nome || "—"}</td>
                  <td className="py-3 text-muted-foreground">
                    {o.prazo ? new Date(o.prazo).toLocaleDateString("pt-BR") : "—"}
                  </td>
                  <td className="py-3">
                    <div className="w-24 h-1.5 rounded-full bg-side overflow-hidden">
                      <div className="h-full bg-cta" style={{ width: `${o.avanco}%` }} />
                    </div>
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

type ItemLido = {
  descricao: string;
  quantidade: number | null;
  unidade: string | null;
  valor_unitario: number | null;
};

type NotaLida = {
  fornecedor: string | null;
  documento: string | null;
  data: string | null;
  itens: ItemLido[];
  total: number | null;
};

function LeitorNota({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [preview, setPreview] = useState<string | null>(null);
  const [lendo, setLendo] = useState(false);
  const [nota, setNota] = useState<NotaLida | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function processar(file: File) {
    setErro(null);
    setNota(null);
    setPreview(URL.createObjectURL(file));
    setLendo(true);

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
        reader.readAsDataURL(file);
      });

      const { data, error } = await supabase.functions.invoke("ler-nota", {
        body: { image: base64, media_type: file.type },
      });

      if (error) {
        const corpo = await (error as any)?.context?.json?.().catch(() => null);
        throw new Error(corpo?.error || error.message);
      }
      if (data?.error) throw new Error(data.error);

      setNota(data);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao ler o documento");
    } finally {
      setLendo(false);
    }
  }

  function atualizarItem(i: number, campo: keyof ItemLido, valor: string) {
    if (!nota) return;
    const itens = [...nota.itens];
    (itens[i] as any)[campo] =
      campo === "descricao" || campo === "unidade" ? valor : Number(valor) || 0;
    setNota({ ...nota, itens });
  }

  function irParaPedido() {
    if (!nota) return;
    // O formulário de pedido lê estes itens ao abrir
    sessionStorage.setItem(
      "obraflow:nota-lida",
      JSON.stringify({
        fornecedor: nota.fornecedor,
        itens: nota.itens.filter((it: any) => it.descricao),
      })
    );
    navigate({ to: "/erp/compras/itens" });
  }

  const total = (nota?.itens || []).reduce(
    (s: number, it: any) => s + (Number(it.quantidade) || 0) * (Number(it.valor_unitario) || 0),
    0
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl rounded-lg border border-line bg-card p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold">Ler nota de material</h3>
            <p className="text-sm text-muted-foreground">
              Tire uma foto da nota que chegou na obra. Os itens vão direto para o pedido.
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>

        {!nota && (
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line bg-side/30 p-6 cursor-pointer hover:border-cta">
              <span className="text-2xl">📷</span>
              <span className="text-sm font-semibold">Tirar foto</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && processar(e.target.files[0])}
              />
            </label>
            <label className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line bg-side/30 p-6 cursor-pointer hover:border-cta">
              <span className="text-2xl">🖼️</span>
              <span className="text-sm font-semibold">Escolher imagem</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && processar(e.target.files[0])}
              />
            </label>
          </div>
        )}

        {preview && !nota && (
          <img src={preview} alt="" className="max-h-48 mx-auto rounded-lg object-contain" />
        )}

        {lendo && (
          <div className="rounded-lg bg-side p-4 text-center text-sm">
            <p className="font-semibold">Lendo o documento...</p>
            <p className="text-xs text-muted-foreground mt-1">Leva alguns segundos.</p>
          </div>
        )}

        {erro && (
          <div className="rounded-lg bg-err/10 border border-err/20 px-4 py-3 text-sm text-err">
            {erro}
          </div>
        )}

        {nota && (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3 text-sm">
              <div className="rounded-lg bg-side p-3">
                <p className="text-xs text-muted-foreground">Fornecedor</p>
                <p className="font-semibold">{nota.fornecedor || "—"}</p>
              </div>
              <div className="rounded-lg bg-side p-3">
                <p className="text-xs text-muted-foreground">Documento</p>
                <p className="font-semibold">{nota.documento || "—"}</p>
              </div>
              <div className="rounded-lg bg-side p-3">
                <p className="text-xs text-muted-foreground">Data</p>
                <p className="font-semibold">
                  {nota.data ? new Date(nota.data + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
                </p>
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold mb-2">
                {nota.itens.length} {nota.itens.length === 1 ? "item lido" : "itens lidos"} — confira
                antes de continuar
              </p>
              <div className="space-y-2">
                {nota.itens.map((it, i) => (
                  <div key={i} className="grid gap-2 md:grid-cols-12 items-center">
                    <input
                      className="field text-sm md:col-span-6"
                      value={it.descricao || ""}
                      onChange={(e) => atualizarItem(i, "descricao", e.target.value)}
                    />
                    <input
                      type="number"
                      step="0.01"
                      className="field text-sm md:col-span-2"
                      value={it.quantidade ?? ""}
                      onChange={(e) => atualizarItem(i, "quantidade", e.target.value)}
                    />
                    <input
                      className="field text-sm md:col-span-1"
                      value={it.unidade || ""}
                      onChange={(e) => atualizarItem(i, "unidade", e.target.value)}
                    />
                    <input
                      type="number"
                      step="0.01"
                      className="field text-sm md:col-span-3"
                      value={it.valor_unitario ?? ""}
                      onChange={(e) => atualizarItem(i, "valor_unitario", e.target.value)}
                    />
                  </div>
                ))}
              </div>
              <p className="mt-3 text-sm font-semibold">Total: {money(total)}</p>
            </div>

            <div className="flex gap-3">
              <button onClick={irParaPedido} className="btn-cta">
                Criar pedido com estes itens
              </button>
              <button
                onClick={() => {
                  setNota(null);
                  setPreview(null);
                }}
                className="rounded-lg bg-side px-4 py-2.5 text-sm font-semibold hover:bg-side/80"
              >
                Ler outra
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
