import { Fragment, useMemo, useState } from 'react';
import type { CotacaoItem, CotacaoFornecedor, CotacaoPreco } from '@/types';
import { money } from '@/components/ErpLayout';
import { useColunasRedimensionaveis } from '@/hooks/useColunasRedimensionaveis';
import type {
  CondicaoPagamento,
  CondicoesFornecedorInput,
} from '@/modules/compras/data/cotacoes.repository';
import { rotuloFornecedor } from './SeletorFornecedor';

/** Aceita "1.234,56", "1234,56" e "1234.56" — o comprador digita do jeito dele. */
export function parseNumeroBR(texto: string): number {
  const limpo = texto.replace(/[^\d,.-]/g, '');
  if (!limpo) return 0;
  const normalizado = limpo.includes(',')
    ? limpo.replace(/\./g, '').replace(',', '.')
    : limpo;
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : 0;
}

function formatNumeroBR(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Unitário aceita até 4 casas; dinheiro na tela continua com 2.
 *
 * É o que torna o cálculo pelo total honesto: R$ 100,00 de 3 sacos dá
 * 33,3333/saco. Arredondar o unitário em 2 casas devolveria um total de
 * R$ 99,99 — o comprador digita 100 e vê 99,99, e nunca mais confia no campo.
 */
const CASAS_UNITARIO = 4;

function arredondarUnitario(n: number): number {
  return Number(n.toFixed(CASAS_UNITARIO));
}

function formatUnitarioBR(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: CASAS_UNITARIO });
}

/** Alça de arraste na borda direita do cabeçalho. */
function Alca({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <span
      role="separator"
      aria-orientation="vertical"
      title="Arraste para ajustar a largura"
      onMouseDown={onMouseDown}
      className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize select-none bg-transparent hover:bg-cta/60"
    />
  );
}

/**
 * Célula de valor com rascunho local: o input não é controlado pelo servidor
 * enquanto tem foco, então digitar não é interrompido pelo refetch. Grava no
 * blur e no Enter.
 */
function CelulaValor({
  valor,
  onCommit,
  className = '',
  placeholder,
  alinharDireita = true,
}: {
  valor: number | string | null | undefined;
  onCommit: (texto: string) => void;
  className?: string;
  placeholder?: string;
  alinharDireita?: boolean;
}) {
  const [rascunho, setRascunho] = useState<string | null>(null);
  const exibido =
    rascunho ??
    (valor === null || valor === undefined || valor === '' ? '' : String(valor));

  return (
    <input
      className={`field w-full py-1 text-xs ${alinharDireita ? 'text-right' : ''} ${className}`}
      placeholder={placeholder}
      value={exibido}
      onChange={(e) => setRascunho(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={() => {
        if (rascunho !== null) onCommit(rascunho);
        setRascunho(null);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          setRascunho(null);
          e.currentTarget.blur();
        }
      }}
    />
  );
}

export function MapaCotacaoTabela({
  items,
  fornecedores,
  precos,
  onSalvarPreco,
  onToggleEscolhido,
  onRemoverItem,
  onRemoverFornecedor,
  onSalvarCondicoes,
  onImportarOrcamento,
  condicoesPagamento = [],
}: {
  items: CotacaoItem[];
  fornecedores: CotacaoFornecedor[];
  precos: Map<string, CotacaoPreco>;
  onSalvarPreco: (fornId: string, itemId: string, campo: 'valor_unitario' | 'marca', valor: string) => void;
  onToggleEscolhido: (fornId: string, itemId: string) => void;
  onRemoverItem: (itemId: string) => void;
  onRemoverFornecedor?: (cotacaoFornecedorId: string) => void;
  onSalvarCondicoes?: (cotacaoFornecedorId: string, patch: CondicoesFornecedorInput) => void;
  /** Abre a leitura do PDF/imagem do orçamento deste fornecedor. */
  onImportarOrcamento?: (fornecedor: CotacaoFornecedor) => void;
  /** Cadastro do módulo Segurança (`tipos_pagamento`). */
  condicoesPagamento?: CondicaoPagamento[];
}) {
  const { largura, iniciarArraste, resetar } = useColunasRedimensionaveis(
    { item: 420, qtd: 90, un: 80, unitario: 130, total: 130, acoes: 90 },
    // Chave nova: as larguras salvas do layout anterior deixavam a coluna de
    // insumo colada na de quantidade, que é exatamente o que se está corrigindo.
    'obraflow:mapa-cotacao:colunas:v2',
  );

  const menorPorItem = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const item of items) {
      const valores = fornecedores
        .map((f) => Number(precos.get(`${f.id}|${item.id}`)?.valor_unitario))
        .filter((v) => Number.isFinite(v) && v > 0);
      if (valores.length === 0) continue;
      mapa.set(item.id, Math.min(...valores));
    }
    return mapa;
  }, [items, fornecedores, precos]);

  const totaisFornecedor = useMemo(
    () =>
      fornecedores.map((f) => {
        const subtotal = items.reduce((sum, it) => {
          const p = precos.get(`${f.id}|${it.id}`);
          return sum + Number(p?.valor_unitario || 0) * Number(it.quantidade);
        }, 0);
        const frete = Number(f.frete || 0);
        return { fornecedor: f, subtotal, frete, total: subtotal + frete };
      }),
    [fornecedores, items, precos],
  );

  /** Menor total global entre os fornecedores que têm ao menos um preço. */
  const menorTotalGlobal = useMemo(() => {
    const totais = totaisFornecedor.filter((t) => t.subtotal > 0).map((t) => t.total);
    return totais.length > 0 ? Math.min(...totais) : null;
  }, [totaisFornecedor]);

  if (fornecedores.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-card p-6 text-sm text-muted-foreground">
        Adicione ao menos um fornecedor acima para começar a preencher os valores.
      </div>
    );
  }

  const larguraTotal =
    largura('item') +
    largura('qtd') +
    largura('un') +
    fornecedores.length * (largura('unitario') + largura('total')) +
    largura('acoes');

  return (
    <div className="rounded-lg border border-line bg-card">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <p className="text-xs text-muted-foreground">
          Arraste a borda direita de qualquer cabeçalho para alargar a coluna.
        </p>
        <button type="button" onClick={resetar} className="text-xs text-cta hover:underline">
          Redefinir larguras
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="text-sm" style={{ tableLayout: 'fixed', width: larguraTotal }}>
          <colgroup>
            <col style={{ width: largura('item') }} />
            <col style={{ width: largura('qtd') }} />
            <col style={{ width: largura('un') }} />
            {fornecedores.map((f) => (
              <Fragment key={`col-${f.id}`}>
                <col style={{ width: largura('unitario') }} />
                <col style={{ width: largura('total') }} />
              </Fragment>
            ))}
            <col style={{ width: largura('acoes') }} />
          </colgroup>

          <thead>
            {/* Faixa do fornecedor: nome, condições comerciais e total */}
            <tr className="border-b border-line bg-side/40">
              <th colSpan={3} className="border-r border-line px-3 py-2 text-left align-bottom text-xs uppercase text-muted-foreground">
                Fornecedores
              </th>
              {fornecedores.map((f) => {
                const t = totaisFornecedor.find((x) => x.fornecedor.id === f.id)!;
                const ehMelhor = menorTotalGlobal !== null && t.total === menorTotalGlobal && t.subtotal > 0;
                return (
                  <th
                    key={`cab-${f.id}`}
                    colSpan={2}
                    className={`border-l border-line px-2 py-2 text-left align-top ${ehMelhor ? 'bg-ok/10' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold leading-tight">
                        {f.fornecedor ? rotuloFornecedor(f.fornecedor) : '—'}
                      </span>
                      {onRemoverFornecedor && (
                        <button
                          type="button"
                          title="Remover fornecedor da cotação"
                          className="shrink-0 text-xs text-err hover:underline"
                          onClick={() => onRemoverFornecedor(f.id)}
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {onSalvarCondicoes && (
                      <div className="mt-2 space-y-1 font-normal">
                        {/* Condição de pagamento vem do cadastro (Segurança →
                            Tipos de pagamento). Era texto livre, e cada
                            comprador escrevia "Boleto 30" de um jeito. */}
                        <select
                          className="field w-full py-1 text-xs"
                          value={f.condicao_pagamento ?? ''}
                          onChange={(e) =>
                            onSalvarCondicoes(f.id, { condicao_pagamento: e.target.value || null })
                          }
                        >
                          <option value="">Condição de pgto...</option>
                          {condicoesPagamento.map((c) => (
                            <option key={c.id} value={c.nome}>
                              {c.nome}
                            </option>
                          ))}
                          {/* Valor gravado antes do cadastro existir não some da tela. */}
                          {f.condicao_pagamento &&
                            !condicoesPagamento.some((c) => c.nome === f.condicao_pagamento) && (
                              <option value={f.condicao_pagamento}>{f.condicao_pagamento} (fora do cadastro)</option>
                            )}
                        </select>
                        {condicoesPagamento.length === 0 && (
                          <p className="text-[10px] leading-tight text-muted-foreground">
                            Nenhuma condição cadastrada — cadastre em Segurança › Tipos de pagamento.
                          </p>
                        )}

                        {onImportarOrcamento && (
                          <button
                            type="button"
                            title="Ler o PDF ou a foto do orçamento deste fornecedor e preencher a coluna"
                            className="w-full rounded-lg bg-side px-2 py-1 text-[11px] font-semibold hover:bg-side/80"
                            onClick={() => onImportarOrcamento(f)}
                          >
                            Importar orçamento
                          </button>
                        )}
                        {/* "Pgto (dias)" e "Entrega (dias)" saíram daqui: com a
                            condição vindo do cadastro, digitar o prazo de novo
                            era retrabalho e abria espaço para divergir dela.
                            As colunas continuam no banco (o ranking a valor
                            presente e a previsão de entrega da OC leem delas). */}
                      </div>
                    )}

                    <p className={`mt-2 text-right text-sm font-bold ${ehMelhor ? 'text-ok' : ''}`}>
                      {money(t.total)}
                      {ehMelhor && <span className="ml-1 text-[10px] uppercase">menor total</span>}
                    </p>
                  </th>
                );
              })}
              <th className="border-l border-line px-2 py-2" />
            </tr>

            {/* Cabeçalho das colunas, com alça de redimensionamento */}
            <tr className="border-b border-line text-xs uppercase text-muted-foreground">
              {/* A descrição fica isolada por uma borda: colada na quantidade,
                  o operador lia o número como parte do nome do insumo. */}
              <th className="relative border-r border-line px-3 py-2 text-left">
                Insumo
                <Alca onMouseDown={(e) => iniciarArraste('item', e)} />
              </th>
              <th className="relative px-2 py-2 text-right">
                Qtd
                <Alca onMouseDown={(e) => iniciarArraste('qtd', e)} />
              </th>
              <th className="relative border-r border-line px-2 py-2 text-left">
                Un.
                <Alca onMouseDown={(e) => iniciarArraste('un', e)} />
              </th>
              {fornecedores.map((f) => (
                <Fragment key={`h-${f.id}`}>
                  <th className="relative border-l border-line px-2 py-2 text-right">
                    Unitário (R$)
                    <Alca onMouseDown={(e) => iniciarArraste('unitario', e)} />
                  </th>
                  <th className="relative px-2 py-2 text-right">
                    Total (R$)
                    <Alca onMouseDown={(e) => iniciarArraste('total', e)} />
                  </th>
                </Fragment>
              ))}
              <th className="relative border-l border-line px-2 py-2 text-right">
                Ações
                <Alca onMouseDown={(e) => iniciarArraste('acoes', e)} />
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-line">
            {items.map((it) => {
              const quantidade = Number(it.quantidade) || 0;
              return (
              <tr key={it.id} className="align-top">
                <td className="border-r border-line px-3 py-2">
                  <span className="block whitespace-normal break-words" title={it.descricao}>
                    {it.descricao}
                  </span>
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{quantidade}</td>
                <td className="border-r border-line px-2 py-2 text-muted-foreground">{it.unidade || 'un'}</td>

                {fornecedores.map((f) => {
                  const chave = `${f.id}|${it.id}`;
                  const p = precos.get(chave);
                  const unitario = Number(p?.valor_unitario || 0);
                  const menor = menorPorItem.get(it.id);
                  const ehMenor = unitario > 0 && menor !== undefined && unitario === menor;
                  return (
                    <Fragment key={chave}>
                      <td className={`border-l border-line px-2 py-2 ${ehMenor ? 'bg-ok/10' : ''}`}>
                        <div className="flex items-center gap-1">
                          <input
                            type="checkbox"
                            title="Escolher este fornecedor para este item"
                            checked={Boolean(p?.escolhido)}
                            onChange={() => onToggleEscolhido(f.id, it.id)}
                          />
                          <CelulaValor
                            placeholder="0,00"
                            valor={unitario > 0 ? formatUnitarioBR(unitario) : ''}
                            onCommit={(txt) =>
                              onSalvarPreco(
                                f.id,
                                it.id,
                                'valor_unitario',
                                String(arredondarUnitario(parseNumeroBR(txt))),
                              )
                            }
                          />
                        </div>
                        <CelulaValor
                          alinharDireita={false}
                          className="mt-1"
                          placeholder="Marca"
                          valor={p?.marca ?? ''}
                          onCommit={(txt) => onSalvarPreco(f.id, it.id, 'marca', txt)}
                        />
                      </td>
                      {/* ⭐ Total é editável e recalcula o unitário: o fornecedor
                          costuma mandar o preço fechado do lote, e obrigar o
                          comprador a dividir de cabeça é onde nasce o erro de
                          digitação. Total = unitário × qtd; unitário = total / qtd. */}
                      <td className={`px-2 py-2 ${ehMenor ? 'bg-ok/10 font-semibold' : ''}`}>
                        {quantidade > 0 ? (
                          <CelulaValor
                            placeholder="0,00"
                            valor={unitario > 0 ? formatNumeroBR(unitario * quantidade) : ''}
                            onCommit={(txt) => {
                              const total = parseNumeroBR(txt);
                              onSalvarPreco(
                                f.id,
                                it.id,
                                'valor_unitario',
                                String(arredondarUnitario(total / quantidade)),
                              );
                            }}
                          />
                        ) : (
                          <span className="block text-right tabular-nums">—</span>
                        )}
                      </td>
                    </Fragment>
                  );
                })}

                <td className="border-l border-line px-2 py-2 text-right">
                  <button type="button" className="text-xs text-err hover:underline" onClick={() => onRemoverItem(it.id)}>
                    Remover
                  </button>
                </td>
              </tr>
              );
            })}
          </tbody>

          <tfoot>
            <tr className="border-t border-line bg-side/20">
              <td colSpan={3} className="border-r border-line px-3 py-2 font-semibold">
                Subtotal
              </td>
              {totaisFornecedor.map((t) => (
                <Fragment key={`sub-${t.fornecedor.id}`}>
                  <td className="border-l border-line px-2 py-2" />
                  <td className="px-2 py-2 text-right tabular-nums">{money(t.subtotal)}</td>
                </Fragment>
              ))}
              <td className="border-l border-line px-2 py-2" />
            </tr>
            <tr className="bg-side/20">
              <td colSpan={3} className="border-r border-line px-3 py-2 font-semibold">
                Frete
              </td>
              {totaisFornecedor.map((t) => (
                <Fragment key={`fre-${t.fornecedor.id}`}>
                  <td className="border-l border-line px-2 py-2" />
                  <td className="px-2 py-2">
                    {onSalvarCondicoes ? (
                      <CelulaValor
                        placeholder="0,00"
                        valor={t.frete > 0 ? formatNumeroBR(t.frete) : ''}
                        onCommit={(txt) => onSalvarCondicoes(t.fornecedor.id, { frete: parseNumeroBR(txt) })}
                      />
                    ) : (
                      <span className="block text-right tabular-nums">{money(t.frete)}</span>
                    )}
                  </td>
                </Fragment>
              ))}
              <td className="border-l border-line px-2 py-2" />
            </tr>
            <tr className="border-t border-line bg-side/40">
              <td colSpan={3} className="border-r border-line px-3 py-2 font-semibold">
                TOTAL
              </td>
              {totaisFornecedor.map((t) => {
                const ehMelhor = menorTotalGlobal !== null && t.total === menorTotalGlobal && t.subtotal > 0;
                return (
                  <Fragment key={`tot-${t.fornecedor.id}`}>
                    <td className="border-l border-line px-2 py-2" />
                    <td className={`px-2 py-2 text-right font-bold tabular-nums ${ehMelhor ? 'text-ok' : ''}`}>
                      {money(t.total)}
                    </td>
                  </Fragment>
                );
              })}
              <td className="border-l border-line px-2 py-2" />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export default MapaCotacaoTabela;
