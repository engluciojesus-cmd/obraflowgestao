import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/useAuth";
import { ErpLayout, StatusBadge, money } from "@/components/ErpLayout";
import { ComprasSubNav } from "@/components/ComprasSubNav";
import type { Pedido, PedidoStatus, Fornecedor, Obra } from "@/types";
import { itemTotal } from "@/types";

export const Route = createFileRoute("/_authenticated/erp/compras/itens")({
  head: () => ({ meta: [{ title: "Itens — Compras — ObraFlow Gestão" }] }),
  component: ItensPage,
});

interface OrcamentoItemOption {
  id: string;
  label: string;
}

function ItensPage() {
  const { companyId, loading: companyLoading } = useActiveCompany();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showMedicao, setShowMedicao] = useState(false);
  const [obraFilter, setObraFilter] = useState("");
  const [fornecedorFilter, setFornecedorFilter] = useState("");

  useEffect(() => {
    if (companyId) load();
  }, [companyId]);

  useEffect(() => {
    if (sessionStorage.getItem("obraflow:nota-lida")) setShowForm(true);
  }, []);

  async function load() {
    if (!companyId) return;
    setLoading(true);
    const [{ data: pedData }, { data: fornData }, { data: obrasData }] = await Promise.all([
      supabase
        .from("pedidos")
        .select(
          "*, fornecedor:fornecedores(nome), obra:obras(nome), pedido_itens(*, orcamento_item:orcamento_itens(descricao, servico:orcamento_servicos(nome)))"
        )
        .eq("company_id", companyId)
        .order("created_at", { ascending: false }),
      supabase.from("fornecedores").select("*").eq("company_id", companyId).order("nome"),
      supabase.from("obras").select("*").eq("company_id", companyId).order("nome"),
    ]);
    setPedidos((pedData as any) || []);
    setFornecedores(fornData || []);
    setObras(obrasData || []);
    setLoading(false);
  }

  async function setStatus(p: Pedido, status: PedidoStatus) {
    await supabase.from("pedidos").update({ status }).eq("id", p.id);
    load();
  }

  const filtered = pedidos.filter(
    (p) =>
      (!obraFilter || p.obra_id === obraFilter) &&
      (!fornecedorFilter || p.fornecedor_id === fornecedorFilter)
  );
  const total = filtered.reduce((s, p) => s + Number(p.valor), 0);
  const itensVinculados = filtered.reduce(
    (s, p) => s + (p.pedido_itens || []).filter((i) => i.orcamento_item_id).length,
    0
  );

  if (companyLoading) return null;

  return (
    <ErpLayout
      title="Itens"
      breadcrumb={
        <>
          Compras / Itens
        </>
      }
      actions={
        <div className="flex gap-2">
          <button
            onClick={() => {
              setShowMedicao(true);
              setShowForm(false);
            }}
            className="rounded-lg bg-side px-4 py-2.5 text-sm font-semibold hover:bg-side/80"
          >
            + Medição
          </button>
          <button
            onClick={() => {
              setShowForm(true);
              setShowMedicao(false);
            }}
            className="btn-cta"
          >
            + Novo Pedido
          </button>
        </div>
      }
    >
      <ComprasSubNav />

      {showMedicao && (
        <MedicaoForm
          companyId={companyId!}
          obras={obras}
          onDone={() => {
            setShowMedicao(false);
            load();
          }}
          onCancel={() => setShowMedicao(false)}
        />
      )}

      {showForm && (
        <PedidoForm
          companyId={companyId!}
          fornecedores={fornecedores}
          obras={obras}
          onDone={() => {
            setShowForm(false);
            load();
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      <div className="rounded-lg border border-line bg-card p-4 mb-6 flex gap-3 flex-wrap items-center">
        <select className="field w-56" value={obraFilter} onChange={(e) => setObraFilter(e.target.value)}>
          <option value="">Todas as obras</option>
          {obras.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nome}
            </option>
          ))}
        </select>
        <select
          className="field w-56"
          value={fornecedorFilter}
          onChange={(e) => setFornecedorFilter(e.target.value)}
        >
          <option value="">Todos os fornecedores</option>
          {fornecedores.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nome}
            </option>
          ))}
        </select>
        {(obraFilter || fornecedorFilter) && (
          <button
            onClick={() => {
              setObraFilter("");
              setFornecedorFilter("");
            }}
            className="text-xs text-cta hover:underline"
          >
            Limpar
          </button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <div className="rounded-lg border border-line bg-card p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Pedidos filtrados</p>
          <p className="mt-1 text-2xl font-bold">{filtered.length}</p>
        </div>
        <div className="rounded-lg border border-line bg-card p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Valor total</p>
          <p className="mt-1 text-2xl font-bold">{money(total)}</p>
        </div>
        <div className="rounded-lg border border-line bg-card p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Itens vinculados a orçamento</p>
          <p className="mt-1 text-2xl font-bold">{itensVinculados}</p>
        </div>
      </div>

      <div className="rounded-lg border border-line bg-card p-6">
        <h3 className="font-bold mb-4">Pedidos</h3>
        {loading ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum pedido encontrado.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground uppercase border-b border-line">
                <th className="pb-2">Fornecedor</th>
                <th className="pb-2">Obra</th>
                <th className="pb-2">Itens × Orçamento</th>
                <th className="pb-2">Data</th>
                <th className="pb-2">Valor</th>
                <th className="pb-2">Pagamento</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td className="py-3 font-semibold">{p.fornecedor?.nome || "—"}</td>
                  <td className="py-3 text-muted-foreground">{p.obra?.nome || "—"}</td>
                  <td className="py-3 text-muted-foreground text-xs">
                    {(p.pedido_itens || []).map((it, i) => (
                      <div key={i}>
                        {it.descricao}
                        {it.orcamento_item ? (
                          <span className="text-cta"> → {it.orcamento_item.servico?.nome}</span>
                        ) : (
                          <span> → sem vínculo</span>
                        )}
                      </div>
                    ))}
                  </td>
                  <td className="py-3 text-muted-foreground">
                    {new Date(p.data).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="py-3">{money(Number(p.valor))}</td>
                  <td className="py-3 text-muted-foreground">{p.forma_pagamento || "—"}</td>
                  <td className="py-3">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="py-3">
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => setStatus(p, "CONFIRMADO")}
                        className="text-xs text-cta hover:underline"
                      >
                        Confirmar
                      </button>
                      <button
                        onClick={() => setStatus(p, "RECEBIDO")}
                        className="text-xs text-ok hover:underline"
                      >
                        Recebido
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

function PedidoForm({
  companyId,
  fornecedores,
  obras,
  onDone,
  onCancel,
}: {
  companyId: string;
  fornecedores: Fornecedor[];
  obras: Obra[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [obraId, setObraId] = useState("");
  const [fornecedorId, setFornecedorId] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("");
  const [tiposPagamento, setTiposPagamento] = useState<{ id: string; nome: string }[]>([]);
  const [itens, setItens] = useState(() => {
    const bruto = sessionStorage.getItem("obraflow:nota-lida");
    if (bruto) {
      sessionStorage.removeItem("obraflow:nota-lida");
      try {
        const nota = JSON.parse(bruto);
        if (Array.isArray(nota.itens) && nota.itens.length > 0) {
          return nota.itens.map((it: any) => ({
            descricao: String(it.descricao || "").toUpperCase(),
            quantidade: String(it.quantidade ?? 1),
            valor_unitario: String(it.valor_unitario ?? ""),
            orcamento_item_id: "",
          }));
        }
      } catch {
        // formato inválido
      }
    }
    return [{ descricao: "", quantidade: "1", valor_unitario: "", orcamento_item_id: "" }];
  });
  const [orcamentoItens, setOrcamentoItens] = useState<OrcamentoItemOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const navigate = useNavigate();

  async function irParaCotacao() {
    const itensValidos = itens.filter((it) => it.descricao.trim());
    if (itensValidos.length === 0) {
      setErro("Informe ao menos um item para cotar.");
      return;
    }
    setLoading(true);
    setErro(null);
    try {
      const { data: ultima } = await supabase
        .from("cotacoes")
        .select("numero")
        .eq("company_id", companyId)
        .order("numero", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: cotacao, error } = await supabase
        .from("cotacoes")
        .insert({
          company_id: companyId,
          obra_id: obraId || null,
          numero: (ultima?.numero || 0) + 1,
          descricao: itensValidos[0].descricao,
          status: "ABERTA",
        })
        .select()
        .single();
      if (error) throw error;

      const { error: itensError } = await supabase.from("cotacao_itens").insert(
        itensValidos.map((it, i) => ({
          cotacao_id: cotacao.id,
          descricao: it.descricao,
          quantidade: Number(it.quantidade) || 1,
          unidade: "un",
          orcamento_item_id: it.orcamento_item_id || null,
          ordem: i,
        }))
      );
      if (itensError) throw itensError;

      navigate({ to: "/erp/compras/cotacoes/$cotacaoId", params: { cotacaoId: cotacao.id } });
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao criar cotação");
      setLoading(false);
    }
  }

  useEffect(() => {
    supabase
      .from("tipos_pagamento")
      .select("id, nome")
      .eq("company_id", companyId)
      .order("nome")
      .then(({ data }) => setTiposPagamento(data || []));
  }, [companyId]);

  useEffect(() => {
    if (!obraId) {
      setOrcamentoItens([]);
      return;
    }
    loadItensDaObra();
  }, [obraId]);

  async function loadItensDaObra() {
    const { data: orcs } = await supabase
      .from("orcamentos")
      .select("id, nome, servicos:orcamento_servicos(id, nome, itens:orcamento_itens(id, descricao))")
      .eq("obra_id", obraId);

    const options: OrcamentoItemOption[] = [];
    for (const orc of orcs || []) {
      for (const sv of (orc as any).servicos || []) {
        for (const it of sv.itens || []) {
          options.push({
            id: it.id,
            label: `${orc.nome} / ${sv.nome} — ${it.descricao}`,
          });
        }
      }
    }
    setOrcamentoItens(options);
  }

  function addItem() {
    setItens([...itens, { descricao: "", quantidade: "1", valor_unitario: "", orcamento_item_id: "" }]);
  }
  function updateItem(i: number, field: string, value: string) {
    const copy = [...itens];
    (copy[i] as any)[field] = value;
    setItens(copy);
  }
  function removeItem(i: number) {
    setItens(itens.filter((_, idx) => idx !== i));
  }

  const total = itens.reduce(
    (s, it) => s + Number(it.quantidade || 0) * Number(it.valor_unitario || 0),
    0
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro(null);
    try {
      const { data: pedido, error } = await supabase
        .from("pedidos")
        .insert({
          company_id: companyId,
          fornecedor_id: fornecedorId || null,
          obra_id: obraId,
          forma_pagamento: formaPagamento,
          valor: total,
        })
        .select()
        .single();
      if (error) throw error;

      const itensValidos = itens.filter((it) => it.descricao.trim());
      if (itensValidos.length > 0) {
        const { error: itemError } = await supabase.from("pedido_itens").insert(
          itensValidos.map((it) => ({
            pedido_id: pedido.id,
            descricao: it.descricao,
            quantidade: Number(it.quantidade) || 1,
            valor_unitario: Number(it.valor_unitario) || 0,
            orcamento_item_id: it.orcamento_item_id || null,
          }))
        );
        if (itemError) throw itemError;
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
      <h3 className="font-bold mb-4">Novo Pedido</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Obra *</label>
            <select required className="field" value={obraId} onChange={(e) => setObraId(e.target.value)}>
              <option value="">Selecione a obra primeiro...</option>
              {obras.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Fornecedor</label>
            <select
              className="field"
              value={fornecedorId}
              onChange={(e) => setFornecedorId(e.target.value)}
            >
              <option value="">Selecione...</option>
              {fornecedores.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Pagamento</label>
            <select
              className="field"
              value={formaPagamento}
              onChange={(e) => setFormaPagamento(e.target.value)}
            >
              <option value="">Selecione...</option>
              {tiposPagamento.map((t) => (
                <option key={t.id} value={t.nome}>
                  {t.nome}
                </option>
              ))}
            </select>
            {tiposPagamento.length === 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                Nenhuma cadastrada — configure em Segurança.
              </p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-2">Itens</label>
          <div className="space-y-2">
            {itens.map((it, i) => (
              <div key={i} className="grid gap-2 md:grid-cols-12 items-center">
                <input
                  className="field md:col-span-3"
                  placeholder="Descrição"
                  value={it.descricao}
                  onChange={(e) => updateItem(i, "descricao", e.target.value)}
                />
                <input
                  type="number"
                  className="field md:col-span-1"
                  placeholder="Qtd"
                  value={it.quantidade}
                  onChange={(e) => updateItem(i, "quantidade", e.target.value)}
                />
                <input
                  type="number"
                  step="0.01"
                  className="field md:col-span-2"
                  placeholder="Valor unit."
                  value={it.valor_unitario}
                  onChange={(e) => updateItem(i, "valor_unitario", e.target.value)}
                />
                <select
                  className="field md:col-span-5"
                  value={it.orcamento_item_id}
                  onChange={(e) => updateItem(i, "orcamento_item_id", e.target.value)}
                  disabled={!obraId}
                >
                  <option value="">
                    {obraId ? "Vincular a item de orçamento (opcional)" : "Selecione a obra primeiro"}
                  </option>
                  {orcamentoItens.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {itens.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(i)}
                    className="text-xs text-err md:col-span-1"
                  >
                    Remover
                  </button>
                )}
              </div>
            ))}
          </div>
          <button type="button" onClick={addItem} className="mt-2 text-xs text-cta hover:underline">
            + Adicionar item
          </button>
        </div>

        <p className="text-sm font-semibold">Total: {money(total)}</p>

        {erro && <p className="text-sm text-err">{erro}</p>}

        <div className="flex gap-3">
          <button type="submit" disabled={loading} className="btn-cta disabled:opacity-50">
            {loading ? "Salvando..." : "Salvar Pedido"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg bg-side px-4 py-2.5 text-sm font-semibold hover:bg-side/80"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={irParaCotacao}
            disabled={loading}
            className="rounded-lg border border-cta px-4 py-2.5 text-sm font-semibold text-cta hover:bg-cta/10 disabled:opacity-50"
          >
            Cotação
          </button>
        </div>
      </form>
    </div>
  );
}

type AlvoMedicao = {
  servicoId: string;
  itemId: string | null;
  label: string;
  valor: number;
  peso: number;
  jaMedido: number;
};

function MedicaoForm({
  companyId,
  obras,
  onDone,
  onCancel,
}: {
  companyId: string;
  obras: Obra[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [obraId, setObraId] = useState("");
  const [alvos, setAlvos] = useState<AlvoMedicao[]>([]);
  const [alvoKey, setAlvoKey] = useState("");
  const [percentual, setPercentual] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [proximoNumero, setProximoNumero] = useState(1);
  const [contratos, setContratos] = useState<{ id: string; identificador: string }[]>([]);
  const [contratoId, setContratoId] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!obraId) {
      setAlvos([]);
      setAlvoKey("");
      return;
    }
    carregar();
  }, [obraId]);

  async function carregar() {
    const [{ data: orcs }, { data: medicoes }, { data: contratosData }] = await Promise.all([
      supabase
        .from("orcamentos")
        .select(
          "servicos:orcamento_servicos(id, nome, peso, ordem, itens:orcamento_itens(id, descricao, modo, quantidade, valor_unitario, valor_verba, peso, ordem))"
        )
        .eq("obra_id", obraId),
      supabase.from("medicoes").select("*").eq("obra_id", obraId),
      supabase
        .from("contratos")
        .select("id, identificador")
        .eq("obra_id", obraId)
        .in("status", ["ASSINADO", "AGUARDANDO ASSINATURA"]),
    ]);
    setContratos(contratosData || []);

    const acumServico = new Map<string, number>();
    const acumItem = new Map<string, number>();
    let maiorNumero = 0;
    for (const m of medicoes || []) {
      const pct = Number(m.percentual_medido) || 0;
      maiorNumero = Math.max(maiorNumero, Number(m.numero) || 0);
      if (m.orcamento_item_id) {
        acumItem.set(m.orcamento_item_id, (acumItem.get(m.orcamento_item_id) || 0) + pct);
      } else if (m.servico_id) {
        acumServico.set(m.servico_id, (acumServico.get(m.servico_id) || 0) + pct);
      }
    }
    setProximoNumero(maiorNumero + 1);

    const lista: AlvoMedicao[] = [];
    for (const orc of orcs || []) {
      for (const sv of (orc as any).servicos || []) {
        const itens = [...(sv.itens || [])].sort((a: any, b: any) => a.ordem - b.ordem);
        const orcado = itens.reduce((s: number, it: any) => s + itemTotal(it), 0);

        lista.push({
          servicoId: sv.id,
          itemId: null,
          label: sv.nome,
          valor: orcado,
          peso: Number(sv.peso) || 0,
          jaMedido: acumServico.get(sv.id) || 0,
        });

        const pesosInformados = itens.reduce(
          (s: number, it: any) => s + (it.peso != null ? Number(it.peso) : 0),
          0
        );
        for (const it of itens) {
          const valor = itemTotal(it);
          const peso =
            it.peso != null
              ? Number(it.peso)
              : orcado > 0
                ? ((valor / orcado) * 100 * (100 - pesosInformados)) / 100
                : 0;
          lista.push({
            servicoId: sv.id,
            itemId: it.id,
            label: `    ${sv.nome} → ${it.descricao}`,
            valor,
            peso,
            jaMedido: acumItem.get(it.id) || 0,
          });
        }
      }
    }
    setAlvos(lista);
  }

  const alvo = alvos.find((a) => `${a.servicoId}|${a.itemId || ""}` === alvoKey);
  const restante = alvo ? Math.max(100 - alvo.jaMedido, 0) : 0;
  const pct = Number(percentual) || 0;
  const valorMedido = alvo ? (alvo.valor * pct) / 100 : 0;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!alvo) return;
    if (pct > restante) {
      setErro(`Já medido ${alvo.jaMedido.toFixed(1)}%. Máximo agora: ${restante.toFixed(1)}%.`);
      return;
    }
    setLoading(true);
    setErro(null);
    const { error } = await supabase.from("medicoes").insert({
      company_id: companyId,
      obra_id: obraId,
      servico_id: alvo.servicoId,
      orcamento_item_id: alvo.itemId,
      contrato_id: contratoId || null,
      numero: proximoNumero,
      data,
      nome: `${proximoNumero}ª MED — ${alvo.label.trim()}`,
      percentual_medido: pct,
      valor: valorMedido,
      recebido: 0,
      status: "FATURADA",
    });
    setLoading(false);
    if (error) {
      setErro(error.message);
      return;
    }
    onDone();
  }

  return (
    <div className="rounded-lg border border-line bg-card p-6 mb-6">
      <h3 className="font-bold mb-1">Nova Medição</h3>
      <p className="text-xs text-muted-foreground mb-4">
        Mede o que foi executado do orçamento. Não passa por cotação.
      </p>

      <form onSubmit={salvar} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Obra *</label>
            <select required className="field" value={obraId} onChange={(e) => setObraId(e.target.value)}>
              <option value="">Selecione a obra...</option>
              {obras.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              Serviço ou item do orçamento *
            </label>
            <select
              required
              className="field"
              value={alvoKey}
              onChange={(e) => {
                setAlvoKey(e.target.value);
                setPercentual("");
                setErro(null);
              }}
              disabled={!obraId}
            >
              <option value="">
                {obraId ? "Selecione o que está medindo..." : "Selecione a obra primeiro"}
              </option>
              {alvos.map((a) => (
                <option key={`${a.servicoId}|${a.itemId || ""}`} value={`${a.servicoId}|${a.itemId || ""}`}>
                  {a.label} — {a.jaMedido.toFixed(0)}% medido
                </option>
              ))}
            </select>
          </div>
        </div>

        {alvo && (
          <div className="grid gap-4 md:grid-cols-3 items-end">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                Executado agora (%)
              </label>
              <input
                type="number"
                min="0"
                max={restante}
                step="0.01"
                required
                className="field"
                value={percentual}
                onChange={(e) => setPercentual(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Falta medir: {restante.toFixed(1)}%
              </p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Data</label>
              <input type="date" className="field" value={data} onChange={(e) => setData(e.target.value)} />
              {contratos.length > 0 && (
                <select
                  className="field mt-2 text-xs"
                  value={contratoId}
                  onChange={(e) => setContratoId(e.target.value)}
                >
                  <option value="">Sem contrato vinculado</option>
                  {contratos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.identificador}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="rounded-lg bg-side p-3">
              <p className="text-xs text-muted-foreground">Valor desta medição</p>
              <p className="font-bold">{money(valorMedido)}</p>
            </div>
          </div>
        )}

        {erro && <p className="text-sm text-err">{erro}</p>}

        <div className="flex gap-3">
          <button type="submit" disabled={loading || !alvo || !percentual} className="btn-cta disabled:opacity-50">
            {loading ? "Salvando..." : `Lançar ${proximoNumero}ª Medição`}
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
