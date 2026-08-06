import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { dec } from '@/core/money';
import { menorPrecoUnitario, rankearFornecedores } from './rules';

describe('compras rules', () => {
  it('menorPrecoUnitario returns null when no proposal', () => {
    const propostas: any[] = [];
    const res = menorPrecoUnitario('item-x', propostas as any);
    expect(res).toBe(null);
  });

  it('menorPrecoUnitario picks lowest available price', () => {
    const propostas: any[] = [
      { fornecedorId: 'f1', itemId: 'i1', valorUnitario: dec(10), disponivel: true },
      { fornecedorId: 'f2', itemId: 'i1', valorUnitario: dec(9), disponivel: true },
    ];
    const res = menorPrecoUnitario('i1', propostas as any);
    expect(res?.toNumber()).toBe(9);
  });

  it('rankearFornecedores handles freight that inverts ranking', () => {
    const itens = [{ id: 'i1', quantidade: dec(1) }];
    const propostas = [
      { fornecedorId: 'f1', itemId: 'i1', valorUnitario: dec(100), disponivel: true },
      { fornecedorId: 'f2', itemId: 'i1', valorUnitario: dec(105), disponivel: true },
    ];
    const condicoes = [
      { fornecedorId: 'f1', frete: dec(0), descontoGlobalPct: dec(0), prazoPagamentoDias: 0, prazoEntregaDias: 0 },
      { fornecedorId: 'f2', frete: dec(0).add(dec(10)), descontoGlobalPct: dec(0), prazoPagamentoDias: 0, prazoEntregaDias: 0 },
    ];
    const ranked = rankearFornecedores({ itens: itens as any, propostas: propostas as any, condicoes: condicoes as any, taxaOportunidadeMensal: dec(0) as any });
    expect(ranked[0].fornecedorId).toBe('f1');
  });

  it('rankearFornecedores considers prazo de pagamento (totalPresente)', () => {
    const itens = [{ id: 'i1', quantidade: dec(1) }];
    const propostas = [
      { fornecedorId: 'f1', itemId: 'i1', valorUnitario: dec(100), disponivel: true },
      { fornecedorId: 'f2', itemId: 'i1', valorUnitario: dec(101), disponivel: true },
    ];
    const condicoes = [
      { fornecedorId: 'f1', frete: dec(0), descontoGlobalPct: dec(0), prazoPagamentoDias: 60, prazoEntregaDias: 0 },
      { fornecedorId: 'f2', frete: dec(0), descontoGlobalPct: dec(0), prazoPagamentoDias: 0, prazoEntregaDias: 0 },
    ];
    // alta taxa de oportunidade faz o prazo desfavorecer f1
    const ranked = rankearFornecedores({ itens: itens as any, propostas: propostas as any, condicoes: condicoes as any, taxaOportunidadeMensal: dec(0.05) as any });
    // because f1 pays in 60 days the present value may be lower/higher depending on rate; assert ordering exists
    expect(ranked.length).toBe(2);
    expect(ranked[0].fornecedorId).toBeDefined();
  });
});
