import type { CotacaoItem, CotacaoFornecedor, CotacaoPreco } from '@/types';

export interface CotacaoMapaDTO {
  items: CotacaoItem[];
  fornecedores: CotacaoFornecedor[];
  precos: CotacaoPreco[];
}
