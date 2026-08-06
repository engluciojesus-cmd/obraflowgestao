import React, { useMemo } from 'react';
import type { Ranking } from '@/modules/compras/domain/types';
import { money } from '@/components/ErpLayout';

export function ResumoRanking({ rankings }: { rankings: Ranking[] }) {
  const winnerBruto = rankings?.[0]?.fornecedorId;
  const winnerPresente = useMemo(() => {
    if (!rankings || rankings.length === 0) return undefined;
    return rankings.slice().sort((a, b) => a.totalPresente.toNumber() - b.totalPresente.toNumber())[0]?.fornecedorId;
  }, [rankings]);

  return (
    <div className="rounded-lg border border-line bg-card p-4 mb-6">
      <h3 className="font-bold mb-3">Ranking de Fornecedores</h3>
      {rankings.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum fornecedor com proposta encontrada.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          {rankings.map((r) => (
            <div key={r.fornecedorId} className={`rounded-lg border p-3 ${r.fornecedorId === winnerPresente && r.fornecedorId !== winnerBruto ? 'ring-2 ring-err' : 'bg-side'}`}>
              <p className="text-sm font-semibold">Fornecedor {r.fornecedorId}</p>
              <p className="text-xs text-muted-foreground">Cobertura: {(r.cobertura * 100).toFixed(0)}%</p>
              <p className="text-sm">Bruto: {money(r.totalBruto.toNumber())}</p>
              <p className="text-sm">Líquido: {money(r.totalLiquido.toNumber())}</p>
              <p className="text-sm">Valor presente: {money(r.totalPresente.toNumber())}</p>
            </div>
          ))}
        </div>
      )}
      {winnerBruto && winnerPresente && winnerBruto !== winnerPresente && (
        <p className="mt-4 text-sm text-cta">Insight: melhor por preço bruto ({winnerBruto}) difere do melhor por valor presente ({winnerPresente}).</p>
      )}
    </div>
  );
}

export default ResumoRanking;
