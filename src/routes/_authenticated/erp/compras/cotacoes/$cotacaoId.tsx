import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/useAuth";
import { ErpLayout, money } from "@/components/ErpLayout";
import { ComprasSubNav } from "@/components/ComprasSubNav";
import type { Cotacao, CotacaoItem, CotacaoFornecedor, CotacaoPreco, Fornecedor } from "@/types";

export const Route = createFileRoute("/_authenticated/erp/compras/cotacoes/$cotacaoId")({
  head: () => ({ meta: [{ title: "Mapa de Cotação — ObraFlow Gestão" }] }),
  component: MapaCotacao,
});

function MapaCotacao() {
  const { cotacaoId } = Route.useParams();
  const { companyId } = useActiveCompany();
  const [cotacao, setCotacao] = useState<Cotacao | null>(null);
  const [itens, setItens] = useState<CotacaoItem[]>([]);
  const [fornecedores, setFornecedores] = useState<CotacaoFornecedor[]>([]);
  const [precos, setPrecos] = useState<Map<string, CotacaoPreco>>(new Map());
  const [disponiveis, setDisponiveis] = useState<Fornecedor[]>([]);
  const [tiposPagamento, setTiposPagamento] = useState<{ id: string; nome: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [showOC, setShowOC] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    load();
  }, [cotacaoId]);

  async function load() {
    setLoading(true);
    const [{ data: cot }, { data: itensData }, { data: fornsData }] = await Promise.all([
      supabase.from("cotacoes").select("*, obra:obras(nome)").eq("id", cotacaoId).single(),
      supabase.from("cotacao_itens").select("*").eq("cotacao_id", cotacaoId).order("ordem"),
      supabase
        .from("cotacao_fornecedores")
        .select("*, fornecedor:fornecedores(nome)")
        .eq("cotacao_id", cotacaoId)
        .order("created_at"),
    ]);

    setCotacao(cot);
    setItens(itensData || []);
    setFornecedores((fornsData as any) || []);

    const fornIds = (fornsData || []).map((f: any) => f.id);
    if (fornIds.length > 0) {
      const { data: precosData } = await supabase
        .from("cotacao_precos")
        .select("*")
        .in("cotacao_fornecedor_id", fornIds);
      const mapa = new Map<string, CotacaoPreco>();
      for (const p of precosData || []) {
        mapa.set(`${p.cotacao_fornecedor_id}|${p.cotacao_item_id}`, p as CotacaoPreco);
      }
      setPrecos(mapa);
    } else {
      setPrecos(new Map());
    }

    if (companyId) {
      const [{ data: forns }, { data: tipos }] = await Promise.all([
        supabase
          .from("fornecedores")
          .select("*")
          .eq("company_id", companyId)
          .eq("status", "ATIVO")
          .order("nome"),
        supabase.from("tipos_pagamento").select("id, nome").eq("company_id", companyId).order("nome"),
      ]);
      setDisponiveis(forns || []);
      setTiposPagamento(tipos || []);
    }

    setLoading(false);
  }

  function preco(fornId: string, itemId: string) {
    return precos.get(`${fornId}|${itemId}`);
  }

  // Menor preço unitário de cada item entre os fornecedores que cotaram
  function menorPreco(itemId: string) {
    let menor = Infinity;
    for (const f of fornecedores) {
      const v = Number(preco(f.id, itemId)?.valor_unitario) || 0;
      if (v > 0 && v < menor) menor = v;
    }
    return menor === Infinity ? 0 : menor;
  }

  async function salvarPreco(fornId: string, itemId: string, campo: "valor_unitario" | "marca", valor: string) {
    const chave = `${fornId}|${itemId}`;
    const atual = precos.get(chave);
    const novo = {
      cotacao_fornecedor_id: fornId,
      cotacao_item_id: itemId,
      valor_unitario: campo === "valor_unitario" ? Number(valor) || 0 : Number(atual?.valor_unitario) || 0,
      marca: campo === "marca" ? valor : atual?.marca || null,
      escolhido: atual?.escolhido || false,
    };

    // Atualiza a tela na hora, grava em seguida
    const copia = new Map(precos);
    copia.set(chave, { ...(atual as any), ...novo, id: atual?.id || chave });
    setPrecos(copia);

    setSalvando(true);
    await supabase
      .from("cotacao_precos")
      .upsert(novo, { onConflict: "cotacao_fornecedor_id,cotacao_item_id" });
    setSalvando(false);
  }

  async function alternarEscolha(fornId: string, itemId: string) {
    const chave = `${fornId}|${itemId}`;
    const atual = precos.get(chave);
    if (!atual || !Number(atual.valor_unitario)) return;

    const copia = new Map(precos);
    // Só um fornecedor por item
    for (const f of fornecedores) {
      const k = `${f.id}|${itemId}`;
      const p = copia.get(k);
      if (p) copia.set(k, { ...p, escolhido: k === chave ? !atual.escolhido : false });
    }
    setPrecos(copia);

    setSalvando(true);
    for (const f of fornecedores) {
      const k = `${f.id}|${itemId}`;
      const p = copia.get(k);
      if (!p) continue;
      await supabase
        .from("cotacao_precos")
        .upsert(
          {
            cotacao_fornecedor_id: f.id,
            cotacao_item_id: itemId,
            valor_unitario: Number(p.valor_unitario) || 0,
            marca: p.marca || null,
            escolhido: p.escolhido,
          },
          { onConflict: "cotacao_fornecedor_id,cotacao_item_id" }
        );
    }
    setSalvando(false);
  }

  async function adicionarFornecedor(fornecedorId: string) {
    if (!fornecedorId) return;
    await supabase.from("cotacao_fornecedores").insert({
      cotacao_id: cotacaoId,
      fornecedor_id: fornecedorId,
    });
    load();
  }

  async function removerFornecedor(id: string) {
    if (!confirm("Remover este fornecedor da cotação? Os preços dele serão apagados.")) return;
    await supabase.from("cotacao_fornecedores").delete().eq("id", id);
    load();
  }

  async function atualizarFornecedor(id: string, campo: string, valor: any) {
    setFornecedores(fornecedores.map((f) => (f.id === id ? { ...f, [campo]: valor } : f)));
    await supabase.from("cotacao_fornecedores").update({ [campo]: valor }).eq("id", id);
  }

  function copiarLista() {
    const linhas = itens
      .map((it, i) => `${i + 1}. ${it.descricao} — ${it.quantidade} ${it.unidade || "un"}`)
      .join("\n");
    const texto = `*Solicitação de cotação${cotacao ? ` COT-${String(cotacao.numero).padStart(3, "0")}` : ""}*\n${
      cotacao?.obra?.nome ? `Obra: ${cotacao.obra.nome}\n` : ""
    }\n${linhas}\n\nPor favor, informe preço unitário, marca e condição de pagamento.`;
    navigator.clipboard.writeText(texto);
    alert("Lista copiada. Cole na conversa com o fornecedor.");
  }

  // Totais por fornecedor (todos os itens) e do que foi escolhido
  function totalFornecedor(fornId: string) {
    const itensTotal = itens.reduce((s, it) => {
      const v = Number(preco(fornId, it.id)?.valor_unitario) || 0;
      return s + v * Number(it.quantidade);
    }, 0);
    const f = fornecedores.find((x) => x.id === fornId);
    return itensTotal + (Number(f?.frete) || 0);
  }

  const escolhidos = itens.map((it) => {
    for (const f of fornecedores) {
      const p = preco(f.id, it.id);
      if (p?.escolhido) return { item: it, fornecedor: f, preco: p };
    }
    return null;
  });
  const totalEscolhido = escolhidos.reduce(
    (s, e) => (e ? s + Number(e.preco.valor_unitario) * Number(e.item.quantidade) : s),
    0
  );
  const itensDecididos = escolhidos.filter(Boolean).length;

  if (loading || !cotacao) {
    return (
      <ErpLayout title="Mapa de Cotação">
        <p className="text-muted-foreground">Carregando...</p>
      </ErpLayout>
    );
  }

  const naoAdicionados = disponiveis.filter(
    (d) => !fornecedores.some((f) => f.fornecedor_id === d.id)
  );

  return (
    <ErpLayout
      title={`Cotação COT-${String(cotacao.numero).padStart(3, "0")}`}
      breadcrumb={
        <>
          <Link to="/erp/compras/itens" className="hover:text-cta">
            Compras
          </Link>
          {" / "}
          Cotação
        </>
      }
      actions={
        <div className="flex gap-2 items-center">
          {salvando && <span className="text-xs text-muted-foreground">salvando...</span>}
          {itensDecididos > 0 && (
            <button onClick={() => setShowOC(true)} className="btn-cta">
              Gerar Ordem de Compra
            </button>
          )}
          <button onClick={copiarLista} className="rounded-lg bg-side px-4 py-2 text-sm font-semibold hover:bg-side/80">
            Copiar lista
          </button>
        </div>
      }
    >
      <ComprasSubNav />
      {/* Cabeçalho */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <div className="rounded-lg border border-line bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Obra</p>
          <p className="mt-1 text-sm font-semibold">{cotacao.obra?.nome || "—"}</p>
        </div>
        <div className="rounded-lg border border-line bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Itens</p>
          <p className="mt-1 text-sm font-semibold">
            {itensDecididos} de {itens.length} decididos
          </p>
        </div>
        <div className="rounded-lg border border-line bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Fornecedores</p>
          <p className="mt-1 text-sm font-semibold">{fornecedores.length}</p>
        </div>
        <div className="rounded-lg border border-line bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Compra selecionada</p>
          <p className="mt-1 text-lg font-bold text-cta">{money(totalEscolhido)}</p>
        </div>
      </div>

      {/* Adicionar fornecedor */}
      <div className="rounded-lg border border-line bg-card p-4 mb-6 flex gap-3 items-center flex-wrap">
        <span className="text-sm font-semibold">Adicionar fornecedor:</span>
        <select
          className="field w-64"
          value=""
          onChange={(e) => adicionarFornecedor(e.target.value)}
          disabled={naoAdicionados.length === 0}
        >
          <option value="">
            {naoAdicionados.length === 0 ? "Todos já adicionados" : "Selecione..."}
          </option>
          {naoAdicionados.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nome}
            </option>
          ))}
        </select>
      </div>

      {fornecedores.length === 0 ? (
        <div className="rounded-lg border border-line bg-card p-8 text-center text-muted-foreground">
          Adicione ao menos um fornecedor para começar a preencher os preços.
        </div>
      ) : (
        <div className="rounded-lg border border-line bg-card overflow-x-auto">
          <table className="text-sm min-w-full">
            <thead>
              {/* Nome dos fornecedores */}
              <tr className="border-b border-line">
                <th className="px-3 py-2 text-left sticky left-0 bg-card z-10" colSpan={3}>
                  <span className="text-xs uppercase text-muted-foreground">Item</span>
                </th>
                {fornecedores.map((f) => (
                  <th key={f.id} className="px-3 py-2 text-center border-l border-line" colSpan={3}>
                    <div className="flex items-center justify-center gap-2">
                      <span className="font-bold">{f.fornecedor?.nome}</span>
                      <button
                        onClick={() => removerFornecedor(f.id)}
                        className="text-xs text-err hover:underline"
                      >
                        ✕
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
              {/* Subcabeçalho */}
              <tr className="border-b border-line text-xs uppercase text-muted-foreground">
                <th className="px-3 py-2 text-left sticky left-0 bg-card z-10">Descrição</th>
                <th className="px-2 py-2 text-right">Qtd</th>
                <th className="px-2 py-2">Un</th>
                {fornecedores.map((f) => (
                  <>
                    <th key={`${f.id}-u`} className="px-2 py-2 text-right border-l border-line">
                      Unit.
                    </th>
                    <th key={`${f.id}-t`} className="px-2 py-2 text-right">
                      Total
                    </th>
                    <th key={`${f.id}-m`} className="px-2 py-2">
                      Marca
                    </th>
                  </>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-line">
              {itens.map((it) => {
                const menor = menorPreco(it.id);
                return (
                  <tr key={it.id}>
                    <td className="px-3 py-2 sticky left-0 bg-card z-10 font-medium">
                      {it.descricao}
                    </td>
                    <td className="px-2 py-2 text-right text-muted-foreground">{it.quantidade}</td>
                    <td className="px-2 py-2 text-muted-foreground">{it.unidade}</td>

                    {fornecedores.map((f) => {
                      const p = preco(f.id, it.id);
                      const unit = Number(p?.valor_unitario) || 0;
                      const total = unit * Number(it.quantidade);
                      const ehMenor = unit > 0 && unit === menor;
                      return (
                        <>
                          <td key={`${f.id}-${it.id}-u`} className="px-1 py-1 border-l border-line">
                            <input
                              type="number"
                              step="0.01"
                              className={`field text-right text-xs py-1 ${
                                p?.escolhido ? "ring-1 ring-cta" : ""
                              }`}
                              value={unit || ""}
                              placeholder="0,00"
                              onChange={(e) =>
                                salvarPreco(f.id, it.id, "valor_unitario", e.target.value)
                              }
                            />
                          </td>
                          <td
                            key={`${f.id}-${it.id}-t`}
                            className={`px-2 py-2 text-right cursor-pointer ${
                              ehMenor ? "bg-ok/15 font-bold text-ok" : ""
                            } ${p?.escolhido ? "ring-1 ring-inset ring-cta" : ""}`}
                            onClick={() => alternarEscolha(f.id, it.id)}
                            title="Clique para escolher este fornecedor para o item"
                          >
                            {unit > 0 ? money(total) : "—"}
                            {p?.escolhido && <span className="ml-1 text-cta">✓</span>}
                          </td>
                          <td key={`${f.id}-${it.id}-m`} className="px-1 py-1">
                            <input
                              className="field text-xs py-1"
                              value={p?.marca || ""}
                              placeholder="—"
                              onChange={(e) => salvarPreco(f.id, it.id, "marca", e.target.value)}
                            />
                          </td>
                        </>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>

            <tfoot>
              {/* Frete */}
              <tr className="border-t border-line">
                <td className="px-3 py-2 sticky left-0 bg-card z-10 text-xs uppercase text-muted-foreground" colSpan={3}>
                  Frete
                </td>
                {fornecedores.map((f) => (
                  <td key={`${f.id}-frete`} className="px-1 py-1 border-l border-line" colSpan={3}>
                    <input
                      type="number"
                      step="0.01"
                      className="field text-right text-xs py-1"
                      value={Number(f.frete) || ""}
                      placeholder="0,00"
                      onChange={(e) => atualizarFornecedor(f.id, "frete", Number(e.target.value) || 0)}
                    />
                  </td>
                ))}
              </tr>

              {/* Condição de pagamento */}
              <tr>
                <td className="px-3 py-2 sticky left-0 bg-card z-10 text-xs uppercase text-muted-foreground" colSpan={3}>
                  Condição de pgto.
                </td>
                {fornecedores.map((f) => (
                  <td key={`${f.id}-cond`} className="px-1 py-1 border-l border-line" colSpan={3}>
                    <select
                      className="field text-xs py-1"
                      value={f.condicao_pagamento || ""}
                      onChange={(e) => atualizarFornecedor(f.id, "condicao_pagamento", e.target.value)}
                    >
                      <option value="">—</option>
                      {tiposPagamento.map((t) => (
                        <option key={t.id} value={t.nome}>
                          {t.nome}
                        </option>
                      ))}
                    </select>
                  </td>
                ))}
              </tr>

              {/* Total por fornecedor */}
              <tr className="border-t-2 border-line">
                <td className="px-3 py-3 sticky left-0 bg-card z-10 font-bold" colSpan={3}>
                  Total do fornecedor
                </td>
                {fornecedores.map((f) => (
                  <td
                    key={`${f.id}-total`}
                    className="px-2 py-3 text-right font-bold border-l border-line"
                    colSpan={3}
                  >
                    {money(totalFornecedor(f.id))}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Resumo da compra */}
      {itensDecididos > 0 && (
        <div className="mt-6 rounded-lg border border-line bg-card p-6">
          <h3 className="font-bold mb-4">Compra selecionada</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground uppercase border-b border-line">
                <th className="pb-2">Item</th>
                <th className="pb-2">Fornecedor</th>
                <th className="pb-2">Marca</th>
                <th className="pb-2 text-right">Qtd</th>
                <th className="pb-2 text-right">Unit.</th>
                <th className="pb-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {escolhidos.filter(Boolean).map((e) => (
                <tr key={e!.item.id}>
                  <td className="py-2">{e!.item.descricao}</td>
                  <td className="py-2 font-semibold">{e!.fornecedor.fornecedor?.nome}</td>
                  <td className="py-2 text-muted-foreground">{e!.preco.marca || "—"}</td>
                  <td className="py-2 text-right">{e!.item.quantidade}</td>
                  <td className="py-2 text-right">{money(Number(e!.preco.valor_unitario))}</td>
                  <td className="py-2 text-right font-semibold">
                    {money(Number(e!.preco.valor_unitario) * Number(e!.item.quantidade))}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-line">
                <td className="pt-3 font-bold" colSpan={5}>
                  Total
                </td>
                <td className="pt-3 text-right font-bold text-lg">{money(totalEscolhido)}</td>
              </tr>
            </tfoot>
          </table>

          {itensDecididos < itens.length && (
            <p className="mt-4 text-xs text-muted-foreground">
              Faltam {itens.length - itensDecididos} itens sem fornecedor escolhido. Clique no valor
              total de um fornecedor para escolhê-lo para aquele item.
            </p>
          )}
        </div>
      )}
      {showOC && (
        <GerarOCModal
          companyId={companyId!}
          cotacaoId={cotacaoId}
          obraId={cotacao.obra_id || null}
          tiposPagamento={tiposPagamento}
          grupos={fornecedores
            .map((f) => {
              const linhas = escolhidos
                .filter((e): e is NonNullable<typeof e> => !!e && e.fornecedor.id === f.id)
                .map((e) => ({ item: e.item, preco: e.preco }));
              const itensTotal = linhas.reduce(
                (s, l) => s + Number(l.preco.valor_unitario) * Number(l.item.quantidade),
                0
              );
              return {
                fornecedor: f,
                linhas,
                total: itensTotal + (Number(f.frete) || 0),
              };
            })
            .filter((g) => g.linhas.length > 0)}
          onClose={() => setShowOC(false)}
          onGerado={() => navigate({ to: "/erp/compras/ordens" })}
        />
      )}
    </ErpLayout>
  );
}

function GerarOCModal({
  companyId,
  cotacaoId,
  obraId,
  grupos,
  tiposPagamento,
  onClose,
  onGerado,
}: {
  companyId: string;
  cotacaoId: string;
  obraId: string | null;
  grupos: {
    fornecedor: CotacaoFornecedor;
    linhas: { item: CotacaoItem; preco: CotacaoPreco }[];
    total: number;
  }[];
  tiposPagamento: { id: string; nome: string }[];
  onClose: () => void;
  onGerado: (ids: string[]) => void;
}) {
  // Uma OC por fornecedor. A condição de pagamento é obrigatória aqui.
  const [condicoes, setCondicoes] = useState<Record<string, string>>(
    Object.fromEntries(grupos.map((g) => [g.fornecedor.id, g.fornecedor.condicao_pagamento || ""]))
  );
  const [previsao, setPrevisao] = useState("");
  const [observacao, setObservacao] = useState(
    "É OBRIGATÓRIO INCLUIR, NAS OBSERVAÇÕES DA NOTA FISCAL, O NÚMERO DA ORDEM DE COMPRA, BEM COMO O CÓDIGO E O NOME DA OBRA."
  );
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const faltando = grupos.filter((g) => !condicoes[g.fornecedor.id]);

  async function gerar() {
    if (faltando.length > 0) {
      setErro("Informe a condição de pagamento de todos os fornecedores.");
      return;
    }
    setLoading(true);
    setErro(null);
    try {
      const { data: ultima } = await supabase
        .from("ordens_compra")
        .select("numero")
        .eq("company_id", companyId)
        .order("numero", { ascending: false })
        .limit(1)
        .maybeSingle();

      let numero = (ultima?.numero || 0) + 1;
      const criadas: string[] = [];

      for (const g of grupos) {
        const { data: oc, error } = await supabase
          .from("ordens_compra")
          .insert({
            company_id: companyId,
            cotacao_id: cotacaoId,
            obra_id: obraId,
            fornecedor_id: g.fornecedor.fornecedor_id,
            numero,
            condicao_pagamento: condicoes[g.fornecedor.id],
            previsao_entrega: previsao || null,
            frete: Number(g.fornecedor.frete) || 0,
            observacao,
            valor: g.total,
            status: "GERADA",
          })
          .select()
          .single();
        if (error) throw error;

        const { error: itensError } = await supabase.from("ordem_compra_itens").insert(
          g.linhas.map((l, i) => ({
            ordem_compra_id: oc.id,
            orcamento_item_id: l.item.orcamento_item_id || null,
            descricao: l.item.descricao,
            quantidade: Number(l.item.quantidade),
            unidade: l.item.unidade || "un",
            valor_unitario: Number(l.preco.valor_unitario),
            marca: l.preco.marca || null,
            ordem: i,
          }))
        );
        if (itensError) throw itensError;

        criadas.push(oc.id);
        numero++;
      }

      await supabase.from("cotacoes").update({ status: "FECHADA" }).eq("id", cotacaoId);
      onGerado(criadas);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao gerar ordem de compra");
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-lg border border-line bg-card p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div>
          <h3 className="text-lg font-bold">Gerar Ordem de Compra</h3>
          <p className="text-sm text-muted-foreground">
            {grupos.length === 1
              ? "Será gerada 1 ordem de compra."
              : `Serão geradas ${grupos.length} ordens, uma por fornecedor.`}
          </p>
        </div>

        <div className="space-y-3">
          {grupos.map((g) => (
            <div key={g.fornecedor.id} className="rounded-lg border border-line bg-side/40 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-sm">{g.fornecedor.fornecedor?.nome}</span>
                <span className="font-bold text-sm">{money(g.total)}</span>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                {g.linhas.length} {g.linhas.length === 1 ? "item" : "itens"}
              </p>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                Condição de pagamento *
              </label>
              <select
                className="field text-sm"
                value={condicoes[g.fornecedor.id] || ""}
                onChange={(e) =>
                  setCondicoes({ ...condicoes, [g.fornecedor.id]: e.target.value })
                }
              >
                <option value="">Selecione...</option>
                {tiposPagamento.map((t) => (
                  <option key={t.id} value={t.nome}>
                    {t.nome}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">
            Previsão de entrega
          </label>
          <input
            type="date"
            className="field"
            value={previsao}
            onChange={(e) => setPrevisao(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">
            Observação
          </label>
          <textarea
            className="field text-sm"
            rows={3}
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
          />
        </div>

        {erro && <p className="text-sm text-err">{erro}</p>}

        <div className="flex gap-3">
          <button onClick={gerar} disabled={loading} className="btn-cta disabled:opacity-50">
            {loading ? "Gerando..." : "Gerar"}
          </button>
          <button
            onClick={onClose}
            className="rounded-lg bg-side px-4 py-2.5 text-sm font-semibold hover:bg-side/80"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
