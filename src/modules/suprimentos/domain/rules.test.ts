import { describe, it, expect } from 'vitest';
import { dec } from '@/core/money';
import {
  podeTransicionar,
  statusRequisicaoDerivado,
  saldoItem,
  percentualRecebido,
  statusPendentesPorTela,
  sugestaoMenorUnitario,
  sugestaoMenorGlobal,
} from './rules';

describe('podeTransicionar', () => {
  it('rejeita qualquer transição a partir de RECEBIDA (terminal)', () => {
    expect(podeTransicionar('RECEBIDA', 'ABERTA')).toBe(false);
    expect(podeTransicionar('RECEBIDA', 'CANCELADA')).toBe(false);
    expect(podeTransicionar('RECEBIDA', 'EM_OC')).toBe(false);
  });

  it('permite devolução EM_COTACAO → ABERTA (cotação cancelada devolve o item)', () => {
    expect(podeTransicionar('EM_COTACAO', 'ABERTA')).toBe(true);
  });

  it('rejeita transição não prevista na máquina de estado', () => {
    expect(podeTransicionar('ABERTA', 'RECEBIDA')).toBe(false);
    expect(podeTransicionar('RASCUNHO', 'EM_OC')).toBe(false);
  });

  it('permite ficar no mesmo status (no-op)', () => {
    expect(podeTransicionar('ABERTA', 'ABERTA')).toBe(true);
  });
});

describe('statusRequisicaoDerivado', () => {
  it('3 itens (1 aberta, 1 em OC, 1 recebida) = PARCIAL', () => {
    const status = statusRequisicaoDerivado([
      { status: 'ABERTA' },
      { status: 'EM_OC' },
      { status: 'RECEBIDA' },
    ]);
    expect(status).toBe('PARCIAL');
  });

  it('todos ABERTA = ABERTA', () => {
    const status = statusRequisicaoDerivado([{ status: 'ABERTA' }, { status: 'ABERTA' }]);
    expect(status).toBe('ABERTA');
  });

  it('todos RECEBIDA = ATENDIDA', () => {
    const status = statusRequisicaoDerivado([{ status: 'RECEBIDA' }, { status: 'RECEBIDA' }]);
    expect(status).toBe('ATENDIDA');
  });

  it('todos CANCELADA/REJEITADA = CANCELADA', () => {
    const status = statusRequisicaoDerivado([{ status: 'CANCELADA' }, { status: 'REJEITADA' }]);
    expect(status).toBe('CANCELADA');
  });

  it('sem itens = RASCUNHO', () => {
    expect(statusRequisicaoDerivado([])).toBe('RASCUNHO');
  });
});

describe('recebimento parcial', () => {
  it('60 de 100 → 60%, saldo 40', () => {
    const pedido = dec(100);
    const recebido = dec(60);
    expect(saldoItem(pedido, recebido).toNumber()).toBe(40);
    expect(percentualRecebido([{ quantidade: pedido, quantidadeRecebida: recebido }])).toBe(60);
  });

  it('saldoItem nunca fica negativo (banco tolera até 105%)', () => {
    expect(saldoItem(dec(100), dec(105)).toNumber()).toBe(0);
  });

  it('percentualRecebido de conjunto vazio é 0, não NaN', () => {
    expect(percentualRecebido([])).toBe(0);
  });
});

describe('statusPendentesPorTela', () => {
  it('requisição: só Aberta e Parcial por padrão', () => {
    expect(statusPendentesPorTela('requisicao')).toEqual(['ABERTA', 'PARCIAL']);
  });

  it('ordem de compra: 6 status ativos por padrão, sem os terminais', () => {
    const pendentes = statusPendentesPorTela('ordem_compra');
    expect(pendentes).toContain('PARCIALMENTE_RECEBIDA');
    expect(pendentes).not.toContain('RECEBIDA');
    expect(pendentes).not.toContain('CANCELADA');
  });
});

describe('mapa de cotação — sugestões', () => {
  it('menor unitário e menor global divergem quando o frete pesa', () => {
    const itens = [
      { id: 'i1', quantidade: dec(10) },
      { id: 'i2', quantidade: dec(10) },
    ];
    // Fornecedor A: mais barato por item, mas cobra frete de entrega separada.
    // Fornecedor B: um pouco mais caro por item, sem frete.
    const propostas = [
      { fornecedorId: 'A', itemId: 'i1', valorUnitario: dec(10), disponivel: true },
      { fornecedorId: 'A', itemId: 'i2', valorUnitario: dec(10), disponivel: true },
      { fornecedorId: 'B', itemId: 'i1', valorUnitario: dec(10.5), disponivel: true },
      { fornecedorId: 'B', itemId: 'i2', valorUnitario: dec(10.5), disponivel: true },
    ];
    const condicoes = [
      { fornecedorId: 'A', frete: dec(50), descontoGlobalPct: dec(0) },
      { fornecedorId: 'B', frete: dec(0), descontoGlobalPct: dec(0) },
    ];

    // menor unitário: A ganha em todo item (10 < 10.5), sempre
    const unitario = sugestaoMenorUnitario(itens, propostas as any);
    expect(unitario.get('i1')).toBe('A');
    expect(unitario.get('i2')).toBe('A');

    // menor global: A = 10*10 + 10*10 + 50 = 250; B = 10.5*10 + 10.5*10 = 210 → B vence
    const global = sugestaoMenorGlobal(itens as any, propostas as any, condicoes as any);
    expect(global).toBe('B');
    expect(global).not.toBe(unitario.get('i1'));
  });

  it('menor global ignora fornecedor que não cobre todos os itens', () => {
    const itens = [
      { id: 'i1', quantidade: dec(1) },
      { id: 'i2', quantidade: dec(1) },
    ];
    const propostas = [
      // C é baratíssimo, mas só cobre i1 — não pode ser "um fornecedor só"
      { fornecedorId: 'C', itemId: 'i1', valorUnitario: dec(1), disponivel: true },
      { fornecedorId: 'D', itemId: 'i1', valorUnitario: dec(20), disponivel: true },
      { fornecedorId: 'D', itemId: 'i2', valorUnitario: dec(20), disponivel: true },
    ];
    const condicoes = [
      { fornecedorId: 'C', frete: dec(0), descontoGlobalPct: dec(0) },
      { fornecedorId: 'D', frete: dec(0), descontoGlobalPct: dec(0) },
    ];

    const global = sugestaoMenorGlobal(itens as any, propostas as any, condicoes as any);
    expect(global).toBe('D');
  });
});
