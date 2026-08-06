// ⛔ PROIBIDO NESTE ARQUIVO: react, @supabase/*, @tanstack/*
// Só entra dado, só sai dado. Testável sem browser e sem banco.

import Decimal from 'decimal.js';
import { dec, add, mul, div, isZero } from '@/core/money';
import type { PropostaItem, CondicaoFornecedor, ItemPedido, Ranking } from './types';

function prazoEmMeses(dias: number) {
  return new Decimal(dias).div(30);
}

export function menorPrecoUnitario(itemId: string, propostas: PropostaItem[]): Decimal | null {
  let menor: Decimal | null = null;
  for (const p of propostas) {
    if (p.itemId !== itemId) continue;
    if (!p.disponivel) continue;
    const v = new Decimal(p.valorUnitario);
    if (v.lte(0)) continue;
    if (menor === null || v.lt(menor)) menor = v;
  }
  return menor;
}

export function rankearFornecedores(params: {
  itens: ItemPedido[];
  propostas: PropostaItem[];
  condicoes: CondicaoFornecedor[];
  taxaOportunidadeMensal: Decimal;
}): Ranking[] {
  const { itens, propostas, condicoes, taxaOportunidadeMensal } = params;

  const fornecedores = new Map<string, { totalBruto: Decimal; itensAtendidos: number }>();
  const itensTotais = itens.length;

  for (const c of condicoes) {
    fornecedores.set(c.fornecedorId, { totalBruto: new Decimal(0), itensAtendidos: 0 });
  }

  for (const it of itens) {
    const propostasDoItem = propostas.filter((p) => p.itemId === it.id && p.disponivel);
    for (const cond of condicoes) {
      const fornecedorId = cond.fornecedorId;
      const candidato = propostasDoItem.find((p) => p.fornecedorId === fornecedorId);
      if (!candidato) continue;
      const linha = fornecedores.get(fornecedorId);
      if (!linha) continue;
      const valor = new Decimal(candidato.valorUnitario).mul(it.quantidade);
      linha.totalBruto = linha.totalBruto.add(valor);
      linha.itensAtendidos += 1;
    }
  }

  const result: Ranking[] = [];
  for (const cond of condicoes) {
    const f = fornecedores.get(cond.fornecedorId) || { totalBruto: new Decimal(0), itensAtendidos: 0 };
    const frete = new Decimal(cond.frete || 0);
    const desconto = new Decimal(cond.descontoGlobalPct || 0).div(100);
    const totalBruto = f.totalBruto;
    const totalLiquido = totalBruto.mul(new Decimal(1).sub(desconto)).add(frete);
    // trazer a valor presente pelo prazo de pagamento
    const meses = prazoEmMeses(cond.prazoPagamentoDias || 0);
    const fator = new Decimal(1).add(new Decimal(taxaOportunidadeMensal)).pow(meses.toNumber());
    const totalPresente = totalLiquido.div(fator);

    const cobertura = itensTotais === 0 ? 0 : f.itensAtendidos / itensTotais;

    result.push({
      fornecedorId: cond.fornecedorId,
      totalBruto,
      totalLiquido,
      totalPresente,
      itensAtendidos: f.itensAtendidos,
      itensTotais,
      cobertura,
    });
  }

  // sort by totalPresente asc
  result.sort((a, b) => (a.totalPresente.lt(b.totalPresente) ? -1 : a.totalPresente.gt(b.totalPresente) ? 1 : 0));
  return result;
}

export function splitOtimo(params: {
  itens: ItemPedido[];
  propostas: PropostaItem[];
  condicoes: CondicaoFornecedor[];
  maxFornecedores: number;
  pedidoMinimoPorFornecedor: Map<string, Decimal>;
}): { fornecedorId: string; itemIds: string[]; total: Decimal }[] {
  // Greedy per-item assignment to lowest present cost, then group per fornecedor.
  const { itens, propostas, condicoes, pedidoMinimoPorFornecedor } = params;
  const taxa = new Decimal(0); // splitOtimo doesn't consider opportunity rate here; condicoes include frete/discount

  const assignment = new Map<string, string[]>();
  const totals = new Map<string, Decimal>();

  for (const it of itens) {
    let best: { fornecedorId: string; cost: Decimal } | null = null;
    const propostasDoItem = propostas.filter((p) => p.itemId === it.id && p.disponivel);
    for (const p of propostasDoItem) {
      const cond = condicoes.find((c) => c.fornecedorId === p.fornecedorId);
      if (!cond) continue;
      const valor = new Decimal(p.valorUnitario).mul(it.quantidade);
      const desconto = new Decimal(cond.descontoGlobalPct || 0).div(100);
      const freteShare = new Decimal(0); // we ignore per-item freight split for simplicity
      const liquido = valor.mul(new Decimal(1).sub(desconto)).add(freteShare);
      const meses = prazoEmMeses(cond.prazoPagamentoDias || 0);
      const fator = new Decimal(1).add(new Decimal(taxa)).pow(meses.toNumber());
      const presente = liquido.div(fator);
      if (!best || presente.lt(best.cost)) best = { fornecedorId: p.fornecedorId, cost: presente };
    }
    if (best) {
      const arr = assignment.get(best.fornecedorId) || [];
      arr.push(it.id);
      assignment.set(best.fornecedorId, arr);
      totals.set(best.fornecedorId, (totals.get(best.fornecedorId) || new Decimal(0)).add(best.cost));
    }
  }

  const out: { fornecedorId: string; itemIds: string[]; total: Decimal }[] = [];
  for (const [fid, itemIds] of assignment.entries()) {
    out.push({ fornecedorId: fid, itemIds, total: totals.get(fid) || new Decimal(0) });
  }

  // limit by maxFornecedores (keep cheapest groups)
  out.sort((a, b) => (a.total.lt(b.total) ? -1 : a.total.gt(b.total) ? 1 : 0));
  return out.slice(0, params.maxFornecedores);
}

export default {};
