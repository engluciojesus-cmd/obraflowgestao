import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/useAuth";
import { ErpLayout, StatusBadge, money } from "@/components/ErpLayout";
import { ComprasSubNav } from "@/components/ComprasSubNav";
import type { OrdemCompra, OrdemCompraStatus } from "@/types";

export const Route = createFileRoute("/_authenticated/erp/compras/ordens/")({
  head: () => ({ meta: [{ title: "Ordens de Compra — ObraFlow Gestão" }] }),
  component: OrdensPage,
});

const PROXIMO: Record<string, { label: string; status: OrdemCompraStatus }[]> = {
  GERADA: [{ label: "Marcar enviada", status: "ENVIADA" }],
  ENVIADA: [{ label: "Confirmar", status: "CONFIRMADA" }],
  CONFIRMADA: [{ label: "Recebida", status: "RECEBIDA" }],
};

function OrdensPage() {
  const { companyId, company, loading: companyLoading } = useActiveCompany();
  const [ordens, setOrdens] = useState<OrdemCompra[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    if (companyId) load();
  }, [companyId]);

  async function load() {
    if (!companyId) return;
    setLoading(true);
    const { data } = await supabase
      .from("ordens_compra")
      .select("*, obra:obras(nome), fornecedor:fornecedores(nome, cnpj), itens:ordem_compra_itens(*)")
      .eq("company_id", companyId)
      .order("numero", { ascending: false });
    setOrdens((data as any) || []);
    setLoading(false);
  }

  async function mudarStatus(oc: OrdemCompra, status: OrdemCompraStatus) {
    await supabase.from("ordens_compra").update({ status }).eq("id", oc.id);
    load();
  }

  function gerarPdf(oc: OrdemCompra) {
    const itens = [...(oc.itens || [])].sort((a, b) => a.ordem - b.ordem);
    const subtotal = itens.reduce(
      (s, it) => s + Number(it.quantidade) * Number(it.valor_unitario),
      0
    );
    const numero = String(oc.numero).padStart(6, "0");

    const linhas = itens
      .map(
        (it, i) => `
      <tr>
        <td class="num">${i + 1}</td>
        <td>${it.descricao}${it.marca ? ` <span class="marca">(${it.marca})</span>` : ""}</td>
        <td class="num">${it.quantidade} ${it.unidade || ""}</td>
        <td class="num">${money(Number(it.valor_unitario))}</td>
        <td class="num">${money(Number(it.quantidade) * Number(it.valor_unitario))}</td>
      </tr>`
      )
      .join("");

    const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>OC ${numero}</title>
<style>
  @page { size: A4; margin: 16mm 14mm; }
  body { font-family: "Segoe UI", Arial, sans-serif; color: #1a1a1a; font-size: 11px; margin: 0; }
  header { display: flex; align-items: flex-start; justify-content: space-between;
           border-bottom: 2px solid #E8590C; padding-bottom: 10px; margin-bottom: 16px; }
  header img { max-height: 48px; max-width: 170px; object-fit: contain; }
  .empresa { font-size: 14px; font-weight: 700; }
  h1 { font-size: 15px; margin: 0 0 14px; color: #E8590C; }
  .bloco { border: 1px solid #ddd; margin-bottom: 10px; }
  .bloco .tit { background: #f0f0f0; padding: 5px 8px; font-weight: 700;
                font-size: 10px; text-transform: uppercase; }
  .bloco .corpo { padding: 8px; display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; }
  .campo { display: flex; gap: 6px; }
  .campo .rot { color: #666; min-width: 88px; }
  table.itens { width: 100%; border-collapse: collapse; margin-top: 12px; }
  table.itens th { background: #f0f0f0; text-align: left; padding: 6px 8px;
                   border-bottom: 1px solid #999; font-size: 10px; text-transform: uppercase; }
  table.itens td { padding: 6px 8px; border-bottom: 1px solid #eee; }
  .num { text-align: right; white-space: nowrap; }
  .marca { color: #777; font-size: 10px; }
  tfoot td { font-weight: 700; }
  .obs { margin-top: 14px; padding: 8px; background: #fafafa;
         border-left: 3px solid #E8590C; font-size: 10px; }
  footer { margin-top: 26px; padding-top: 8px; border-top: 1px solid #ddd;
           display: flex; justify-content: space-between; font-size: 9px; color: #888; }
</style></head><body>
  <header>
    <div>
      ${company?.logo_url ? `<img src="${company.logo_url}" alt="">` : `<div class="empresa">${company?.name || ""}</div>`}
    </div>
    <div style="text-align:right">
      <div style="font-weight:700">ORDEM DE COMPRA ${numero}</div>
      <div style="color:#777">${new Date(oc.created_at).toLocaleDateString("pt-BR")}</div>
    </div>
  </header>

  <h1>${oc.obra?.nome || "Sem obra vinculada"}</h1>

  <div class="bloco">
    <div class="tit">Dados da ordem de compra</div>
    <div class="corpo">
      <div class="campo"><span class="rot">Número</span><span>${numero}</span></div>
      <div class="campo"><span class="rot">Data</span><span>${new Date(oc.created_at).toLocaleDateString("pt-BR")}</span></div>
      <div class="campo"><span class="rot">Cond. pgto.</span><span>${oc.condicao_pagamento}</span></div>
      <div class="campo"><span class="rot">Prev. entrega</span><span>${
        oc.previsao_entrega
          ? new Date(oc.previsao_entrega + "T00:00:00").toLocaleDateString("pt-BR")
          : "—"
      }</span></div>
    </div>
  </div>

  <div class="bloco">
    <div class="tit">Dados do fornecedor</div>
    <div class="corpo">
      <div class="campo"><span class="rot">Nome</span><span>${oc.fornecedor?.nome || "—"}</span></div>
      <div class="campo"><span class="rot">CNPJ</span><span>${oc.fornecedor?.cnpj || "—"}</span></div>
    </div>
  </div>

  <div class="bloco">
    <div class="tit">Faturamento</div>
    <div class="corpo">
      <div class="campo"><span class="rot">Empresa</span><span>${company?.name || "—"}</span></div>
      <div class="campo"><span class="rot">Obra</span><span>${oc.obra?.nome || "—"}</span></div>
    </div>
  </div>

  <table class="itens">
    <thead>
      <tr>
        <th style="width:26px">N.</th>
        <th>Item</th>
        <th class="num">Qtd.</th>
        <th class="num">Unit. (R$)</th>
        <th class="num">Total (R$)</th>
      </tr>
    </thead>
    <tbody>${linhas}</tbody>
    <tfoot>
      <tr><td colspan="4" class="num">Subtotal</td><td class="num">${money(subtotal)}</td></tr>
      <tr><td colspan="4" class="num">Frete</td><td class="num">${money(Number(oc.frete))}</td></tr>
      <tr><td colspan="4" class="num">TOTAL</td><td class="num">${money(subtotal + Number(oc.frete))}</td></tr>
    </tfoot>
  </table>

  ${oc.observacao ? `<div class="obs">${oc.observacao}</div>` : ""}

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

  function copiarWhatsApp(oc: OrdemCompra) {
    const itens = [...(oc.itens || [])].sort((a, b) => a.ordem - b.ordem);
    const linhas = itens
      .map(
        (it, i) =>
          `${i + 1}. ${it.descricao} — ${it.quantidade} ${it.unidade || ""} × ${money(
            Number(it.valor_unitario)
          )}`
      )
      .join("\n");
    const texto = `*ORDEM DE COMPRA ${String(oc.numero).padStart(6, "0")}*
${company?.name || ""}
Obra: ${oc.obra?.nome || "—"}

${linhas}

*Total: ${money(Number(oc.valor))}*
Condição de pagamento: ${oc.condicao_pagamento}${
      oc.previsao_entrega
        ? `\nPrevisão de entrega: ${new Date(oc.previsao_entrega + "T00:00:00").toLocaleDateString("pt-BR")}`
        : ""
    }

${oc.observacao || ""}`;
    navigator.clipboard.writeText(texto);
    alert("Ordem copiada. Cole na conversa com o fornecedor.");
  }

  const filtradas = statusFilter ? ordens.filter((o) => o.status === statusFilter) : ordens;
  const total = filtradas.reduce((s, o) => s + Number(o.valor), 0);

  if (companyLoading) return null;

  return (
    <ErpLayout title="Ordem de Compra" breadcrumb="Compras / Ordem de Compra">
      <ComprasSubNav />
      <div className="rounded-lg border border-line bg-card p-4 mb-6 flex gap-3 items-center flex-wrap">
        <select
          className="field w-52"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Todos os status</option>
          <option value="GERADA">Gerada</option>
          <option value="ENVIADA">Enviada ao fornecedor</option>
          <option value="CONFIRMADA">Confirmada</option>
          <option value="RECEBIDA">Recebida</option>
          <option value="CANCELADA">Cancelada</option>
        </select>
        <span className="text-sm text-muted-foreground">
          {filtradas.length} {filtradas.length === 1 ? "ordem" : "ordens"} · {money(total)}
        </span>
      </div>

      <div className="rounded-lg border border-line bg-card p-6">
        {loading ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : filtradas.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma ordem de compra. Gere uma a partir de um mapa de cotação.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground uppercase border-b border-line">
                <th className="pb-2">OC</th>
                <th className="pb-2">Fornecedor</th>
                <th className="pb-2">Obra</th>
                <th className="pb-2">Pagamento</th>
                <th className="pb-2">Entrega</th>
                <th className="pb-2 text-right">Valor</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtradas.map((oc) => (
                <tr key={oc.id}>
                  <td className="py-3 font-semibold">{String(oc.numero).padStart(6, "0")}</td>
                  <td className="py-3">{oc.fornecedor?.nome || "—"}</td>
                  <td className="py-3 text-muted-foreground">{oc.obra?.nome || "—"}</td>
                  <td className="py-3 text-muted-foreground">{oc.condicao_pagamento}</td>
                  <td className="py-3 text-muted-foreground">
                    {oc.previsao_entrega
                      ? new Date(oc.previsao_entrega + "T00:00:00").toLocaleDateString("pt-BR")
                      : "—"}
                  </td>
                  <td className="py-3 text-right font-semibold">{money(Number(oc.valor))}</td>
                  <td className="py-3">
                    <StatusBadge status={oc.status} />
                  </td>
                  <td className="py-3">
                    <div className="flex gap-3 flex-wrap">
                      <button
                        onClick={() => gerarPdf(oc)}
                        className="text-xs text-cta hover:underline"
                      >
                        PDF
                      </button>
                      <button
                        onClick={() => copiarWhatsApp(oc)}
                        className="text-xs text-cta hover:underline"
                      >
                        Copiar
                      </button>
                      {(PROXIMO[oc.status] || []).map((p) => (
                        <button
                          key={p.status}
                          onClick={() => mudarStatus(oc, p.status)}
                          className="text-xs text-ok hover:underline"
                        >
                          {p.label}
                        </button>
                      ))}
                      {oc.status !== "RECEBIDA" && oc.status !== "CANCELADA" && (
                        <button
                          onClick={() => mudarStatus(oc, "CANCELADA")}
                          className="text-xs text-err hover:underline"
                        >
                          Cancelar
                        </button>
                      )}
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
