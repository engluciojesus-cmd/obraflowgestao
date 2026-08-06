import { z } from 'zod';

export const PropostaItemSchema = z.object({
  fornecedorId: z.string(),
  itemId: z.string(),
  valorUnitario: z.string(),
  marca: z.string().nullable().optional(),
  disponivel: z.boolean(),
});

export const CondicaoFornecedorSchema = z.object({
  fornecedorId: z.string(),
  frete: z.string(),
  descontoGlobalPct: z.string(),
  prazoPagamentoDias: z.number(),
  prazoEntregaDias: z.number(),
});

export const ItemPedidoSchema = z.object({
  id: z.string(),
  quantidade: z.string(),
});

export default {};
