import { useMemo } from 'react';
import { money } from '@/components/ErpLayout';
import type { Ranking } from '@/modules/compras/domain/types';

export function RankingSummary({ rankings }: { rankings: Ranking[] }) {
  const best = useMemo(() => rankings[0], [rankings]);
  return (
    <div className="rounded-lg border border-line bg-card p-4 mb-6">
      <h3 className="font-bold mb-3">Ranking de Fornecedores</h3>
      {rankings.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum fornecedor com proposta encontrada.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          {rankings.map((rank) => (
            <div key={rank.fornecedorId} className="rounded-lg border border-line bg-side p-3">
              <p className="text-sm font-semibold">Fornecedor {rank.fornecedorId}</p>
              <p className="text-xs text-muted-foreground">Cobertura: {(rank.cobertura * 100).toFixed(0)}%</p>
              <p className="text-sm">Bruto: {money(rank.totalBruto.toNumber())}</p>
              <p className="text-sm">Líquido: {money(rank.totalLiquido.toNumber())}</p>
              <p className="text-sm">Valor presente: {money(rank.totalPresente.toNumber())}</p>
            </div>
          ))}
        </div>
      )}
      {best && (
        <p className="mt-4 text-sm text-cta">Melhor fornecedor: {best.fornecedorId}</p>
      )}
    </div>
  );
}
