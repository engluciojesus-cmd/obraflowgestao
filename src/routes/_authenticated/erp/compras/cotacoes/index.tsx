import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/useAuth";
import { ErpLayout, StatusBadge } from "@/components/ErpLayout";
import { ComprasSubNav } from "@/components/ComprasSubNav";
import {
  PainelFiltros,
  CampoFiltro,
  FaixaDeData,
  ListaVazia,
  SEM_BUSCA,
  SEM_RESULTADO,
} from "@/components/PainelFiltros";
import { COTACAO_STATUS, type CotacaoStatus } from "@/modules/suprimentos/domain/types";
import type { Cotacao } from "@/types";

export const Route = createFileRoute("/_authenticated/erp/compras/cotacoes/")({
  head: () => ({ meta: [{ title: "Cotações — ObraFlow Gestão" }] }),
  component: CotacoesPage,
});

const OPCOES_STATUS = Object.keys(COTACAO_STATUS) as CotacaoStatus[];

interface FiltroCotacoes {
  situacao: string;
  numero: string;
  obraId: string;
  descricao: string;
  dataDe: string;
  dataAte: string;
}

function filtroPadrao(): FiltroCotacoes {
  return { situacao: "", numero: "", obraId: "", descricao: "", dataDe: "", dataAte: "" };
}

function CotacoesPage() {
  const { companyId, loading: companyLoading } = useActiveCompany();
  const [cotacoes, setCotacoes] = useState<Cotacao[]>([]);
  const [obras, setObras] = useState<{ id: string; nome: string }[]>([]);
  const [buscando, setBuscando] = useState(false);
  // null = ainda não buscou. Abrir a tela não consulta nada (docs/05 §4).
  const [jaBuscou, setJaBuscou] = useState(false);
  const [rascunho, setRascunho] = useState<FiltroCotacoes>(filtroPadrao);

  // Só o que alimenta os selects do filtro carrega junto com a tela.
  useEffect(() => {
    if (!companyId) return;
    supabase
      .from("obras")
      .select("id, nome")
      .eq("company_id", companyId)
      .order("nome")
      .then(({ data }) => setObras(data || []));
  }, [companyId]);

  async function buscar() {
    if (!companyId) return;
    setBuscando(true);
    let query = supabase
      .from("cotacoes")
      .select("*, obra:obras(nome), cotacao_itens(id), cotacao_fornecedores(id)")
      .eq("company_id", companyId)
      .order("numero", { ascending: false });

    if (rascunho.situacao) query = query.eq("status", rascunho.situacao);
    if (rascunho.numero.trim()) query = query.eq("numero", Number(rascunho.numero.trim()) || -1);
    if (rascunho.obraId) query = query.eq("obra_id", rascunho.obraId);
    if (rascunho.descricao.trim()) query = query.ilike("descricao", `%${rascunho.descricao.trim()}%`);
    if (rascunho.dataDe) query = query.gte("created_at", rascunho.dataDe);
    // created_at é timestamptz: sem cobrir o dia inteiro, uma cotação das 14h
    // ficaria de fora do próprio dia filtrado.
    if (rascunho.dataAte) query = query.lt("created_at", `${rascunho.dataAte}T23:59:59.999`);

    const { data } = await query;
    setCotacoes((data as any) || []);
    setJaBuscou(true);
    setBuscando(false);
  }

  function limpar() {
    setRascunho(filtroPadrao());
    setCotacoes([]);
    setJaBuscou(false);
  }

  if (companyLoading) return null;

  return (
    <ErpLayout title="Cotação" breadcrumb="Compras / Cotação">
      <ComprasSubNav />

      <div className="flex gap-6">
        <PainelFiltros onBuscar={buscar} onLimpar={limpar} buscando={buscando}>
          <CampoFiltro rotulo="Situação">
            <select
              className="field w-full"
              value={rascunho.situacao}
              onChange={(e) => setRascunho({ ...rascunho, situacao: e.target.value })}
            >
              <option value="">Todas</option>
              {OPCOES_STATUS.map((s) => (
                <option key={s} value={s}>
                  {COTACAO_STATUS[s].label}
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

          <CampoFiltro rotulo="Descrição">
            <input
              className="field w-full"
              placeholder="Contém..."
              value={rascunho.descricao}
              onChange={(e) => setRascunho({ ...rascunho, descricao: e.target.value })}
            />
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
          {buscando ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : cotacoes.length === 0 ? (
            <ListaVazia mensagem={jaBuscou ? SEM_RESULTADO : `Nenhuma cotação. ${SEM_BUSCA}`} />
          ) : (
            <div className="rounded-lg border border-line bg-card p-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground uppercase border-b border-line">
                    <th className="pb-2">Cotação</th>
                    <th className="pb-2">Obra</th>
                    <th className="pb-2">Descrição</th>
                    <th className="pb-2 text-right">Itens</th>
                    <th className="pb-2 text-right">Fornecedores</th>
                    <th className="pb-2">Data</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {cotacoes.map((c: any) => (
                    <tr key={c.id}>
                      <td className="py-3 font-semibold">
                        <Link
                          to="/erp/compras/cotacoes/$cotacaoId"
                          params={{ cotacaoId: c.id }}
                          className="hover:text-cta hover:underline"
                        >
                          COT-{String(c.numero).padStart(3, "0")}
                        </Link>
                      </td>
                      <td className="py-3 text-muted-foreground">{c.obra?.nome || "—"}</td>
                      <td className="py-3 text-muted-foreground">{c.descricao || "—"}</td>
                      <td className="py-3 text-right">{c.cotacao_itens?.length || 0}</td>
                      <td className="py-3 text-right">{c.cotacao_fornecedores?.length || 0}</td>
                      <td className="py-3 text-muted-foreground">
                        {new Date(c.created_at).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="py-3">
                        <StatusBadge status={c.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </ErpLayout>
  );
}

export default CotacoesPage;
