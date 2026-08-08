import { useState } from 'react';
import { money } from '@/components/ErpLayout';
import { cotacoesRepository, type OrcamentoExtraido } from '@/modules/compras/data/cotacoes.repository';
import type { CotacaoItem } from '@/types';

interface LinhaRevisao {
  chave: string;
  cotacaoItemId: string | null;
  descricaoDocumento: string;
  marca: string | null;
  valorUnitario: number | null;
  confianca: 'alta' | 'media' | 'baixa';
  aplicar: boolean;
}

const ROTULO_CONFIANCA: Record<LinhaRevisao['confianca'], { texto: string; cor: string }> = {
  alta: { texto: 'Alta', cor: 'text-ok' },
  media: { texto: 'Média', cor: 'text-cta' },
  baixa: { texto: 'Baixa', cor: 'text-err' },
};

/**
 * Importa o orçamento que o fornecedor mandou em PDF ou foto e preenche a
 * coluna dele no mapa.
 *
 * A IA propõe, o usuário confirma. Nada é gravado direto: cada linha vem com
 * o item que a IA acha que corresponde, o nível de confiança e uma caixa de
 * seleção. Linha que a IA não conseguiu casar chega desmarcada, com um select
 * para o comprador apontar o item certo — errar aqui grava preço no insumo
 * errado, e isso vira ordem de compra.
 */
export function ModalImportarOrcamento({
  itens,
  nomeFornecedor,
  onClose,
  onAplicar,
}: {
  itens: CotacaoItem[];
  nomeFornecedor: string;
  onClose: () => void;
  /** Recebe os pares (item, unitário) confirmados e as condições comerciais. */
  onAplicar: (
    precos: { cotacaoItemId: string; valorUnitario: number; marca: string | null }[],
    condicoes: { condicaoPagamento: string | null; frete: number | null },
  ) => Promise<void> | void;
}) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [lendo, setLendo] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [extracao, setExtracao] = useState<OrcamentoExtraido | null>(null);
  const [linhas, setLinhas] = useState<LinhaRevisao[]>([]);

  const itemPorId = new Map(itens.map((i) => [i.id, i]));

  async function ler() {
    if (!arquivo) return;
    setErro(null);
    setLendo(true);
    try {
      const resultado = await cotacoesRepository.extrairOrcamento({
        arquivo,
        itens: itens.map((i) => ({
          id: i.id,
          descricao: i.descricao,
          unidade: i.unidade || 'un',
          quantidade: Number(i.quantidade) || 0,
        })),
      });

      setExtracao(resultado);
      setLinhas(
        resultado.linhas.map((l, i) => {
          const item = l.cotacao_item_id ? itemPorId.get(l.cotacao_item_id) : undefined;
          const qtd = Number(item?.quantidade) || 0;
          // Documento que só traz o total da linha: o unitário sai da divisão,
          // mesma regra do cálculo bidirecional do mapa.
          const unitario =
            l.valor_unitario ?? (l.valor_total !== null && qtd > 0 ? l.valor_total / qtd : null);

          return {
            chave: `linha-${i}`,
            cotacaoItemId: l.cotacao_item_id,
            descricaoDocumento: l.descricao_documento,
            marca: l.marca,
            valorUnitario: unitario === null ? null : Number(unitario.toFixed(4)),
            confianca: l.confianca,
            // Só entra marcada o que a IA casou com confiança alta ou média e
            // com preço legível. O resto o comprador revisa de olho.
            aplicar: Boolean(l.cotacao_item_id) && unitario !== null && l.confianca !== 'baixa',
          };
        }),
      );
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao ler o orçamento.');
    } finally {
      setLendo(false);
    }
  }

  function setLinha(chave: string, patch: Partial<LinhaRevisao>) {
    setLinhas((prev) => prev.map((l) => (l.chave === chave ? { ...l, ...patch } : l)));
  }

  const selecionadas = linhas.filter((l) => l.aplicar && l.cotacaoItemId && l.valorUnitario !== null);

  async function aplicar() {
    setErro(null);
    setAplicando(true);
    try {
      await onAplicar(
        selecionadas.map((l) => ({
          cotacaoItemId: l.cotacaoItemId!,
          valorUnitario: l.valorUnitario!,
          marca: l.marca,
        })),
        {
          condicaoPagamento: extracao?.condicao_pagamento ?? null,
          frete: extracao?.frete ?? null,
        },
      );
      onClose();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao aplicar os preços.');
    } finally {
      setAplicando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-lg border border-line bg-card p-6">
        <h3 className="mb-1 text-lg font-bold">Importar orçamento — {nomeFornecedor}</h3>
        <p className="mb-4 text-xs text-muted-foreground">
          Envie o PDF ou a foto do orçamento. A leitura é uma proposta: confira as linhas antes de aplicar.
        </p>

        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-side/30 p-3">
          <input
            type="file"
            accept="application/pdf,image/png,image/jpeg,image/webp"
            className="text-sm"
            onChange={(e) => {
              setArquivo(e.target.files?.[0] ?? null);
              setExtracao(null);
              setLinhas([]);
              setErro(null);
            }}
          />
          <button
            type="button"
            className="btn-cta disabled:opacity-50"
            disabled={!arquivo || lendo}
            onClick={() => void ler()}
          >
            {lendo ? 'Lendo o documento...' : 'Ler orçamento'}
          </button>
        </div>

        {erro && <p className="mb-4 rounded-lg border border-err/40 bg-err/10 px-4 py-2 text-sm text-err">{erro}</p>}

        {extracao && (
          <>
            <div className="mb-3 grid gap-2 text-xs md:grid-cols-4">
              <Campo rotulo="Fornecedor no documento" valor={extracao.fornecedor || '—'} />
              <Campo rotulo="Condição de pgto." valor={extracao.condicao_pagamento || '—'} />
              <Campo rotulo="Frete" valor={extracao.frete !== null ? money(extracao.frete) : '—'} />
              <Campo rotulo="Validade" valor={extracao.validade || '—'} />
            </div>

            {linhas.length === 0 ? (
              <p className="rounded-lg border border-line bg-side/30 px-3 py-4 text-sm text-muted-foreground">
                Nenhuma linha de preço foi encontrada neste documento.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-line">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line bg-side/40 text-left text-[10px] uppercase text-muted-foreground">
                      <th className="px-2 py-2 w-8" />
                      <th className="px-2 py-2">No documento</th>
                      <th className="px-2 py-2">Item da cotação</th>
                      <th className="px-2 py-2 text-right">Unitário</th>
                      <th className="px-2 py-2">Confiança</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {linhas.map((l) => (
                      <tr key={l.chave} className={l.cotacaoItemId ? '' : 'bg-err/5'}>
                        <td className="px-2 py-2">
                          <input
                            type="checkbox"
                            checked={l.aplicar}
                            disabled={!l.cotacaoItemId || l.valorUnitario === null}
                            onChange={(e) => setLinha(l.chave, { aplicar: e.target.checked })}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <span className="block">{l.descricaoDocumento}</span>
                          {l.marca && <span className="block text-xs text-muted-foreground">{l.marca}</span>}
                        </td>
                        <td className="px-2 py-2">
                          <select
                            className="field w-full py-1 text-xs"
                            value={l.cotacaoItemId ?? ''}
                            onChange={(e) =>
                              setLinha(l.chave, {
                                cotacaoItemId: e.target.value || null,
                                aplicar: Boolean(e.target.value) && l.valorUnitario !== null,
                              })
                            }
                          >
                            <option value="">Não aplicar</option>
                            {itens.map((i) => (
                              <option key={i.id} value={i.id}>
                                {i.descricao}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-2">
                          <input
                            className="field w-24 py-1 text-right text-xs"
                            inputMode="decimal"
                            value={l.valorUnitario ?? ''}
                            placeholder="—"
                            onChange={(e) => {
                              const n = Number(e.target.value.replace(',', '.'));
                              const valido = e.target.value.trim() !== '' && Number.isFinite(n);
                              setLinha(l.chave, {
                                valorUnitario: valido ? n : null,
                                aplicar: valido && Boolean(l.cotacaoItemId) ? l.aplicar : false,
                              });
                            }}
                          />
                        </td>
                        <td className={`px-2 py-2 text-xs ${ROTULO_CONFIANCA[l.confianca].cor}`}>
                          {l.cotacaoItemId ? ROTULO_CONFIANCA[l.confianca].texto : 'Sem item'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            className="btn-cta disabled:opacity-50"
            disabled={selecionadas.length === 0 || aplicando}
            onClick={() => void aplicar()}
          >
            {aplicando
              ? 'Aplicando...'
              : `Aplicar ${selecionadas.length} ${selecionadas.length === 1 ? 'preço' : 'preços'}`}
          </button>
          <button
            type="button"
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

function Campo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-lg border border-line bg-side/30 px-3 py-2">
      <p className="text-[10px] uppercase text-muted-foreground">{rotulo}</p>
      <p className="mt-0.5 font-semibold">{valor}</p>
    </div>
  );
}

export default ModalImportarOrcamento;
