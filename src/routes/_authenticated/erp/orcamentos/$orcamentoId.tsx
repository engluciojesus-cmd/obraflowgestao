import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/useAuth";
import { ErpLayout, StatusBadge, money } from "@/components/ErpLayout";
import type {
  Orcamento,
  OrcamentoFase,
  OrcamentoServico,
  OrcamentoItem,
  OrcamentoStatus,
  ItemModo,
} from "@/types";
import { itemTotal } from "@/types";

export const Route = createFileRoute("/_authenticated/erp/orcamentos/$orcamentoId")({
  head: () => ({ meta: [{ title: "Orçamento — ObraFlow Gestão" }] }),
  component: OrcamentoBuilder,
});

type ServicoComItens = OrcamentoServico & { itens: OrcamentoItem[] };

function OrcamentoBuilder() {
  const { orcamentoId } = Route.useParams();
  const navigate = useNavigate();
  const [orcamento, setOrcamento] = useState<Orcamento | null>(null);
  const [fases, setFases] = useState<OrcamentoFase[]>([]);
  const [servicos, setServicos] = useState<ServicoComItens[]>([]);
  const [comprometido, setComprometido] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showServicoForm, setShowServicoForm] = useState<string | null>(null); // fase_id ou "sem-fase"
  const [showFaseForm, setShowFaseForm] = useState(false);
  const [showPdf, setShowPdf] = useState(false);
  const { company } = useActiveCompany();

  useEffect(() => {
    load();
  }, [orcamentoId]);

  async function load() {
    setLoading(true);
    const [{ data: orc }, { data: fasesData }, { data: servicosData }] = await Promise.all([
      supabase
        .from("orcamentos")
        .select("*, cliente:clientes(nome), obra:obras(nome)")
        .eq("id", orcamentoId)
        .single(),
      supabase.from("orcamento_fases").select("*").eq("orcamento_id", orcamentoId).order("ordem"),
      supabase
        .from("orcamento_servicos")
        .select("*, itens:orcamento_itens(*)")
        .eq("orcamento_id", orcamentoId)
        .order("ordem"),
    ]);
    setOrcamento(orc);
    setFases(fasesData || []);
    const servicosComItens = (servicosData || []).map((s: any) => ({
      ...s,
      itens: (s.itens || []).sort((a: OrcamentoItem, b: OrcamentoItem) => a.ordem - b.ordem),
    }));
    setServicos(servicosComItens);

    // consumo: soma dos itens de pedido vinculados a itens deste orçamento (pedidos não cancelados)
    const itemIds = servicosComItens.flatMap((s) => (s.itens || []).map((i: any) => i.id));
    const servicoIds = servicosComItens.map((s) => s.id);
    const itemValorMap = new Map<string, number>();
    for (const s of servicosComItens) {
      for (const it of s.itens || []) {
        itemValorMap.set(it.id, itemTotal(it));
      }
    }

    const compPedidos = itemIds.length > 0
      ? ((await supabase
          .from("pedido_itens")
          .select("quantidade, valor_unitario, orcamento_item_id, pedido:pedidos(status)")
          .in("orcamento_item_id", itemIds)).data || [])
          .filter((pi: any) => pi.pedido?.status !== "CANCELADO")
          .reduce((s: number, pi: any) => {
            const quantidade = Number(pi.quantidade) || 0;
            const valorUnitario = Number(pi.valor_unitario) || 0;
            const fallback = itemValorMap.get(pi.orcamento_item_id) || 0;
            return s + quantidade * (valorUnitario > 0 ? valorUnitario : fallback);
          }, 0)
      : 0;

    // medicoes por item/servico — dedupe por id
    const medicoesMap = new Map<string, any>();
    if (itemIds.length > 0) {
      const { data } = await supabase
        .from("medicoes")
        .select("id, valor, orcamento_item_id, servico_id")
        .in("orcamento_item_id", itemIds);
      for (const m of data || []) medicoesMap.set(m.id, m);
    }
    if (servicoIds.length > 0) {
      const { data } = await supabase
        .from("medicoes")
        .select("id, valor, orcamento_item_id, servico_id")
        .in("servico_id", servicoIds);
      for (const m of data || []) if (!medicoesMap.has(m.id)) medicoesMap.set(m.id, m);
    }
    const compMedicoes = Array.from(medicoesMap.values()).reduce((s: number, m: any) => {
      if (m.orcamento_item_id && itemIds.includes(m.orcamento_item_id)) return s + Number(m.valor || 0);
      if (m.servico_id && servicoIds.includes(m.servico_id)) return s + Number(m.valor || 0);
      return s;
    }, 0);

    setComprometido(compPedidos + compMedicoes);

    setLoading(false);
  }

  const total = servicos.reduce(
    (s, sv) => s + sv.itens.reduce((si, it) => si + itemTotal(it), 0),
    0
  );

  // sincroniza valor/percentual_consumo na tabela orcamentos (rollup)
  useEffect(() => {
    if (!orcamento || loading) return;
    const pct = total > 0 ? Math.round((comprometido / total) * 100) : 0;
    if (Number(orcamento.valor) !== total || orcamento.percentual_consumo !== pct) {
      supabase.from("orcamentos").update({ valor: total, percentual_consumo: pct }).eq("id", orcamento.id);
    }
  }, [total, comprometido, orcamento, loading]);

  async function setStatus(status: OrcamentoStatus) {
    await supabase.from("orcamentos").update({ status }).eq("id", orcamentoId);
    load();
  }

  async function duplicar() {
    if (!orcamento) return;
    const { data: novo, error } = await supabase
      .from("orcamentos")
      .insert({
        company_id: orcamento.company_id,
        cliente_id: orcamento.cliente_id,
        obra_id: orcamento.obra_id,
        nome: `${orcamento.nome} (CÓPIA)`,
        usa_fases: orcamento.usa_fases,
        responsavel: orcamento.responsavel,
        status: "RASCUNHO",
        valor: 0,
      })
      .select()
      .single();
    if (error || !novo) return;

    const faseIdMap = new Map<string, string>();
    for (const f of fases) {
      const { data: nf } = await supabase
        .from("orcamento_fases")
        .insert({ orcamento_id: novo.id, nome: f.nome, ordem: f.ordem })
        .select()
        .single();
      if (nf) faseIdMap.set(f.id, nf.id);
    }
    for (const sv of servicos) {
      const { data: ns } = await supabase
        .from("orcamento_servicos")
        .insert({
          orcamento_id: novo.id,
          fase_id: sv.fase_id ? faseIdMap.get(sv.fase_id) : null,
          nome: sv.nome,
          tipo: sv.tipo,
          peso: sv.peso,
          ordem: sv.ordem,
        })
        .select()
        .single();
      if (ns && sv.itens.length > 0) {
        await supabase.from("orcamento_itens").insert(
          sv.itens.map((it) => ({
            servico_id: ns.id,
            descricao: it.descricao,
            modo: it.modo,
            quantidade: it.quantidade,
            unidade: it.unidade,
            valor_unitario: it.valor_unitario,
            valor_verba: it.valor_verba,
            memoria_calculo: it.memoria_calculo,
            observacoes: it.observacoes,
            ordem: it.ordem,
          }))
        );
      }
    }
    navigate({ to: "/erp/orcamentos/$orcamentoId", params: { orcamentoId: novo.id } });
  }

  async function excluirOrcamento() {
    if (!confirm("Excluir este orçamento e todos os seus serviços/itens?")) return;
    await supabase.from("orcamentos").delete().eq("id", orcamentoId);
    navigate({ to: "/erp/orcamentos" });
  }

  if (loading || !orcamento) {
    return (
      <ErpLayout title="Orçamento">
        <p className="text-muted-foreground">Carregando...</p>
      </ErpLayout>
    );
  }

  const locked = orcamento.status === "APROVADO";
  const servicosSemFase = servicos.filter((s) => !s.fase_id);

  // Peso do serviço: usa o informado; o que sobra é rateado pelos serviços
  // sem peso, proporcional ao valor de cada um.
  const pesosInformados = servicos.reduce((s, sv) => s + Number(sv.peso || 0), 0);
  const semPeso = servicos.filter((sv) => !Number(sv.peso));
  const valorSemPeso = semPeso.reduce(
    (s, sv) => s + sv.itens.reduce((si, it) => si + itemTotal(it), 0),
    0
  );
  const sobra = Math.max(100 - pesosInformados, 0);

  function pesoEfetivo(sv: ServicoComItens) {
    if (Number(sv.peso)) return Number(sv.peso);
    if (valorSemPeso <= 0) return 0;
    const valor = sv.itens.reduce((s, it) => s + itemTotal(it), 0);
    return (valor / valorSemPeso) * sobra;
  }

  const somaPesos = servicos.reduce((s, sv) => s + pesoEfetivo(sv), 0);

  return (
    <ErpLayout
      title={orcamento.nome}
      breadcrumb={
        <>
          <Link to="/erp/orcamentos" className="hover:text-cta">
            Orçamentos
          </Link>
          {" / "}
          {orcamento.nome}
        </>
      }
      actions={
        <div className="flex gap-2 items-center">
          <StatusBadge status={orcamento.status} />
          {orcamento.status === "RASCUNHO" ? (
            <button
              onClick={() => setStatus("APROVADO")}
              className="rounded-lg bg-ok/20 text-ok px-4 py-2 text-sm font-semibold hover:bg-ok/30"
            >
              Aprovar
            </button>
          ) : (
            <button
              onClick={() => setStatus("RASCUNHO")}
              className="rounded-lg bg-side px-4 py-2 text-sm font-semibold hover:bg-side/80"
            >
              Reabrir edição
            </button>
          )}
          <button onClick={() => setShowPdf(true)} className="rounded-lg bg-side px-4 py-2 text-sm font-semibold hover:bg-side/80">
            Exportar PDF
          </button>
          <button onClick={duplicar} className="rounded-lg bg-side px-4 py-2 text-sm font-semibold hover:bg-side/80">
            Duplicar
          </button>
          <button onClick={excluirOrcamento} className="text-xs text-err hover:underline">
            Excluir
          </button>
        </div>
      }
    >
      {locked && (
        <div className="mb-6 rounded-lg bg-cta/10 border border-cta/30 px-4 py-3 text-sm text-cta">
          Este orçamento está <strong>Aprovado</strong> e bloqueado para edição. Clique em "Reabrir edição" para alterar.
        </div>
      )}

      {/* Resumo */}
      <div className="grid gap-4 md:grid-cols-5 mb-8">
        <div className="rounded-lg border border-line bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Cliente</p>
          <p className="mt-1 text-sm font-semibold">{orcamento.cliente?.nome || "—"}</p>
        </div>
        <div className="rounded-lg border border-line bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Obra</p>
          <p className="mt-1 text-sm font-semibold">{orcamento.obra?.nome || "Não vinculada"}</p>
        </div>
        <div className="rounded-lg border border-line bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Total orçado</p>
          <p className="mt-1 text-lg font-bold">{money(total)}</p>
        </div>
        <div className="rounded-lg border border-line bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Comprometido</p>
          <p className="mt-1 text-lg font-bold">{money(comprometido)}</p>
          <p className={`text-xs ${total > 0 && comprometido / total > 1 ? "text-err font-semibold" : "text-muted-foreground"}`}>
            {total > 0 ? Math.round((comprometido / total) * 100) : 0}%
          </p>
        </div>
        <div className="rounded-lg border border-line bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Saldo</p>
          <p className="mt-1 text-lg font-bold">{money(Math.max(total - comprometido, 0))}</p>
        </div>
      </div>

      {somaPesos !== 100 && servicos.length > 0 && (
        <p className="mb-4 text-xs text-muted-foreground">
          Soma dos pesos dos serviços: <strong>{somaPesos.toFixed(1)}%</strong> (recomendado somar 100% para refletir corretamente o avanço da obra)
        </p>
      )}

      {/* Ações de estrutura */}
      {!locked && (
        <div className="flex gap-3 mb-6">
          {orcamento.usa_fases && (
            <button onClick={() => setShowFaseForm(true)} className="btn-cta text-sm">
              + Nova Fase
            </button>
          )}
          <button
            onClick={() => setShowServicoForm("sem-fase")}
            className="rounded-lg bg-side px-4 py-2 text-sm font-semibold hover:bg-side/80"
          >
            + Novo Serviço {orcamento.usa_fases ? "(sem fase)" : ""}
          </button>
        </div>
      )}

      {showFaseForm && (
        <FaseForm
          orcamentoId={orcamentoId}
          ordem={fases.length}
          onDone={() => {
            setShowFaseForm(false);
            load();
          }}
          onCancel={() => setShowFaseForm(false)}
        />
      )}

      {/* Fases (se usa_fases) */}
      {orcamento.usa_fases &&
        fases.map((fase) => {
          const svs = servicos.filter((s) => s.fase_id === fase.id);
          const subtotal = svs.reduce((s, sv) => s + sv.itens.reduce((si, it) => si + itemTotal(it), 0), 0);
          return (
            <div key={fase.id} className="mb-6 rounded-lg border border-line bg-card overflow-hidden">
              <div className="bg-side px-6 py-3 flex items-center justify-between">
                <h3 className="font-bold text-sm uppercase">{fase.nome}</h3>
                <span className="text-sm font-semibold">{money(subtotal)}</span>
              </div>
              <div className="p-6 space-y-4">
                {svs.map((sv) => (
                  <ServicoBlock key={sv.id} servico={sv} peso={pesoEfetivo(sv)} locked={locked} onChange={load} />
                ))}
                {!locked && (
                  <button
                    onClick={() => setShowServicoForm(fase.id)}
                    className="text-xs text-cta hover:underline"
                  >
                    + Adicionar serviço nesta fase
                  </button>
                )}
                {showServicoForm === fase.id && (
                  <ServicoForm
                    orcamentoId={orcamentoId}
                    faseId={fase.id}
                    ordem={servicos.length}
                    onDone={() => {
                      setShowServicoForm(null);
                      load();
                    }}
                    onCancel={() => setShowServicoForm(null)}
                  />
                )}
              </div>
            </div>
          );
        })}

      {/* Serviços sem fase */}
      {servicosSemFase.length > 0 && (
        <div className="mb-6 rounded-lg border border-line bg-card p-6 space-y-4">
          {orcamento.usa_fases && <h3 className="font-bold text-sm uppercase text-muted-foreground">Sem fase</h3>}
          {servicosSemFase.map((sv) => (
            <ServicoBlock key={sv.id} servico={sv} peso={pesoEfetivo(sv)} locked={locked} onChange={load} />
          ))}
        </div>
      )}

      {showServicoForm === "sem-fase" && (
        <ServicoForm
          orcamentoId={orcamentoId}
          faseId={null}
          ordem={servicos.length}
          onDone={() => {
            setShowServicoForm(null);
            load();
          }}
          onCancel={() => setShowServicoForm(null)}
        />
      )}

      {servicos.length === 0 && !showServicoForm && (
        <div className="rounded-lg border border-line bg-card p-8 text-center text-muted-foreground">
          Nenhum serviço adicionado ainda.
        </div>
      )}
      {showPdf && (
        <PdfModal
          orcamento={orcamento}
          servicos={servicos}
          fases={fases}
          total={total}
          empresa={company}
          onClose={() => setShowPdf(false)}
        />
      )}
    </ErpLayout>
  );
}

function PdfModal({
  orcamento,
  servicos,
  fases,
  total,
  empresa,
  onClose,
}: {
  orcamento: Orcamento;
  servicos: ServicoComItens[];
  fases: OrcamentoFase[];
  total: number;
  empresa: { name: string; logo_url?: string | null } | null;
  onClose: () => void;
}) {
  const [detalhado, setDetalhado] = useState(true);

  function gerar() {
    const linhas = servicos
      .map((sv) => {
        const subtotal = sv.itens.reduce((s, it) => s + itemTotal(it), 0);
        const fase = fases.find((f) => f.id === sv.fase_id);
        const cabecalho = `
          <tr class="servico">
            <td colspan="${detalhado ? 4 : 1}">
              ${fase ? `<span class="fase">${fase.nome} · </span>` : ""}${sv.nome}
            </td>
            <td class="num">${money(subtotal)}</td>
          </tr>`;
        if (!detalhado) return cabecalho;
        const itens = sv.itens
          .map(
            (it) => `
          <tr class="item">
            <td>${it.descricao}</td>
            <td class="num">${it.modo === "verba" ? "—" : it.quantidade}</td>
            <td>${it.modo === "verba" ? "VB" : it.unidade}</td>
            <td class="num">${money(it.modo === "verba" ? it.valor_verba : it.valor_unitario)}</td>
            <td class="num">${money(itemTotal(it))}</td>
          </tr>`
          )
          .join("");
        return cabecalho + itens;
      })
      .join("");

    const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<title>${orcamento.nome}</title>
<style>
  @page { size: A4; margin: 18mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Arial, sans-serif; color: #1a1a1a; font-size: 11px; margin: 0; }
  header { display: flex; align-items: center; justify-content: space-between;
           border-bottom: 2px solid #E8590C; padding-bottom: 12px; margin-bottom: 20px; }
  header img { max-height: 52px; max-width: 190px; object-fit: contain; }
  .empresa { font-size: 15px; font-weight: 700; }
  h1 { font-size: 17px; margin: 0 0 14px; }
  .dados { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
  .dados td { padding: 5px 8px; border: 1px solid #ddd; }
  .dados .rot { background: #f5f5f5; font-weight: 600; width: 90px; }
  table.itens { width: 100%; border-collapse: collapse; }
  table.itens th { background: #f5f5f5; text-align: left; padding: 7px 8px;
                   border-bottom: 1.5px solid #999; font-size: 10px; text-transform: uppercase; }
  table.itens td { padding: 6px 8px; border-bottom: 1px solid #eee; }
  tr.servico td { background: #fafafa; font-weight: 700; padding-top: 10px; }
  tr.item td:first-child { padding-left: 22px; color: #444; }
  .fase { color: #E8590C; font-weight: 600; }
  .num { text-align: right; white-space: nowrap; }
  tfoot td { padding-top: 12px; font-size: 14px; font-weight: 700; border-top: 2px solid #333; }
  footer { margin-top: 32px; padding-top: 10px; border-top: 1px solid #ddd;
           display: flex; justify-content: space-between; font-size: 9px; color: #888; }
</style></head><body>
  <header>
    <div>
      ${empresa?.logo_url ? `<img src="${empresa.logo_url}" alt="">` : `<div class="empresa">${empresa?.name || ""}</div>`}
    </div>
    <div style="text-align:right">
      <div style="font-weight:700">PROPOSTA ORÇAMENTÁRIA</div>
      <div style="color:#777">${new Date(orcamento.data).toLocaleDateString("pt-BR")}</div>
    </div>
  </header>

  <h1>${orcamento.nome}</h1>

  <table class="dados">
    <tr>
      <td class="rot">Cliente</td><td>${orcamento.cliente?.nome || "—"}</td>
      <td class="rot">Obra</td><td>${orcamento.obra?.nome || "Não vinculada"}</td>
    </tr>
    <tr>
      <td class="rot">Responsável</td><td>${orcamento.responsavel || "—"}</td>
      <td class="rot">Situação</td><td>${orcamento.status}</td>
    </tr>
  </table>

  <table class="itens">
    <thead>
      <tr>
        <th>Descrição</th>
        ${detalhado ? '<th class="num">Qtd</th><th>Un</th><th class="num">Vr. Unit.</th>' : ""}
        <th class="num">Total</th>
      </tr>
    </thead>
    <tbody>${linhas}</tbody>
    <tfoot>
      <tr>
        <td colspan="${detalhado ? 4 : 1}">TOTAL GERAL</td>
        <td class="num">${money(total)}</td>
      </tr>
    </tfoot>
  </table>

  <footer>
    <span>${empresa?.name || ""}</span>
    <span>Gerado por ObraFlow Gestão</span>
  </footer>
  <script>window.onload = () => { window.print(); }</script>
</body></html>`;

    const win = window.open("", "_blank");
    if (!win) {
      alert("Permita pop-ups neste site para gerar o PDF.");
      return;
    }
    win.document.write(html);
    win.document.close();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-lg border border-line bg-card p-6 space-y-4">
        <h3 className="text-lg font-bold">Exportar orçamento</h3>

        <div className="space-y-2">
          <label className="flex items-start gap-3 rounded-lg border border-line bg-side p-3 cursor-pointer">
            <input
              type="radio"
              checked={detalhado}
              onChange={() => setDetalhado(true)}
              className="mt-0.5"
            />
            <div>
              <p className="text-sm font-semibold">Detalhado</p>
              <p className="text-xs text-muted-foreground">
                Mostra cada item com quantidade e valor unitário.
              </p>
            </div>
          </label>
          <label className="flex items-start gap-3 rounded-lg border border-line bg-side p-3 cursor-pointer">
            <input
              type="radio"
              checked={!detalhado}
              onChange={() => setDetalhado(false)}
              className="mt-0.5"
            />
            <div>
              <p className="text-sm font-semibold">Resumido</p>
              <p className="text-xs text-muted-foreground">
                Só o total de cada serviço, sem abrir preços unitários.
              </p>
            </div>
          </label>
        </div>

        {!empresa?.logo_url && (
          <p className="text-xs text-muted-foreground">
            Sem logo cadastrada. Envie a logo da empresa em Segurança para que ela apareça no
            documento.
          </p>
        )}

        <div className="flex gap-3">
          <button onClick={gerar} className="btn-cta">
            Gerar PDF
          </button>
          <button
            onClick={onClose}
            className="rounded-lg bg-side px-4 py-2.5 text-sm font-semibold hover:bg-side/80"
          >
            Cancelar
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Abre a janela de impressão — escolha "Salvar como PDF" no destino.
        </p>
      </div>
    </div>
  );
}

function FaseForm({
  orcamentoId,
  ordem,
  onDone,
  onCancel,
}: {
  orcamentoId: string;
  ordem: number;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [nome, setNome] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await supabase.from("orcamento_fases").insert({ orcamento_id: orcamentoId, nome: nome.toUpperCase(), ordem });
    setLoading(false);
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 rounded-lg border border-line bg-card p-4 flex gap-3 items-end">
      <div className="flex-1">
        <label className="block text-xs font-semibold text-muted-foreground mb-1">Nome da fase</label>
        <input
          required
          className="field"
          placeholder="Ex: FASE 1 — CINZA"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />
      </div>
      <button type="submit" disabled={loading} className="btn-cta">
        Adicionar
      </button>
      <button type="button" onClick={onCancel} className="rounded-lg bg-side px-4 py-2.5 text-sm font-semibold hover:bg-side/80">
        Cancelar
      </button>
    </form>
  );
}

function ServicoForm({
  orcamentoId,
  faseId,
  ordem,
  onDone,
  onCancel,
}: {
  orcamentoId: string;
  faseId: string | null;
  ordem: number;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<"Serviço" | "Material" | "Misto">("Serviço");
  const [peso, setPeso] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await supabase.from("orcamento_servicos").insert({
      orcamento_id: orcamentoId,
      fase_id: faseId,
      nome: nome.toUpperCase(),
      tipo,
      peso: Number(peso) || 0,
      ordem,
    });
    setLoading(false);
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-line bg-side/30 p-4 grid gap-3 md:grid-cols-4">
      <div className="md:col-span-2">
        <label className="block text-xs font-semibold text-muted-foreground mb-1">Nome do serviço</label>
        <input required className="field" value={nome} onChange={(e) => setNome(e.target.value)} />
      </div>
      <div>
        <label className="block text-xs font-semibold text-muted-foreground mb-1">Tipo</label>
        <select className="field" value={tipo} onChange={(e) => setTipo(e.target.value as any)}>
          <option value="Material">Material</option>
          <option value="Serviço">Serviço</option>
          <option value="Misto">Misto</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-semibold text-muted-foreground mb-1">Peso na obra (%)</label>
        <input
          type="number"
          step="0.01"
          className="field"
          value={peso}
          onChange={(e) => setPeso(e.target.value)}
        />
      </div>
      <div className="md:col-span-4 flex gap-3">
        <button type="submit" disabled={loading} className="btn-cta text-sm">
          Salvar serviço
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg bg-side px-4 py-2 text-sm font-semibold hover:bg-side/80">
          Cancelar
        </button>
      </div>
    </form>
  );
}

function ServicoBlock({
  servico,
  peso,
  locked,
  onChange,
}: {
  servico: ServicoComItens;
  peso: number;
  locked: boolean;
  onChange: () => void;
}) {
  const [showItemForm, setShowItemForm] = useState(false);
  const subtotal = servico.itens.reduce((s, it) => s + itemTotal(it), 0);

  async function removeServico() {
    if (!confirm(`Excluir o serviço "${servico.nome}" e todos os seus itens?`)) return;
    await supabase.from("orcamento_servicos").delete().eq("id", servico.id);
    onChange();
  }

  async function removeItem(id: string) {
    await supabase.from("orcamento_itens").delete().eq("id", id);
    onChange();
  }

  return (
    <div className="border border-line rounded-lg overflow-hidden">
      <div className="bg-side/50 px-4 py-2 flex items-center justify-between">
        <div>
          <span className="text-sm font-semibold">{servico.nome}</span>
          <span className="ml-2 text-xs text-muted-foreground">
            {servico.tipo} · peso {peso.toFixed(1)}%
            {!Number(servico.peso) && <span className="ml-1">(automático)</span>}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold">{money(subtotal)}</span>
          {!locked && (
            <button onClick={removeServico} className="text-xs text-err hover:underline">
              Excluir
            </button>
          )}
        </div>
      </div>

      {servico.itens.length > 0 && (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-muted-foreground border-b border-line">
              <th className="px-4 py-1.5">Descrição</th>
              <th className="px-2 py-1.5">Qtd</th>
              <th className="px-2 py-1.5">Un</th>
              <th className="px-2 py-1.5">Vr. Unit.</th>
              <th className="px-2 py-1.5">Total</th>
              {!locked && <th className="px-2 py-1.5"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {servico.itens.map((it) => (
              <tr key={it.id}>
                <td className="px-4 py-1.5">
                  {it.descricao}
                  {it.memoria_calculo && (
                    <span className="block text-muted-foreground italic">{it.memoria_calculo}</span>
                  )}
                </td>
                <td className="px-2 py-1.5">{it.modo === "verba" ? "VERBA" : it.quantidade}</td>
                <td className="px-2 py-1.5">{it.modo === "verba" ? "VB" : it.unidade}</td>
                <td className="px-2 py-1.5">
                  {money(it.modo === "verba" ? it.valor_verba : it.valor_unitario)}
                </td>
                <td className="px-2 py-1.5 font-semibold">{money(itemTotal(it))}</td>
                {!locked && (
                  <td className="px-2 py-1.5">
                    <button onClick={() => removeItem(it.id)} className="text-err hover:underline">
                      Remover
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!locked && (
        <div className="p-3 border-t border-line">
          {showItemForm ? (
            <ItemForm
              servicoId={servico.id}
              ordem={servico.itens.length}
              onDone={() => {
                setShowItemForm(false);
                onChange();
              }}
              onCancel={() => setShowItemForm(false)}
            />
          ) : (
            <button onClick={() => setShowItemForm(true)} className="text-xs text-cta hover:underline">
              + Adicionar item
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ItemForm({
  servicoId,
  ordem,
  onDone,
  onCancel,
}: {
  servicoId: string;
  ordem: number;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [descricao, setDescricao] = useState("");
  const [modo, setModo] = useState<ItemModo>("aberto");
  const [quantidade, setQuantidade] = useState("1");
  const [unidade, setUnidade] = useState("un");
  const [valorUnitario, setValorUnitario] = useState("");
  const [valorVerba, setValorVerba] = useState("");
  const [memoriaCalculo, setMemoriaCalculo] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [peso, setPeso] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await supabase.from("orcamento_itens").insert({
      servico_id: servicoId,
      descricao: descricao.toUpperCase(),
      modo,
      quantidade: modo === "aberto" ? Number(quantidade) || 1 : null,
      unidade: modo === "aberto" ? unidade : "VB",
      valor_unitario: modo === "aberto" ? Number(valorUnitario) || 0 : 0,
      valor_verba: modo === "verba" ? Number(valorVerba) || 0 : 0,
      memoria_calculo: memoriaCalculo || null,
      observacoes: observacoes || null,
      peso: peso === "" ? null : Number(peso),
      ordem,
    });
    setLoading(false);
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-6 items-end bg-background rounded-lg p-3">
      <div className="md:col-span-2">
        <label className="block text-xs font-semibold text-muted-foreground mb-1">Descrição</label>
        <input required className="field text-sm" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
      </div>
      <div>
        <label className="block text-xs font-semibold text-muted-foreground mb-1">Modo</label>
        <select className="field text-sm" value={modo} onChange={(e) => setModo(e.target.value as ItemModo)}>
          <option value="aberto">Aberto (qtd × un.)</option>
          <option value="verba">Verba (fechado)</option>
        </select>
      </div>

      {modo === "aberto" ? (
        <>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Qtd</label>
            <input
              type="number"
              step="0.0001"
              className="field text-sm"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Un.</label>
            <input className="field text-sm" value={unidade} onChange={(e) => setUnidade(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Vr. Unit. (R$)</label>
            <input
              type="number"
              step="0.01"
              className="field text-sm"
              value={valorUnitario}
              onChange={(e) => setValorUnitario(e.target.value)}
            />
          </div>
        </>
      ) : (
        <div className="md:col-span-3">
          <label className="block text-xs font-semibold text-muted-foreground mb-1">Valor da verba (R$)</label>
          <input
            type="number"
            step="0.01"
            className="field text-sm"
            value={valorVerba}
            onChange={(e) => setValorVerba(e.target.value)}
          />
        </div>
      )}

      <div className="md:col-span-3">
        <label className="block text-xs font-semibold text-muted-foreground mb-1">Memória de cálculo (opcional)</label>
        <input className="field text-sm" value={memoriaCalculo} onChange={(e) => setMemoriaCalculo(e.target.value)} />
      </div>
      <div className="md:col-span-2">
        <label className="block text-xs font-semibold text-muted-foreground mb-1">Observações (opcional)</label>
        <input className="field text-sm" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
      </div>
      <div>
        <label className="block text-xs font-semibold text-muted-foreground mb-1">Peso no serviço (%)</label>
        <input
          type="number"
          step="0.01"
          className="field text-sm"
          placeholder="auto"
          value={peso}
          onChange={(e) => setPeso(e.target.value)}
        />
      </div>

      <div className="md:col-span-6 flex gap-3">
        <button type="submit" disabled={loading} className="btn-cta text-sm">
          Salvar item
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg bg-side px-4 py-2 text-sm font-semibold hover:bg-side/80">
          Cancelar
        </button>
      </div>
    </form>
  );
}
