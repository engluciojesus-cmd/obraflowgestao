import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/useAuth";
import { ErpLayout, StatusBadge, money } from "@/components/ErpLayout";
import type { Lancamento, LancamentoStatus, Medicao, Fornecedor, Obra } from "@/types";

export const Route = createFileRoute("/_authenticated/erp/financeiro")({
  head: () => ({ meta: [{ title: "Financeiro — ObraFlow Gestão" }] }),
  component: FinanceiroPage,
});

function FinanceiroPage() {
  const { companyId, loading: companyLoading } = useActiveCompany();
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [medicoes, setMedicoes] = useState<Medicao[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLancForm, setShowLancForm] = useState(false);
  const [showMedForm, setShowMedForm] = useState(false);

  useEffect(() => {
    if (companyId) load();
  }, [companyId]);

  async function load() {
    if (!companyId) return;
    setLoading(true);
    const [{ data: lancData }, { data: medData }, { data: fornData }, { data: obrasData }] =
      await Promise.all([
        supabase
          .from("lancamentos")
          .select("*, fornecedor:fornecedores(nome), obra:obras(nome)")
          .eq("company_id", companyId)
          .order("vencimento"),
        supabase
          .from("medicoes")
          .select("*, obra:obras(nome)")
          .eq("company_id", companyId)
          .order("vencimento"),
        supabase.from("fornecedores").select("*").eq("company_id", companyId).order("nome"),
        supabase.from("obras").select("*").eq("company_id", companyId).order("nome"),
      ]);
    setLancamentos(lancData || []);
    setMedicoes(medData || []);
    setFornecedores(fornData || []);
    setObras(obrasData || []);
    setLoading(false);
  }

  async function setLancStatus(l: Lancamento, status: LancamentoStatus) {
    await supabase.from("lancamentos").update({ status }).eq("id", l.id);
    load();
  }

  async function removeLanc(l: Lancamento) {
    if (!confirm(`Excluir o lançamento "${l.titulo}"?`)) return;
    await supabase.from("lancamentos").delete().eq("id", l.id);
    load();
  }

  async function marcarMedicaoPaga(m: Medicao) {
    await supabase
      .from("medicoes")
      .update({ recebido: m.valor, status: "PAGA" })
      .eq("id", m.id);
    load();
  }

  const saldo = medicoes.reduce((s, m) => s + Number(m.recebido), 0) -
    lancamentos.filter((l) => l.status === "PAGA").reduce((s, l) => s + Number(l.valor), 0);
  const aPagar = lancamentos
    .filter((l) => l.status !== "PAGA" && l.status !== "CANCELADA")
    .reduce((s, l) => s + Number(l.valor), 0);
  const jaPago = lancamentos
    .filter((l) => l.status === "PAGA")
    .reduce((s, l) => s + Number(l.valor), 0);
  const aReceber = medicoes
    .filter((m) => m.status !== "PAGA")
    .reduce((s, m) => s + (Number(m.valor) - Number(m.recebido)), 0);

  if (companyLoading) return null;

  return (
    <ErpLayout
      title="Financeiro"
      breadcrumb="Financeiro"
      actions={
        <div className="flex gap-3">
          <button onClick={() => setShowMedForm(true)} className="btn-cta">
            + Nova Medição
          </button>
          <button onClick={() => setShowLancForm(true)} className="btn-cta">
            + Novo Lançamento
          </button>
        </div>
      }
    >
      {showLancForm && (
        <LancamentoForm
          companyId={companyId!}
          fornecedores={fornecedores}
          obras={obras}
          onDone={() => {
            setShowLancForm(false);
            load();
          }}
          onCancel={() => setShowLancForm(false)}
        />
      )}
      {showMedForm && (
        <MedicaoForm
          companyId={companyId!}
          obras={obras}
          onDone={() => {
            setShowMedForm(false);
            load();
          }}
          onCancel={() => setShowMedForm(false)}
        />
      )}

      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <div className="rounded-lg border border-line bg-card p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Saldo em caixa</p>
          <p className="mt-1 text-2xl font-bold">{money(saldo)}</p>
        </div>
        <div className="rounded-lg border border-line bg-card p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase">A pagar</p>
          <p className="mt-1 text-2xl font-bold text-err">{money(aPagar)}</p>
        </div>
        <div className="rounded-lg border border-line bg-card p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Já pago</p>
          <p className="mt-1 text-2xl font-bold text-ok">{money(jaPago)}</p>
        </div>
        <div className="rounded-lg border border-line bg-card p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase">A receber (medições)</p>
          <p className="mt-1 text-2xl font-bold text-ok">{money(aReceber)}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Lançamentos */}
        <div className="rounded-lg border border-line bg-card p-6">
          <h3 className="font-bold mb-4">Lançamentos ({lancamentos.length})</h3>
          {loading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : lancamentos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum lançamento ainda.</p>
          ) : (
            <div className="space-y-3">
              {lancamentos.map((l) => (
                <div key={l.id} className="border-b border-line pb-3 last:border-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-sm">{l.titulo}</p>
                      <p className="text-xs text-muted-foreground">
                        {l.fornecedor?.nome || "—"} · {l.obra?.nome || "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Venc: {l.vencimento ? new Date(l.vencimento).toLocaleDateString("pt-BR") : "—"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm">{money(Number(l.valor))}</p>
                      <StatusBadge status={l.status} />
                    </div>
                  </div>
                  <div className="flex gap-3 mt-2">
                    <button
                      onClick={() => setLancStatus(l, "PAGA")}
                      className="text-xs text-ok hover:underline"
                    >
                      Marcar paga
                    </button>
                    <button
                      onClick={() => removeLanc(l)}
                      className="text-xs text-err hover:underline"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Medições */}
        <div className="rounded-lg border border-line bg-card p-6">
          <h3 className="font-bold mb-4">Medições ({medicoes.length})</h3>
          {loading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : medicoes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma medição ainda.</p>
          ) : (
            <div className="space-y-3">
              {medicoes.map((m) => (
                <div key={m.id} className="border-b border-line pb-3 last:border-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-sm">{m.nome}</p>
                      <p className="text-xs text-muted-foreground">{m.obra?.nome || "—"}</p>
                      <p className="text-xs text-muted-foreground">
                        Venc: {m.vencimento ? new Date(m.vencimento).toLocaleDateString("pt-BR") : "—"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm">{money(Number(m.valor))}</p>
                      <p className="text-xs text-muted-foreground">
                        Recebido: {money(Number(m.recebido))}
                      </p>
                      <StatusBadge status={m.status} />
                    </div>
                  </div>
                  {m.status !== "PAGA" && (
                    <button
                      onClick={() => marcarMedicaoPaga(m)}
                      className="mt-2 text-xs text-ok hover:underline"
                    >
                      Marcar como recebida
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ErpLayout>
  );
}

function LancamentoForm({
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
  const [titulo, setTitulo] = useState("");
  const [fornecedorId, setFornecedorId] = useState("");
  const [obraId, setObraId] = useState("");
  const [vencimento, setVencimento] = useState("");
  const [valor, setValor] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro(null);
    try {
      const { error } = await supabase.from("lancamentos").insert({
        company_id: companyId,
        titulo,
        fornecedor_id: fornecedorId || null,
        obra_id: obraId || null,
        vencimento: vencimento || null,
        valor: Number(valor) || 0,
        forma_pagamento: formaPagamento,
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
      <h3 className="font-bold mb-4">Novo Lançamento (a pagar)</h3>
      <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="block text-xs font-semibold text-muted-foreground mb-1">Título *</label>
          <input required className="field" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">Fornecedor</label>
          <select className="field" value={fornecedorId} onChange={(e) => setFornecedorId(e.target.value)}>
            <option value="">Selecione...</option>
            {fornecedores.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">Obra</label>
          <select className="field" value={obraId} onChange={(e) => setObraId(e.target.value)}>
            <option value="">Selecione...</option>
            {obras.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">Vencimento</label>
          <input
            type="date"
            className="field"
            value={vencimento}
            onChange={(e) => setVencimento(e.target.value)}
          />
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
        <div className="md:col-span-2">
          <label className="block text-xs font-semibold text-muted-foreground mb-1">Forma de pagamento</label>
          <input
            className="field"
            placeholder="Ex: Boleto, PIX, TED/DOC"
            value={formaPagamento}
            onChange={(e) => setFormaPagamento(e.target.value)}
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
  const [nome, setNome] = useState("");
  const [obraId, setObraId] = useState("");
  const [servicoId, setServicoId] = useState("");
  const [servicos, setServicos] = useState<{ id: string; nome: string }[]>([]);
  const [percentualMedido, setPercentualMedido] = useState("");
  const [vencimento, setVencimento] = useState("");
  const [valor, setValor] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!obraId) {
      setServicos([]);
      return;
    }
    (async () => {
      const { data: orcs } = await supabase
        .from("orcamentos")
        .select("servicos:orcamento_servicos(id, nome)")
        .eq("obra_id", obraId);
      const list: { id: string; nome: string }[] = [];
      for (const orc of orcs || []) {
        for (const sv of (orc as any).servicos || []) {
          list.push({ id: sv.id, nome: sv.nome });
        }
      }
      setServicos(list);
    })();
  }, [obraId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro(null);
    try {
      const { error } = await supabase.from("medicoes").insert({
        company_id: companyId,
        nome,
        obra_id: obraId || null,
        servico_id: servicoId || null,
        percentual_medido: Number(percentualMedido) || 0,
        vencimento: vencimento || null,
        valor: Number(valor) || 0,
      });

      if (error) throw error;

      // Recalcula o avanço físico da obra: Σ(peso do serviço × % medido acumulado, limitado a 100) / 100
      if (obraId) {
        const { data: orcs } = await supabase
          .from("orcamentos")
          .select("servicos:orcamento_servicos(id, peso)")
          .eq("obra_id", obraId);
        const servicosObra: { id: string; peso: number }[] = [];
        for (const orc of orcs || []) {
          for (const sv of (orc as any).servicos || []) {
            servicosObra.push({ id: sv.id, peso: Number(sv.peso) });
          }
        }
        if (servicosObra.length > 0) {
          const { data: todasMedicoes } = await supabase
            .from("medicoes")
            .select("servico_id, percentual_medido")
            .eq("obra_id", obraId)
            .not("servico_id", "is", null);

          let avancoTotal = 0;
          for (const sv of servicosObra) {
            const acumulado = (todasMedicoes || [])
              .filter((m) => m.servico_id === sv.id)
              .reduce((s, m) => s + Number(m.percentual_medido), 0);
            avancoTotal += sv.peso * Math.min(acumulado, 100);
          }
          await supabase
            .from("obras")
            .update({ avanco: Math.round(avancoTotal / 100) })
            .eq("id", obraId);
        }
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
      <h3 className="font-bold mb-4">Nova Medição (a receber)</h3>
      <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="block text-xs font-semibold text-muted-foreground mb-1">Nome *</label>
          <input required className="field" value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">Obra</label>
          <select className="field" value={obraId} onChange={(e) => setObraId(e.target.value)}>
            <option value="">Selecione...</option>
            {obras.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">
            Serviço medido (opcional)
          </label>
          <select
            className="field"
            value={servicoId}
            onChange={(e) => setServicoId(e.target.value)}
            disabled={!obraId}
          >
            <option value="">{obraId ? "Selecione..." : "Selecione a obra primeiro"}</option>
            {servicos.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">
            % de evolução do serviço
          </label>
          <input
            type="number"
            min="0"
            max="100"
            className="field"
            value={percentualMedido}
            onChange={(e) => setPercentualMedido(e.target.value)}
            disabled={!servicoId}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">Vencimento</label>
          <input
            type="date"
            className="field"
            value={vencimento}
            onChange={(e) => setVencimento(e.target.value)}
          />
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
