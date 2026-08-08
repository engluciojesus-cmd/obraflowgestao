import Decimal from 'decimal.js';

export type DecimalType = Decimal;

// ============================================================================
// STATUS — espelham os CHECK constraints do banco (docs/05-FLUXO-SUPRIMENTOS.md §3)
// ============================================================================

export type RequisicaoItemStatus =
  | 'RASCUNHO'
  | 'ABERTA'
  | 'EM_COTACAO'
  | 'COTADA'
  | 'EM_OC'
  | 'RECEBIDO_PARCIAL'
  | 'RECEBIDA'
  | 'REJEITADA'
  | 'CANCELADA';

// requisicoes.status — DERIVADO dos itens, nunca escrito direto (ver domain/rules.ts)
export type RequisicaoStatus =
  | 'RASCUNHO'
  | 'ABERTA'
  | 'PARCIAL'
  | 'COTADA'
  | 'OC_GERADA'
  | 'CONTRATO_GERADO'
  | 'ATENDIDA'
  | 'REJEITADA'
  | 'CANCELADA';

export type CotacaoStatus =
  | 'NOVA'
  | 'ENVIADA'
  | 'PENDENTE_REENVIO'
  | 'RESPONDIDA_PARCIAL'
  | 'RESPONDIDA'
  | 'OC_PARCIAL'
  | 'OC_GERADA'
  | 'CONTRATO_PARCIAL'
  | 'CONTRATO_GERADO'
  | 'CANCELADA';

export type OrdemCompraStatus =
  | 'EM_APROVACAO'
  | 'NAO_APROVADA'
  | 'GERADA'
  | 'ENVIADA'
  | 'PENDENTE_REENVIO'
  | 'PROCESSADA'
  | 'PARCIALMENTE_RECEBIDA'
  | 'RECEBIDA'
  | 'RECUSADA'
  | 'CANCELADA';

/** Telas com filtro de status por checkbox (docs/05 §4). */
export type Tela = 'requisicao' | 'cotacao' | 'ordem_compra';

/** Tokens do design system real (ver tailwind.config.js) — nada além disso existe. */
export type StatusCor = 'side' | 'cta' | 'ok' | 'err';

interface StatusInfo {
  label: string;
  cor: StatusCor;
  /** false = "resolvido" — some da tela principal (docs/05 §4, regra geral). */
  pendente: boolean;
}

export const REQ_ITEM_STATUS: Record<RequisicaoItemStatus, StatusInfo> = {
  RASCUNHO: { label: 'Rascunho', cor: 'side', pendente: true },
  ABERTA: { label: 'Aberta', cor: 'cta', pendente: true },
  EM_COTACAO: { label: 'Em cotação', cor: 'cta', pendente: true },
  COTADA: { label: 'Cotada', cor: 'cta', pendente: true },
  EM_OC: { label: 'Em ordem de compra', cor: 'cta', pendente: true },
  RECEBIDO_PARCIAL: { label: 'Recebido parcial', cor: 'cta', pendente: true },
  RECEBIDA: { label: 'Recebida', cor: 'ok', pendente: false },
  REJEITADA: { label: 'Rejeitada', cor: 'err', pendente: false },
  CANCELADA: { label: 'Cancelada', cor: 'err', pendente: false },
} as const;

export const REQUISICAO_STATUS: Record<RequisicaoStatus, StatusInfo> = {
  RASCUNHO: { label: 'Rascunho', cor: 'side', pendente: true },
  ABERTA: { label: 'Aberta', cor: 'cta', pendente: true },
  PARCIAL: { label: 'Parcial', cor: 'cta', pendente: true },
  COTADA: { label: 'Cotada', cor: 'cta', pendente: true },
  OC_GERADA: { label: 'Ordem de compra gerada', cor: 'cta', pendente: true },
  CONTRATO_GERADO: { label: 'Contrato gerado', cor: 'cta', pendente: true },
  ATENDIDA: { label: 'Atendida', cor: 'ok', pendente: false },
  REJEITADA: { label: 'Rejeitada', cor: 'err', pendente: false },
  CANCELADA: { label: 'Cancelada', cor: 'err', pendente: false },
} as const;

export const COTACAO_STATUS: Record<CotacaoStatus, StatusInfo> = {
  NOVA: { label: 'Nova', cor: 'cta', pendente: true },
  ENVIADA: { label: 'Enviada aos fornecedores', cor: 'cta', pendente: true },
  PENDENTE_REENVIO: { label: 'Pendente de reenvio', cor: 'cta', pendente: true },
  RESPONDIDA_PARCIAL: { label: 'Respondida parcialmente', cor: 'cta', pendente: true },
  RESPONDIDA: { label: 'Respondida pelos fornecedores', cor: 'cta', pendente: true },
  OC_PARCIAL: { label: 'Ordem de compra parcial', cor: 'cta', pendente: true },
  OC_GERADA: { label: 'Ordem de compra gerada', cor: 'ok', pendente: false },
  CONTRATO_PARCIAL: { label: 'Contrato parcial', cor: 'cta', pendente: true },
  CONTRATO_GERADO: { label: 'Contrato gerado', cor: 'ok', pendente: false },
  CANCELADA: { label: 'Cancelada', cor: 'err', pendente: false },
} as const;

export const ORDEM_COMPRA_STATUS: Record<OrdemCompraStatus, StatusInfo> = {
  EM_APROVACAO: { label: 'Em aprovação', cor: 'cta', pendente: true },
  NAO_APROVADA: { label: 'Não aprovada', cor: 'err', pendente: false },
  GERADA: { label: 'Gerada', cor: 'side', pendente: true },
  ENVIADA: { label: 'Enviada ao fornecedor', cor: 'cta', pendente: true },
  PENDENTE_REENVIO: { label: 'Pendente de reenvio', cor: 'cta', pendente: true },
  PROCESSADA: { label: 'Processada pelo fornecedor', cor: 'cta', pendente: true },
  PARCIALMENTE_RECEBIDA: { label: 'Parcialmente recebida', cor: 'cta', pendente: true },
  RECEBIDA: { label: 'Recebida', cor: 'ok', pendente: false },
  RECUSADA: { label: 'Recusada', cor: 'err', pendente: false },
  CANCELADA: { label: 'Cancelada', cor: 'err', pendente: false },
} as const;

// ============================================================================
// ENTIDADES DE DOMÍNIO
// ============================================================================

export interface RequisicaoItem {
  id: string;
  requisicaoId: string;
  descricao: string;
  quantidade: DecimalType;
  quantidadeAtendida: DecimalType;
  unidade: string;
  status: RequisicaoItemStatus;
  insumoCanonicoId: string | null;
  orcamentoItemId: string | null;
  observacao: string | null;
  motivoCancelamento: string | null;
  ordem: number;
}

export interface Requisicao {
  id: string;
  companyId: string;
  processoId: string | null;
  numero: string;
  obraId: string | null;
  solicitanteId: string | null;
  descricao: string | null;
  dataSolicitacao: string;
  dataNecessidade: string | null;
  observacao: string | null;
  status: RequisicaoStatus;
  itens: RequisicaoItem[];
}

export interface RecebimentoItem {
  id: string;
  recebimentoId: string;
  ordemCompraItemId: string;
  quantidade: DecimalType;
  valorUnitario: DecimalType | null;
  conforme: boolean;
  observacao: string | null;
}

export interface Recebimento {
  id: string;
  ordemCompraId: string;
  processoId: string | null;
  sequencia: number;
  dataRecebimento: string;
  documentoNumero: string | null;
  documentoPath: string | null;
  documentoValor: DecimalType | null;
  observacao: string | null;
  itens: RecebimentoItem[];
}

/** Espelha a view vw_processo_cadeia — "Registros vinculados" (docs/05 §2). */
export interface ProcessoCadeia {
  processoId: string;
  numeroProcesso: string;
  obraId: string | null;
  requisicaoId: string | null;
  requisicaoNumero: string | null;
  requisicaoStatus: RequisicaoStatus | null;
  cotacaoId: string | null;
  cotacaoNumero: number | null;
  cotacaoStatus: CotacaoStatus | null;
  ordemId: string | null;
  ordemNumero: number | null;
  ordemStatus: OrdemCompraStatus | null;
  ordemValor: DecimalType | null;
  recebimentoId: string | null;
  recebimentoSeq: number | null;
  documentoNumero: string | null;
  lancamentoId: string | null;
  lancamentoNumero: string | null;
  lancamentoStatus: string | null;
  lancamentoValor: DecimalType | null;
}

export default {};
