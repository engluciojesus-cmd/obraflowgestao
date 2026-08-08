// ⛔ PROIBIDO NESTE ARQUIVO: react, @supabase/*, @tanstack/*
// Só entra dado, só sai dado. Testável sem browser e sem banco.

import Decimal from 'decimal.js';
import type { RequisicaoItemStatus, RequisicaoStatus, Tela } from './types';

// ============================================================================
// MÁQUINA DE ESTADO — espelha public.validar_transicao_item() (docs/05 §3.1)
// ============================================================================

const TRANSICOES: Record<RequisicaoItemStatus, RequisicaoItemStatus[]> = {
  RASCUNHO: ['ABERTA', 'CANCELADA'],
  ABERTA: ['EM_COTACAO', 'EM_OC', 'REJEITADA', 'CANCELADA'],
  EM_COTACAO: ['COTADA', 'ABERTA', 'CANCELADA'],
  COTADA: ['EM_OC', 'ABERTA', 'CANCELADA'],
  EM_OC: ['RECEBIDO_PARCIAL', 'RECEBIDA', 'ABERTA', 'CANCELADA'],
  RECEBIDO_PARCIAL: ['RECEBIDA', 'CANCELADA'],
  RECEBIDA: [],
  REJEITADA: ['ABERTA', 'CANCELADA'],
  CANCELADA: ['ABERTA'],
};

export function podeTransicionar(de: RequisicaoItemStatus, para: RequisicaoItemStatus): boolean {
  if (de === para) return true;
  return TRANSICOES[de]?.includes(para) ?? false;
}

// ============================================================================
// STATUS DERIVADO — espelha public.recalcular_status_requisicao() (docs/05 §3.2)
// ============================================================================

export function statusRequisicaoDerivado(itens: { status: RequisicaoItemStatus }[]): RequisicaoStatus {
  const total = itens.length;
  if (total === 0) return 'RASCUNHO';

  let rascunho = 0;
  let aberta = 0;
  let cotacao = 0;
  let oc = 0;
  let recebida = 0;
  let morta = 0;

  for (const item of itens) {
    switch (item.status) {
      case 'RASCUNHO':
        rascunho += 1;
        break;
      case 'ABERTA':
        aberta += 1;
        break;
      case 'EM_COTACAO':
      case 'COTADA':
        cotacao += 1;
        break;
      case 'EM_OC':
      case 'RECEBIDO_PARCIAL':
        oc += 1;
        break;
      case 'RECEBIDA':
        recebida += 1;
        break;
      case 'CANCELADA':
      case 'REJEITADA':
        morta += 1;
        break;
    }
  }

  if (morta === total) return 'CANCELADA';
  if (rascunho === total) return 'RASCUNHO';
  if (recebida + morta === total) return 'ATENDIDA';
  if (aberta === total) return 'ABERTA';
  if (oc > 0 && aberta === 0 && cotacao === 0) return 'OC_GERADA';
  if (cotacao > 0 && aberta === 0 && oc === 0) return 'COTADA';
  return 'PARCIAL';
}

// ============================================================================
// RECEBIMENTO PARCIAL (docs/05 §4.5)
// ============================================================================

/** Quanto ainda falta receber. Nunca fica negativo (banco tolera até 105%). */
export function saldoItem(pedido: Decimal, recebido: Decimal): Decimal {
  const saldo = new Decimal(pedido).sub(recebido);
  return saldo.isNegative() ? new Decimal(0) : saldo;
}

/** Percentual recebido do conjunto (0-100, 2 casas) — espelha vw_oc_recebimento. */
export function percentualRecebido(itens: { quantidade: Decimal; quantidadeRecebida: Decimal }[]): number {
  let pedida = new Decimal(0);
  let recebida = new Decimal(0);
  for (const item of itens) {
    pedida = pedida.add(item.quantidade);
    recebida = recebida.add(item.quantidadeRecebida);
  }
  if (pedida.isZero()) return 0;
  return recebida.div(pedida).mul(100).toDecimalPlaces(2).toNumber();
}

// ============================================================================
// FILTRO PADRÃO POR TELA (docs/05 §4) — "resolvidos somem, o resto fica"
// ============================================================================

const PENDENTES_POR_TELA: Record<Tela, string[]> = {
  requisicao: ['ABERTA', 'PARCIAL'],
  cotacao: ['NOVA', 'ENVIADA', 'RESPONDIDA_PARCIAL', 'RESPONDIDA'],
  ordem_compra: [
    'EM_APROVACAO',
    'GERADA',
    'ENVIADA',
    'PENDENTE_REENVIO',
    'PROCESSADA',
    'PARCIALMENTE_RECEBIDA',
  ],
};

export function statusPendentesPorTela(tela: Tela): string[] {
  return PENDENTES_POR_TELA[tela];
}

// ============================================================================
// FILTRO DE SITUAÇÃO — por que "Cotada" não achava nada
//
// `requisicoes.status` é DERIVADO e só vale para o conjunto inteiro: gerar
// cotação de 1 item de uma requisição de 3 deixa o cabeçalho em PARCIAL, não
// em COTADA. Quem filtrava por "Cotada" esperava "requisições que têm item em
// cotação" e recebia zero linha.
//
// A correção é procurar nos dois lugares: cabeçalho OU item. Este mapa diz,
// para cada situação oferecida no filtro, quais status de ITEM contam.
// ============================================================================

const ITENS_POR_SITUACAO: Record<RequisicaoStatus, RequisicaoItemStatus[]> = {
  RASCUNHO: ['RASCUNHO'],
  ABERTA: ['ABERTA'],
  COTADA: ['EM_COTACAO', 'COTADA'],
  OC_GERADA: ['EM_OC', 'RECEBIDO_PARCIAL'],
  ATENDIDA: ['RECEBIDA'],
  REJEITADA: ['REJEITADA'],
  CANCELADA: ['CANCELADA'],
  // PARCIAL e CONTRATO_GERADO não têm status de item equivalente — são
  // propriedades do conjunto, então só o cabeçalho responde por elas.
  PARCIAL: [],
  CONTRATO_GERADO: [],
};

export function itensDaSituacaoRequisicao(status: string): RequisicaoItemStatus[] {
  return ITENS_POR_SITUACAO[status as RequisicaoStatus] ?? [];
}

// ============================================================================
// ⭐ MAPA DE COTAÇÃO — sugestões (docs/05 §4.3)
// sugestaoMenorValorPresente já existe: rankearFornecedores() em
// src/modules/compras/domain/rules.ts — reutilize, não reimplemente aqui.
// ============================================================================

export interface PropostaItemCotacao {
  fornecedorId: string;
  itemId: string;
  valorUnitario: Decimal;
  disponivel: boolean;
}

export interface CondicaoFornecedorCotacao {
  fornecedorId: string;
  frete: Decimal;
  descontoGlobalPct: Decimal;
}

/** Para cada item, o fornecedor com o menor preço unitário disponível (pode dar N fornecedores). */
export function sugestaoMenorUnitario(
  itens: { id: string }[],
  propostas: PropostaItemCotacao[],
): Map<string, string> {
  const escolha = new Map<string, string>();

  for (const item of itens) {
    let melhor: { fornecedorId: string; valor: Decimal } | null = null;
    for (const p of propostas) {
      if (p.itemId !== item.id || !p.disponivel) continue;
      const valor = new Decimal(p.valorUnitario);
      if (valor.lte(0)) continue;
      if (!melhor || valor.lt(melhor.valor)) melhor = { fornecedorId: p.fornecedorId, valor };
    }
    if (melhor) escolha.set(item.id, melhor.fornecedorId);
  }

  return escolha;
}

/**
 * Um fornecedor só, menor total (frete e desconto global inclusos).
 * Só considera fornecedores que cobrem TODOS os itens — "um fornecedor só"
 * não faz sentido se ele não atende o pedido inteiro.
 */
export function sugestaoMenorGlobal(
  itens: { id: string; quantidade: Decimal }[],
  propostas: PropostaItemCotacao[],
  condicoes: CondicaoFornecedorCotacao[],
): string | null {
  let melhor: { fornecedorId: string; total: Decimal } | null = null;

  for (const cond of condicoes) {
    let total = new Decimal(0);
    let cobertos = 0;

    for (const item of itens) {
      const proposta = propostas.find(
        (p) => p.fornecedorId === cond.fornecedorId && p.itemId === item.id && p.disponivel,
      );
      if (!proposta) continue;
      cobertos += 1;
      total = total.add(new Decimal(proposta.valorUnitario).mul(item.quantidade));
    }

    if (cobertos !== itens.length) continue; // cobertura parcial não conta pra "um fornecedor só"

    const desconto = new Decimal(cond.descontoGlobalPct || 0).div(100);
    const totalLiquido = total.mul(new Decimal(1).sub(desconto)).add(cond.frete || 0);

    if (!melhor || totalLiquido.lt(melhor.total)) {
      melhor = { fornecedorId: cond.fornecedorId, total: totalLiquido };
    }
  }

  return melhor?.fornecedorId ?? null;
}

export default {};
