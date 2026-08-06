import React from 'react';
import type { CotacaoFornecedor, CotacaoItem, CotacaoPreco } from '@/types';
import { money } from '@/components/ErpLayout';

export function ModalGerarOC({ grupos, onClose, onGerado }: { grupos: { fornecedor: CotacaoFornecedor; linhas: { item: CotacaoItem; preco: CotacaoPreco }[]; total: number; }[]; onClose: () => void; onGerado: (ids: string[]) => void; }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-lg border border-line bg-card p-6">
        <h3 className="text-lg font-bold">Gerar Ordem de Compra</h3>
        <div className="space-y-3 mt-3">
          {grupos.map((g) => (
            <div key={g.fornecedor.id} className="rounded-lg border p-3 bg-side/40">
              <div className="flex justify-between"><span className="font-semibold">{g.fornecedor.fornecedor?.nome}</span><span>{money(g.total)}</span></div>
              <p className="text-xs text-muted-foreground">{g.linhas.length} itens</p>
            </div>
          ))}
        </div>
        <div className="flex gap-3 mt-4">
          <button onClick={() => onGerado([])} className="btn-cta">Gerar</button>
          <button onClick={onClose} className="rounded-lg bg-side px-4 py-2.5">Cancelar</button>
        </div>
      </div>
    </div>
  );
}

export default ModalGerarOC;
