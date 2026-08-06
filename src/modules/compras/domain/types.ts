import Decimal from 'decimal.js';

export type DecimalType = Decimal;

export interface PropostaItem {
  fornecedorId: string;
  itemId: string;
  valorUnitario: DecimalType; // preço unitário ofertado
  marca?: string | null;
  disponivel: boolean;
}

export interface CondicaoFornecedor {
  fornecedorId: string;
  frete: DecimalType;
  descontoGlobalPct: DecimalType; // 0..100
  prazoPagamentoDias: number;
  prazoEntregaDias: number;
}

export interface ItemPedido {
  id: string;
  quantidade: DecimalType;
}

export interface Ranking {
  fornecedorId: string;
  totalBruto: DecimalType;
  totalLiquido: DecimalType;
  totalPresente: DecimalType;
  itensAtendidos: number;
  itensTotais: number;
  cobertura: number; // 0..1
}

export default {};
