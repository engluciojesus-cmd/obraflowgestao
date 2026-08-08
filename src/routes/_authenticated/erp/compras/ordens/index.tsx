import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/useAuth";
import { ErpLayout, StatusBadge, money } from "@/components/ErpLayout";
import { ComprasSubNav } from "@/components/ComprasSubNav";
import {
  PainelFiltros,
  CampoFiltro,
  FaixaDeData,
  SEM_BUSCA,
  SEM_RESULTADO,
} from "@/components/PainelFiltros";
// O vocabulário de status do fluxo de suprimentos (docs/05 §3) é mais amplo
// que o legado em @/types — daí o alias, para não colidir com OrdemCompraStatus.
import {
  ORDEM_COMPRA_STATUS,
  type OrdemCompraStatus as OrdemCompraStatusFluxo,
} from "@/modules/suprimentos/domain/types";
import {
  montarDocumentoOC,
  type DadosDocumentoOC,
} from "@/modules/compras/ui/documentoOC";
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

interface FiltroOrdens {
  situacao: string;
  numero: string;
  obraId: string;
  fornecedorId: string;
  dataDe: string;
  dataAte: string;
}

function filtroPadrao(): FiltroOrdens {
  return { situacao: "", numero: "", obraId: "", fornecedorId: "", dataDe: "", dataAte: "" };
}

function OrdensPage() {
  const { companyId, company, loading: companyLoading } = useActiveCompany();
  const [ordens, setOrdens] = useState<OrdemCompra[]>([]);
  const [loading, setLoading] = useState(false);
  // Abrir a tela não consulta ordem nenhuma — só depois de "Buscar" (docs/05 §4).
  const [jaBuscou, setJaBuscou] = useState(false);
  const [rascunho, setRascunho] = useState<FiltroOrdens>(filtroPadrao);
  const [obras, setObras] = useState<{ id: string; nome: string }[]>([]);
  const [fornecedores, setFornecedores] = useState<{ id: string; nome: string }[]>([]);
  const [linkCopiado, setLinkCopiado] = useState<string | null>(null);

  // Só o que alimenta os selects do filtro carrega junto com a tela.
  useEffect(() => {
    if (!companyId) return;
    supabase
      .from("obras")
      .select("id, nome")
      .eq("company_id", companyId)
      .order("nome")
      .then(({ data }) => setObras(data || []));
    supabase
      .from("fornecedores")
      .select("id, nome")
      .eq("company_id", companyId)
      .order("nome")
      .then(({ data }) => setFornecedores(data || []));
  }, [companyId]);

  async function load() {
    if (!companyId) return;
    setLoading(true);
    let query = supabase
      .from("ordens_compra")
      .select("*, obra:obras(nome), fornecedor:fornecedores(nome, cnpj), itens:ordem_compra_itens(*)")
      .eq("company_id", companyId)
      .order("numero", { ascending: false });

    if (rascunho.situacao) query = query.eq("status", rascunho.situacao);
    if (rascunho.numero.trim()) query = query.eq("numero", Number(rascunho.numero.trim()) || -1);
    if (rascunho.obraId) query = query.eq("obra_id", rascunho.obraId);
    if (rascunho.fornecedorId) query = query.eq("fornecedor_id", rascunho.fornecedorId);
    if (rascunho.dataDe) query = query.gte("created_at", rascunho.dataDe);
    if (rascunho.dataAte) query = query.lt("created_at", `${rascunho.dataAte}T23:59:59.999`);

    const { data } = await query;
    setOrdens((data as any) || []);
    setJaBuscou(true);
    setLoading(false);
  }

  function limpar() {
    setRascunho(filtroPadrao());
    setOrdens([]);
    setJaBuscou(false);
  }

  async function mudarStatus(oc: OrdemCompra, status: OrdemCompraStatus) {
    await supabase.from("ordens_compra").update({ status }).eq("id", oc.id);
    load();
  }

  /**
   * Gera (ou reaproveita) o link público e copia para a área de transferência.
   *
   * A rpc é idempotente: clicar de novo devolve o mesmo token, para não
   * invalidar um link que o fornecedor já recebeu.
   */
  async function copiarLinkPublico(oc: OrdemCompra) {
    const { data: token, error } = await supabase.rpc("gerar_link_oc", {
      p_ordem_id: oc.id,
    });
    if (error || !token) {
      alert(error?.message || "Não foi possível gerar o link.");
      return;
    }

    const url = `${window.location.origin}/oc/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopiado(oc.id);
      window.setTimeout(() => setLinkCopiado(null), 2500);
    } catch {
      // clipboard exige contexto seguro (https ou localhost) — sem ele, mostrar
      // a URL é melhor do que falhar em silêncio.
      window.prompt("Copie o link da ordem de compra:", url);
    }
  }

  /**
   * O layout vive em modules/compras/ui/documentoOC — a página pública do
   * fornecedor gera o mesmo documento, e duas cópias divergiriam com o tempo.
   */
  function gerarPdf(oc: OrdemCompra) {
    const win = window.open('', '_blank');
    if (!win) {
      alert('Permita pop-ups neste site para gerar o PDF.');
      return;
    }
    win.document.write(
      montarDocumentoOC(
        {
          ...(oc as unknown as DadosDocumentoOC),
          empresa: {
            nome: company?.name,
            cnpj: company?.cnpj,
            logo_url: company?.logo_url,
          },
        },
        true,
      ),
    );
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

  const filtradas = ordens;
  const total = filtradas.reduce((s, o) => s + Number(o.valor), 0);

  if (companyLoading) return null;

  return (
    <ErpLayout title="Ordem de Compra" breadcrumb="Compras / Ordem de Compra">
      <ComprasSubNav />

      <div className="flex gap-6">
        <PainelFiltros onBuscar={load} onLimpar={limpar} buscando={loading}>
          <CampoFiltro rotulo="Situação">
            <select
              className="field w-full"
              value={rascunho.situacao}
              onChange={(e) => setRascunho({ ...rascunho, situacao: e.target.value })}
            >
              <option value="">Todas</option>
              {(Object.keys(ORDEM_COMPRA_STATUS) as OrdemCompraStatusFluxo[]).map((s) => (
                <option key={s} value={s}>
                  {ORDEM_COMPRA_STATUS[s].label}
                </option>
              ))}
            </select>
          </CampoFiltro>

          <CampoFiltro rotulo="Número">
            <input
              className="field w-full"
              inputMode="numeric"
              placeholder="1"
              value={rascunho.numero}
              onChange={(e) => setRascunho({ ...rascunho, numero: e.target.value })}
            />
          </CampoFiltro>

          <CampoFiltro rotulo="Obra">
            <select
              className="field w-full"
              value={rascunho.obraId}
              onChange={(e) => setRascunho({ ...rascunho, obraId: e.target.value })}
            >
              <option value="">Todas</option>
              {obras.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nome}
                </option>
              ))}
            </select>
          </CampoFiltro>

          <CampoFiltro rotulo="Fornecedor">
            <select
              className="field w-full"
              value={rascunho.fornecedorId}
              onChange={(e) => setRascunho({ ...rascunho, fornecedorId: e.target.value })}
            >
              <option value="">Todos</option>
              {fornecedores.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </select>
          </CampoFiltro>

          <FaixaDeData
            rotulo="Data"
            de={rascunho.dataDe}
            ate={rascunho.dataAte}
            onDe={(v) => setRascunho({ ...rascunho, dataDe: v })}
            onAte={(v) => setRascunho({ ...rascunho, dataAte: v })}
          />
        </PainelFiltros>

        <div className="flex-1 min-w-0">
          {filtradas.length > 0 && (
            <p className="mb-3 text-sm text-muted-foreground">
              {filtradas.length} {filtradas.length === 1 ? "ordem" : "ordens"} · {money(total)}
            </p>
          )}

          <div className="rounded-lg border border-line bg-card p-6 overflow-x-auto">
        {loading ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : filtradas.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {jaBuscou ? SEM_RESULTADO : `Nenhuma ordem de compra. ${SEM_BUSCA}`}
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
                      <button
                        onClick={() => void copiarLinkPublico(oc)}
                        title="Gera um link que o fornecedor abre sem login"
                        className="text-xs text-cta hover:underline"
                      >
                        {linkCopiado === oc.id ? "Link copiado!" : "Copiar link"}
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
        </div>
      </div>
    </ErpLayout>
  );
}
