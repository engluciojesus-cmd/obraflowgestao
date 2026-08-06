import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/useAuth";
import { ErpLayout, StatusBadge, money } from "@/components/ErpLayout";
import { ComprasSubNav } from "@/components/ComprasSubNav";
import type { Contrato, ContratoStatus, Fornecedor, Obra } from "@/types";

export const Route = createFileRoute("/_authenticated/erp/compras/contratos/")({
  head: () => ({ meta: [{ title: "Contratos — ObraFlow Gestão" }] }),
  component: ContratosPage,
});

const PROXIMO: Record<string, { label: string; status: ContratoStatus }[]> = {
  RASCUNHO: [{ label: "Enviar para assinatura", status: "AGUARDANDO ASSINATURA" }],
  "AGUARDANDO ASSINATURA": [{ label: "Marcar assinado", status: "ASSINADO" }],
  ASSINADO: [{ label: "Concluir", status: "CONCLUÍDO" }],
};

function ContratosPage() {
  const { companyId, company, loading: companyLoading } = useActiveCompany();
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (companyId) load();
  }, [companyId]);

  async function load() {
    if (!companyId) return;
    setLoading(true);
    const [{ data: contratosData }, { data: fornsData }, { data: obrasData }] = await Promise.all([
      supabase
        .from("contratos")
        .select("*, obra:obras(nome), fornecedor:fornecedores(nome, cnpj), itens:contrato_itens(*)")
        .eq("company_id", companyId)
        .order("numero", { ascending: false }),
      supabase
        .from("fornecedores")
        .select("*")
        .eq("company_id", companyId)
        .eq("status", "ATIVO")
        .order("nome"),
      supabase.from("obras").select("*").eq("company_id", companyId).order("nome"),
    ]);
    setContratos((contratosData as any) || []);
    setFornecedores(fornsData || []);
    setObras(obrasData || []);
    setLoading(false);
  }

  async function mudarStatus(c: Contrato, status: ContratoStatus) {
    await supabase.from("contratos").update({ status }).eq("id", c.id);
    load();
  }

  async function excluir(c: Contrato) {
    if (!confirm(`Excluir o contrato "${c.identificador}"?`)) return;
    await supabase.from("contratos").delete().eq("id", c.id);
    load();
  }

  function gerarPdf(c: Contrato) {
    const itens = [...(c.itens || [])].sort((a, b) => a.ordem - b.ordem);
    const total = itens.reduce(
      (s, it) => s + Number(it.quantidade) * Number(it.valor_unitario),
      0
    );
    const numero = String(c.numero).padStart(6, "0");

    const linhas = itens
      .map(
        (it, i) => `
      <tr>
        <td class="num">${i + 1}</td>
        <td>${it.descricao}</td>
        <td class="num">${it.quantidade} ${it.unidade || ""}</td>
        <td class="num">${money(Number(it.valor_unitario))}</td>
        <td class="num">${money(Number(it.quantidade) * Number(it.valor_unitario))}</td>
      </tr>`
      )
      .join("");

    const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Contrato ${numero}</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  body { font-family: "Segoe UI", Arial, sans-serif; color: #1a1a1a; font-size: 11px; margin: 0; }
  header { display: flex; align-items: flex-start; justify-content: space-between;
           border-bottom: 2px solid #E8590C; padding-bottom: 10px; margin-bottom: 18px; }
  header img { max-height: 48px; max-width: 170px; object-fit: contain; }
  .empresa { font-size: 14px; font-weight: 700; }
  h1 { font-size: 15px; margin: 0 0 4px; }
  .sub { color: #777; margin-bottom: 16px; }
  .bloco { border: 1px solid #ddd; margin-bottom: 10px; }
  .bloco .tit { background: #f0f0f0; padding: 5px 8px; font-weight: 700;
                font-size: 10px; text-transform: uppercase; }
  .bloco .corpo { padding: 8px; display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; }
  .campo { display: flex; gap: 6px; }
  .campo .rot { color: #666; min-width: 90px; }
  table.itens { width: 100%; border-collapse: collapse; margin-top: 12px; }
  table.itens th { background: #f0f0f0; text-align: left; padding: 6px 8px;
                   border-bottom: 1px solid #999; font-size: 10px; text-transform: uppercase; }
  table.itens td { padding: 6px 8px; border-bottom: 1px solid #eee; }
  .num { text-align: right; white-space: nowrap; }
  tfoot td { font-weight: 700; }
  .assinaturas { margin-top: 52px; display: flex; gap: 40px; }
  .assinaturas div { flex: 1; border-top: 1px solid #333; padding-top: 6px;
                     text-align: center; font-size: 10px; }
  footer { margin-top: 26px; padding-top: 8px; border-top: 1px solid #ddd;
           display: flex; justify-content: space-between; font-size: 9px; color: #888; }
</style></head><body>
  <header>
    <div>
      ${company?.logo_url ? `<img src="${company.logo_url}" alt="">` : `<div class="empresa">${company?.name || ""}</div>`}
    </div>
    <div style="text-align:right">
      <div style="font-weight:700">CONTRATO ${numero}</div>
      <div style="color:#777">${new Date(c.created_at).toLocaleDateString("pt-BR")}</div>
    </div>
  </header>

  <h1>${c.identificador}</h1>
  <div class="sub">${c.descricao || ""}</div>

  <div class="bloco">
    <div class="tit">Contratante</div>
    <div class="corpo">
      <div class="campo"><span class="rot">Empresa</span><span>${company?.name || "—"}</span></div>
      <div class="campo"><span class="rot">Obra</span><span>${c.obra?.nome || "—"}</span></div>
    </div>
  </div>

  <div class="bloco">
    <div class="tit">Contratada</div>
    <div class="corpo">
      <div class="campo"><span class="rot">Fornecedor</span><span>${c.fornecedor?.nome || "—"}</span></div>
      <div class="campo"><span class="rot">CNPJ</span><span>${c.fornecedor?.cnpj || "—"}</span></div>
    </div>
  </div>

  <div class="bloco">
    <div class="tit">Vigência</div>
    <div class="corpo">
      <div class="campo"><span class="rot">Início</span><span>${
        c.data_inicio ? new Date(c.data_inicio + "T00:00:00").toLocaleDateString("pt-BR") : "—"
      }</span></div>
      <div class="campo"><span class="rot">Término</span><span>${
        c.data_fim ? new Date(c.data_fim + "T00:00:00").toLocaleDateString("pt-BR") : "—"
      }</span></div>
    </div>
  </div>

  <table class="itens">
    <thead>
      <tr>
        <th style="width:26px">N.</th>
        <th>Serviço / Insumo</th>
        <th class="num">Qtd.</th>
        <th class="num">Unit. (R$)</th>
        <th class="num">Total (R$)</th>
      </tr>
    </thead>
    <tbody>${linhas}</tbody>
    <tfoot>
      <tr><td colspan="4" class="num">VALOR TOTAL DO CONTRATO</td><td class="num">${money(total)}</td></tr>
    </tfoot>
  </table>

  <div class="assinaturas">
    <div>${company?.name || "Contratante"}<br><span style="color:#777">Contratante</span></div>
    <div>${c.fornecedor?.nome || "Contratada"}<br><span style="color:#777">Contratada</span></div>
  </div>

  <footer>
    <span>${company?.name || ""}</span>
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
  }

  const total = contratos.reduce((s, c) => s + Number(c.valor), 0);

  if (companyLoading) return null;

  return (
    <ErpLayout
      title="Contratos"
      breadcrumb="Compras / Contratos"
      actions={
        <button onClick={() => setShowForm(true)} className="btn-cta">
          + Novo Contrato
        </button>
      }
    >
      <ComprasSubNav />
      {showForm && (
        <ContratoForm
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

      <div className="rounded-lg border border-line bg-card p-6">
        <h3 className="font-bold mb-4">
          Contratos ({contratos.length}) · {money(total)}
        </h3>
        {loading ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : contratos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum contrato cadastrado.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground uppercase border-b border-line">
                <th className="pb-2">Nº</th>
                <th className="pb-2">Identificador</th>
                <th className="pb-2">Fornecedor</th>
                <th className="pb-2">Obra</th>
                <th className="pb-2">Vigência</th>
                <th className="pb-2 text-right">Valor</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {contratos.map((c) => (
                <tr key={c.id}>
                  <td className="py-3 font-semibold">{String(c.numero).padStart(6, "0")}</td>
                  <td className="py-3">
                    <p className="font-semibold">{c.identificador}</p>
                    {c.descricao && (
                      <p className="text-xs text-muted-foreground">{c.descricao}</p>
                    )}
                  </td>
                  <td className="py-3 text-muted-foreground">{c.fornecedor?.nome || "—"}</td>
                  <td className="py-3 text-muted-foreground">{c.obra?.nome || "—"}</td>
                  <td className="py-3 text-muted-foreground text-xs">
                    {c.data_inicio
                      ? new Date(c.data_inicio + "T00:00:00").toLocaleDateString("pt-BR")
                      : "—"}
                    {" a "}
                    {c.data_fim
                      ? new Date(c.data_fim + "T00:00:00").toLocaleDateString("pt-BR")
                      : "—"}
                  </td>
                  <td className="py-3 text-right font-semibold">{money(Number(c.valor))}</td>
                  <td className="py-3">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="py-3">
                    <div className="flex gap-3 flex-wrap">
                      <button onClick={() => gerarPdf(c)} className="text-xs text-cta hover:underline">
                        PDF
                      </button>
                      {(PROXIMO[c.status] || []).map((p) => (
                        <button
                          key={p.status}
                          onClick={() => mudarStatus(c, p.status)}
                          className="text-xs text-ok hover:underline"
                        >
                          {p.label}
                        </button>
                      ))}
                      <button onClick={() => excluir(c)} className="text-xs text-err hover:underline">
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

function ContratoForm({
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
  const [identificador, setIdentificador] = useState("");
  const [descricao, setDescricao] = useState("");
  const [obraId, setObraId] = useState("");
  const [fornecedorId, setFornecedorId] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [itens, setItens] = useState([
    { descricao: "", quantidade: "1", unidade: "vb", valor_unitario: "", orcamento_item_id: "" },
  ]);
  const [orcamentoItens, setOrcamentoItens] = useState<{ id: string; label: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!obraId) {
      setOrcamentoItens([]);
      return;
    }
    supabase
      .from("orcamentos")
      .select("nome, servicos:orcamento_servicos(nome, itens:orcamento_itens(id, descricao))")
      .eq("obra_id", obraId)
      .then(({ data }) => {
        const opts: { id: string; label: string }[] = [];
        for (const orc of data || []) {
          for (const sv of (orc as any).servicos || []) {
            for (const it of sv.itens || []) {
              opts.push({ id: it.id, label: `${sv.nome} — ${it.descricao}` });
            }
          }
        }
        setOrcamentoItens(opts);
      });
  }, [obraId]);

  const total = itens.reduce(
    (s: number, it: any) => s + Number(it.quantidade || 0) * Number(it.valor_unitario || 0),
    0
  );

  function updateItem(i: number, campo: string, valor: string) {
    const copia = [...itens];
    (copia[i] as any)[campo] = valor;
    setItens(copia);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro(null);
    try {
      const { data: ultimo } = await supabase
        .from("contratos")
        .select("numero")
        .eq("company_id", companyId)
        .order("numero", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: contrato, error } = await supabase
        .from("contratos")
        .insert({
          company_id: companyId,
          obra_id: obraId || null,
          fornecedor_id: fornecedorId || null,
          numero: (ultimo?.numero || 0) + 1,
          identificador: identificador.toUpperCase(),
          descricao: descricao || null,
          data_inicio: dataInicio || null,
          data_fim: dataFim || null,
          valor: total,
          status: "RASCUNHO",
        })
        .select()
        .single();
      if (error) throw error;

      const validos = itens.filter((it: any) => it.descricao.trim());
      if (validos.length > 0) {
        const { error: itensError } = await supabase.from("contrato_itens").insert(
          validos.map((it: any, i: number) => ({
            contrato_id: contrato.id,
            orcamento_item_id: it.orcamento_item_id || null,
            descricao: it.descricao,
            quantidade: Number(it.quantidade) || 1,
            unidade: it.unidade || "vb",
            valor_unitario: Number(it.valor_unitario) || 0,
            ordem: i,
          }))
        );
        if (itensError) throw itensError;
      }
      onDone();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao salvar contrato");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-line bg-card p-6 mb-6">
      <h3 className="font-bold mb-4">Novo Contrato</h3>
      <form onSubmit={salvar} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              Identificador *
            </label>
            <input
              required
              className="field"
              placeholder="Ex: CONTRATO GERENCIAMENTO E ASSESSORIA"
              value={identificador}
              onChange={(e) => setIdentificador(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              Descrição
            </label>
            <input
              className="field"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
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
              Fornecedor
            </label>
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
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              Data início
            </label>
            <input
              type="date"
              className="field"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              Data fim
            </label>
            <input
              type="date"
              className="field"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-2">
            Serviços / insumos contratados
          </label>
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
                  step="0.01"
                  className="field md:col-span-1"
                  placeholder="Qtd"
                  value={it.quantidade}
                  onChange={(e) => updateItem(i, "quantidade", e.target.value)}
                />
                <input
                  className="field md:col-span-1"
                  placeholder="Un"
                  value={it.unidade}
                  onChange={(e) => updateItem(i, "unidade", e.target.value)}
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
                  className="field md:col-span-4"
                  value={it.orcamento_item_id}
                  onChange={(e) => updateItem(i, "orcamento_item_id", e.target.value)}
                  disabled={!obraId}
                >
                  <option value="">
                    {obraId ? "Vincular ao orçamento (opcional)" : "Selecione a obra primeiro"}
                  </option>
                  {orcamentoItens.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {itens.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setItens(itens.filter((_, idx) => idx !== i))}
                    className="text-xs text-err md:col-span-1"
                  >
                    Remover
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() =>
              setItens([
                ...itens,
                { descricao: "", quantidade: "1", unidade: "vb", valor_unitario: "", orcamento_item_id: "" },
              ])
            }
            className="mt-2 text-xs text-cta hover:underline"
          >
            + Adicionar item
          </button>
        </div>

        <p className="text-sm font-semibold">Valor do contrato: {money(total)}</p>

        {erro && <p className="text-sm text-err">{erro}</p>}

        <div className="flex gap-3">
          <button type="submit" disabled={loading} className="btn-cta disabled:opacity-50">
            {loading ? "Salvando..." : "Salvar Contrato"}
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
