import React from 'react';
import type { CotacaoItem, CotacaoFornecedor, CotacaoPreco } from '@/types';

export function MapaCotacaoTabela({
  items,
  fornecedores,
  precos,
  onSalvarPreco,
  onAlternarEscolha,
}: {
  items: CotacaoItem[];
  fornecedores: CotacaoFornecedor[];
  precos: Map<string, CotacaoPreco>;
  onSalvarPreco: (fornId: string, itemId: string, campo: 'valor_unitario' | 'marca', valor: string) => void;
  onAlternarEscolha: (fornId: string, itemId: string) => void;
}) {
  return (
    <div className="rounded-lg border border-line bg-card overflow-x-auto">
      <table className="text-sm min-w-full">
        <thead>
          <tr className="border-b border-line">
            <th className="px-3 py-2 text-left">Item</th>
            <th className="px-2 py-2 text-right">Qtd</th>
            <th className="px-2 py-2">Un</th>
            {fornecedores.map((f) => (
              <th key={f.id} className="px-3 py-2 text-center border-l border-line">
                {f.fornecedor?.nome}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {items.map((it) => (
            <tr key={it.id}>
              <td className="px-3 py-2">{it.descricao}</td>
              <td className="px-2 py-2 text-right">{it.quantidade}</td>
              <td className="px-2 py-2">{it.unidade || 'un'}</td>
              {fornecedores.map((f) => {
                const chave = `${f.id}|${it.id}`;
                const p = precos.get(chave);
                return (
                  <td key={chave} className="px-2 py-2 text-right border-l border-line">
                    <input
                      type="number"
                      step="0.01"
                      className="field text-right text-xs py-1"
                      value={p?.valor_unitario ?? ''}
                      onChange={(e) => onSalvarPreco(f.id, it.id, 'valor_unitario', e.target.value)}
                    />
                    <div className="text-xs mt-1">{p?.marca || '—'}</div>
                    <button className="text-xs text-cta mt-1" onClick={() => onAlternarEscolha(f.id, it.id)}>
                      Escolher
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default MapaCotacaoTabela;
