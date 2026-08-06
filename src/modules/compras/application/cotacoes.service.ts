import Decimal from 'decimal.js';
import { cotacoesRepository } from '@/modules/compras/data/cotacoes.repository';
import { rankearFornecedores, menorPrecoUnitario } from '@/modules/compras/domain/rules';

export async function gerarRanking(cotacaoId: string, taxaOportunidadeMensal: any) {
  const mapa = await cotacoesRepository.buscarMapa(cotacaoId);
  // transform data into domain shape (simplified)
  const itens = (mapa.items || []).map((it: any) => ({ id: it.id, quantidade: new Decimal(it.quantidade || 0) }));
  const propostas = (mapa.precos || []).map((p: any) => ({ fornecedorId: p.cotacao_fornecedor_id, itemId: p.cotacao_item_id, valorUnitario: new Decimal(p.valor_unitario || 0), disponivel: true }));
  const condicoes = (mapa.fornecedores || []).map((f: any) => ({ fornecedorId: f.id, frete: new Decimal(f.frete || 0), descontoGlobalPct: new Decimal(0), prazoPagamentoDias: Number(f.prazo || 0), prazoEntregaDias: Number(f.prazo_entrega || 0) }));
  return rankearFornecedores({ itens, propostas, condicoes, taxaOportunidadeMensal: new Decimal(taxaOportunidadeMensal) });
}

export default { gerarRanking };
