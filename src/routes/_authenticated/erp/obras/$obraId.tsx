import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ErpLayout, StatusBadge, money } from "@/components/ErpLayout";
import type { Obra } from "@/types";
import { itemTotal } from "@/types";

export const Route = createFileRoute("/_authenticated/erp/obras/$obraId")({
  head: () => ({ meta: [{ title: "Obra — ObraFlow Gestão" }] }),
  component: ObraPainel,
});

type ItemLinha = {
  id: string;
  descricao: string;
  valor: number;
  peso: number; // peso dentro do serviço (%)
  medido: number; // acumulado (%)
  comprometido: number;
};

type ServicoLinha = {
  id: string;
  nome: string;
  tipo: string;
  peso: number; // peso na obra (%)
  orcado: number;
  comprometido: number;
  medidoDireto: number; // medição feita no serviço inteiro
  itens: ItemLinha[];
};

// Avanço do serviço: se houver medição por item, soma peso × medido de cada
// item; senão, usa a medição feita no serviço inteiro.
function avancoServico(sv: ServicoLinha) {
  const temMedicaoItem = sv.itens.some((it) => it.medido > 0);
  if (!temMedicaoItem) return sv.medidoDireto;
  return sv.itens.reduce((s, it) => s + (it.peso * it.medido) / 100, 0);
}

function ObraPainel() {
  const { obraId } = Route.useParams();
  const [obra, setObra] = useState<Obra | null>(null);
  const [servicos, setServicos] = useState<ServicoLinha[]>([]);
  const [semVinculo, setSemVinculo] = useState(0);
  const [historico, setHistorico] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [medindo, setMedindo] = useState<{
    servico: ServicoLinha;
    item?: ItemLinha;
  } | null>(null);

  useEffect(() => {
    load();
  }, [obraId]);

  async function load() {
    setLoading(true);

    const [{ data: obraData }, { data: orcs }, { data: medicoes }, { data: pedidos }] =
      await Promise.all([
        supabase.from("obras").select("*, cliente:clientes(nome)").eq("id", obraId).single(),
        supabase
          .from("orcamentos")
          .select(
            "id, servicos:orcamento_servicos(id, nome, tipo, peso, ordem, itens:orcamento_itens(id, descricao, modo, quantidade, valor_unitario, valor_verba, peso, ordem))"
          )
          .eq("obra_id", obraId),
        supabase
          .from("medicoes")
          .select("*")
          .eq("obra_id", obraId)
          .order("created_at", { ascending: true }),
        supabase
          .from("pedidos")
          .select("status, pedido_itens(quantidade, valor_unitario, orcamento_item_id)")
          .eq("obra_id", obraId),
      ]);

    setObra(obraData);
    setHistorico(medicoes || []);

    // Compras por item de orçamento (pedidos cancelados não contam)
    const gastoPorItem = new Map<string, number>();
    let avulso = 0;
    for (const p of pedidos || []) {
      if ((p as any).status === "CANCELADO") continue;
      for (const pi of (p as any).pedido_itens || []) {
        const valor = Number(pi.quantidade) * Number(pi.valor_unitario);
        if (pi.orcamento_item_id) {
          gastoPorItem.set(
            pi.orcamento_item_id,
            (gastoPorItem.get(pi.orcamento_item_id) || 0) + valor
          );
        } else {
          avulso += valor;
        }
      }
    }
    // Inclui medições no comprometido (medições representam valor comprometido)
    for (const m of medicoes || []) {
      const valor = Number(m.valor || 0);
      if (m.orcamento_item_id) {
        gastoPorItem.set(
          m.orcamento_item_id,
          (gastoPorItem.get(m.orcamento_item_id) || 0) + valor
        );
      } else {
        avulso += valor;
      }
    }
    setSemVinculo(avulso);

    // Medições são incrementais: o acumulado é a soma dos lançamentos
    const acumServico = new Map<string, number>();
    const acumItem = new Map<string, number>();
    for (const m of medicoes || []) {
      const pct = Number(m.percentual_medido) || 0;
      if (m.orcamento_item_id) {
        acumItem.set(m.orcamento_item_id, (acumItem.get(m.orcamento_item_id) || 0) + pct);
      } else if (m.servico_id) {
        acumServico.set(m.servico_id, (acumServico.get(m.servico_id) || 0) + pct);
      }
    }

    const linhas: ServicoLinha[] = [];
    for (const orc of orcs || []) {
      for (const sv of (orc as any).servicos || []) {
        const itensRaw = [...(sv.itens || [])].sort((a: any, b: any) => a.ordem - b.ordem);
        const orcado = itensRaw.reduce((s: number, it: any) => s + itemTotal(it), 0);

        // Peso do item: usa o informado; se não houver, proporcional ao valor
        const pesosInformados = itensRaw.reduce(
          (s: number, it: any) => s + (it.peso != null ? Number(it.peso) : 0),
          0
        );
        const itens: ItemLinha[] = itensRaw.map((it: any) => {
          const valor = itemTotal(it);
          const peso =
            it.peso != null
              ? Number(it.peso)
              : orcado > 0
                ? ((valor / orcado) * 100 * (100 - pesosInformados)) / 100
                : 0;
          return {
            id: it.id,
            descricao: it.descricao,
            valor,
            peso,
            medido: Math.min(acumItem.get(it.id) || 0, 100),
            comprometido: gastoPorItem.get(it.id) || 0,
          };
        });

        linhas.push({
          id: sv.id,
          nome: sv.nome,
          tipo: sv.tipo,
          peso: Number(sv.peso) || 0,
          orcado,
          comprometido: itens.reduce((s, it) => s + it.comprometido, 0),
          medidoDireto: Math.min(acumServico.get(sv.id) || 0, 100),
          itens,
        });
      }
    }
    setServicos(linhas);
    setLoading(false);
  }

  const totalOrcado = servicos.reduce((s, sv) => s + sv.orcado, 0);
  const totalComprometido = servicos.reduce((s, sv) => s + sv.comprometido, 0) + semVinculo;
  const somaPesos = servicos.reduce((s, sv) => s + sv.peso, 0);
  // Se não houver pesos informados, distribui proporcionalmente pelo orçado
  function pesoEfetivo(sv: ServicoLinha) {
    if (somaPesos > 0) return sv.peso;
    return totalOrcado > 0 ? (sv.orcado / totalOrcado) * 100 : 0;
  }

  const avancoFisico = servicos.reduce(
    (s, sv) => s + (pesoEfetivo(sv) * avancoServico(sv)) / 100,
    0
  );
  const totalMedido = servicos.reduce((s, sv) => s + (sv.orcado * avancoServico(sv)) / 100, 0);

  // Mantém o avanço da obra sincronizado com o que foi medido
  useEffect(() => {
    if (loading || !obra) return;
    const arredondado = Math.round(avancoFisico);
    if (obra.avanco !== arredondado) {
      supabase.from("obras").update({ avanco: arredondado }).eq("id", obra.id);
    }
  }, [avancoFisico, obra, loading]);

  function toggle(id: string) {
    const novo = new Set(abertos);
    novo.has(id) ? novo.delete(id) : novo.add(id);
    setAbertos(novo);
  }

  if (loading || !obra) {
    return (
      <ErpLayout title="Obra">
        <p className="text-muted-foreground">Carregando...</p>
      </ErpLayout>
    );
  }

  const numeroProximaMedicao =
    Math.max(0, ...historico.map((m) => Number(m.numero) || 0)) + 1;

  return (
    <ErpLayout
      title={obra.nome}
      breadcrumb={
        <>
          <Link to="/erp/obras" className="hover:text-cta">
            Obras
          </Link>
          {" / "}
          {obra.nome}
        </>
      }
      actions={<StatusBadge status={obra.status} />}
    >
      {/* Resumo */}
      <div className="grid gap-4 md:grid-cols-5 mb-8">
        <div className="rounded-lg border border-line bg-card p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Orçado</p>
          <p className="mt-1 text-2xl font-bold">{money(totalOrcado)}</p>
          <p className="text-xs text-muted-foreground mt-1">{obra.cliente?.nome || "—"}</p>
        </div>
        <div className="rounded-lg border border-line bg-card p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Comprometido</p>
          <p className="mt-1 text-2xl font-bold text-cta">{money(totalComprometido)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {totalOrcado > 0 ? Math.round((totalComprometido / totalOrcado) * 100) : 0}% do orçado
          </p>
        </div>
        <div className="rounded-lg border border-line bg-card p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Saldo</p>
          <p
            className={`mt-1 text-2xl font-bold ${
              totalOrcado - totalComprometido < 0 ? "text-err" : "text-ok"
            }`}
          >
            {money(totalOrcado - totalComprometido)}
          </p>
          {totalOrcado - totalComprometido < 0 && (
            <p className="mt-2 text-sm text-err font-semibold">Saldo devedor — atenção!</p>
          )}
        </div>
        <div className="rounded-lg border border-line bg-card p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Medido</p>
          <p className="mt-1 text-2xl font-bold text-ok">{money(totalMedido)}</p>
          <p className="text-xs text-muted-foreground mt-1">{historico.length} medições</p>
        </div>
        <div className="rounded-lg border border-line bg-card p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Avanço físico</p>
          <p className="mt-1 text-2xl font-bold">{avancoFisico.toFixed(1)}%</p>
          <div className="mt-2 h-2 rounded-full bg-side overflow-hidden">
            <div className="h-full bg-cta" style={{ width: `${Math.min(avancoFisico, 100)}%` }} />
          </div>
        </div>
      </div>

      {servicos.length === 0 ? (
        <div className="rounded-lg border border-line bg-card p-8 text-center text-muted-foreground">
          Nenhum orçamento vinculado a esta obra ainda.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Boletim de medição */}
          <div className="rounded-lg border border-line bg-card p-6">
            <div className="flex items-start justify-between mb-1">
              <h3 className="font-bold">Boletim de medição</h3>
              {somaPesos !== 100 && (
                <span className="text-xs text-muted-foreground">
                  Soma dos pesos: {somaPesos}% (ideal 100%)
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Meça o serviço inteiro, ou abra para medir item por item.
            </p>

            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground uppercase border-b border-line">
                  <th className="pb-2">Serviço</th>
                  <th className="pb-2 text-right">Peso</th>
                  <th className="pb-2 text-right">Orçado</th>
                  <th className="pb-2 text-right">Comprometido</th>
                  <th className="pb-2 text-right">Executado</th>
                  <th className="pb-2 text-right">Medido R$</th>
                  <th className="pb-2 text-right">Avanço</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {servicos.map((sv) => {
                  const exec = avancoServico(sv);
                  const estourou = sv.comprometido > sv.orcado;
                  const aberto = abertos.has(sv.id);
                  return (
                    <>
                      <tr key={sv.id} className="bg-side/20">
                        <td className="py-3">
                          <button
                            onClick={() => toggle(sv.id)}
                            className="font-semibold hover:text-cta text-left"
                          >
                            {sv.itens.length > 0 && (
                              <span className="text-muted-foreground mr-1">
                                {aberto ? "▾" : "▸"}
                              </span>
                            )}
                            {sv.nome}
                          </button>
                          <p className="text-xs text-muted-foreground">{sv.tipo}</p>
                        </td>
                        <td className="py-3 text-right">{sv.peso}%</td>
                        <td className="py-3 text-right">{money(sv.orcado)}</td>
                        <td className={`py-3 text-right ${estourou ? "text-err font-semibold" : ""}`}>
                          <Link to={("/erp/compras/itens?obra=" + obra.id + "&orcItemId=" + sv.id) as unknown as any} className="hover:underline">
                            {money(sv.comprometido)}
                          </Link>
                        </td>
                        <td className="py-3 text-right font-semibold">{exec.toFixed(1)}%</td>
                        <td className="py-3 text-right">{money((sv.orcado * exec) / 100)}</td>
                        <td className="py-3 text-right text-cta font-semibold">
                          {((sv.peso * exec) / 100).toFixed(1)}%
                        </td>
                        <td className="py-3 text-right">
                          <button
                            onClick={() => setMedindo({ servico: sv })}
                            className="text-xs text-cta hover:underline"
                          >
                            Medir
                          </button>
                        </td>
                      </tr>

                      {aberto &&
                        sv.itens.map((it) => (
                          <tr key={it.id} className="text-xs">
                            <td className="py-2 pl-8 text-muted-foreground">{it.descricao}</td>
                            <td className="py-2 text-right text-muted-foreground">
                              {it.peso.toFixed(1)}%
                            </td>
                            <td className="py-2 text-right text-muted-foreground">
                              {money(it.valor)}
                            </td>
                            <td className="py-2 text-right text-muted-foreground">
                              <Link to={("/erp/compras/itens?obra=" + obra.id + "&orcItemId=" + it.id) as unknown as any} className="text-muted-foreground hover:underline">
                                {money(it.comprometido)}
                              </Link>
                            </td>
                            <td className="py-2 text-right">{it.medido.toFixed(1)}%</td>
                            <td className="py-2 text-right text-muted-foreground">
                              {money((it.valor * it.medido) / 100)}
                            </td>
                            <td className="py-2 text-right text-muted-foreground">
                              {((sv.peso * it.peso * it.medido) / 10000).toFixed(2)}%
                            </td>
                            <td className="py-2 text-right">
                              <button
                                onClick={() => setMedindo({ servico: sv, item: it })}
                                className="text-cta hover:underline"
                              >
                                Medir
                              </button>
                            </td>
                          </tr>
                        ))}
                    </>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-line">
                  <td className="pt-3 font-bold" colSpan={4}>
                    Total
                  </td>
                  <td className="pt-3 text-right font-bold">{avancoFisico.toFixed(1)}%</td>
                  <td className="pt-3 text-right font-bold">{money(totalMedido)}</td>
                  <td className="pt-3 text-right font-bold text-lg">{avancoFisico.toFixed(1)}%</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>

            {semVinculo > 0 && (
              <p className="mt-4 text-xs text-muted-foreground">
                Compras sem vínculo com o orçamento: <strong>{money(semVinculo)}</strong> — contam no
                total comprometido, mas não aparecem em nenhum serviço.
              </p>
            )}
          </div>

          {/* Histórico */}
          {historico.length > 0 && (
            <div className="rounded-lg border border-line bg-card p-6">
              <h3 className="font-bold mb-4">Histórico de medições</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground uppercase border-b border-line">
                    <th className="pb-2">Nº</th>
                    <th className="pb-2">Data</th>
                    <th className="pb-2">Descrição</th>
                    <th className="pb-2 text-right">%</th>
                    <th className="pb-2 text-right">Valor</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {[...historico].reverse().map((m) => (
                    <tr key={m.id}>
                      <td className="py-2 text-muted-foreground">{m.numero || "—"}</td>
                      <td className="py-2 text-muted-foreground">
                        {m.data
                          ? new Date(m.data + "T00:00:00").toLocaleDateString("pt-BR")
                          : new Date(m.created_at).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="py-2">{m.nome}</td>
                      <td className="py-2 text-right">{Number(m.percentual_medido).toFixed(1)}%</td>
                      <td className="py-2 text-right">{money(Number(m.valor))}</td>
                      <td className="py-2">
                        <StatusBadge status={m.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {medindo && (
        <MedicaoModal
          obraId={obraId}
          companyId={obra.company_id}
          numero={numeroProximaMedicao}
          servico={medindo.servico}
          item={medindo.item}
          onDone={() => {
            setMedindo(null);
            load();
          }}
          onCancel={() => setMedindo(null)}
        />
      )}
    </ErpLayout>
  );
}

function MedicaoModal({
  obraId,
  companyId,
  numero,
  servico,
  item,
  onDone,
  onCancel,
}: {
  obraId: string;
  companyId: string;
  numero: number;
  servico: ServicoLinha;
  item?: ItemLinha;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [percentual, setPercentual] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const jaMedido = item ? item.medido : servico.medidoDireto;
  const base = item ? item.valor : servico.orcado;
  const alvo = item ? item.descricao : servico.nome;
  const restante = Math.max(100 - jaMedido, 0);

  const pct = Number(percentual) || 0;
  const valorMedido = (base * pct) / 100;
  // Quanto este lançamento representa no avanço total da obra
  const contribui = item
    ? (servico.peso * item.peso * pct) / 10000
    : (servico.peso * pct) / 100;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (pct > restante) {
      setErro(`Este ${item ? "item" : "serviço"} já está ${jaMedido.toFixed(1)}% medido. Máximo: ${restante.toFixed(1)}%.`);
      return;
    }
    setLoading(true);
    setErro(null);
    const { error } = await supabase.from("medicoes").insert({
      company_id: companyId,
      obra_id: obraId,
      servico_id: servico.id,
      orcamento_item_id: item?.id || null,
      numero,
      data,
      nome: `${numero}ª MED — ${alvo}`,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form
        onSubmit={salvar}
        className="w-full max-w-md rounded-lg border border-line bg-card p-6 space-y-4"
      >
        <div>
          <h3 className="text-lg font-bold">{numero}ª Medição</h3>
          <p className="text-sm text-muted-foreground">
            {item ? `${servico.nome} → ${item.descricao}` : servico.nome}
          </p>
        </div>

        <div className="rounded-lg bg-side p-3 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Já medido</span>
            <span className="font-semibold">{jaMedido.toFixed(1)}%</span>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-muted-foreground">Falta medir</span>
            <span className="font-semibold">{restante.toFixed(1)}%</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
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
              autoFocus
              className="field"
              value={percentual}
              onChange={(e) => setPercentual(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Data</label>
            <input
              type="date"
              className="field"
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
          </div>
        </div>

        <div className="rounded-lg bg-side p-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground text-xs">Valor desta medição</span>
            <span className="font-bold">{money(valorMedido)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground text-xs">Avanço que gera na obra</span>
            <span className="font-bold text-cta">{contribui.toFixed(2)}%</span>
          </div>
        </div>

        {erro && <p className="text-sm text-err">{erro}</p>}

        <div className="flex gap-3">
          <button type="submit" disabled={loading || !percentual} className="btn-cta disabled:opacity-50">
            {loading ? "Salvando..." : "Lançar medição"}
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
