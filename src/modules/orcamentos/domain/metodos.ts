// ⛔ PROIBIDO NESTE ARQUIVO: react, @supabase/*, @tanstack/*

/**
 * OS TRÊS MÉTODOS DE ORÇAMENTO
 *
 * A chave gravada no banco é estável; o rótulo é só apresentação e pode mudar
 * sem migration. Quanto mais simples o método, menos campo a tela pede — é a
 * regra que `camposVisiveis` codifica.
 */
export type MetodoOrcamento = 'QUANTITATIVO' | 'PERCENTUAL' | 'FECHADO';

export const METODO_PADRAO: MetodoOrcamento = 'QUANTITATIVO';

interface MetodoInfo {
  chave: MetodoOrcamento;
  label: string;
  resumo: string;
  /** Do mais detalhado para o mais enxuto — é a ordem em que aparecem. */
  ordem: number;
}

export const METODOS: Record<MetodoOrcamento, MetodoInfo> = {
  QUANTITATIVO: {
    chave: 'QUANTITATIVO',
    label: 'Analítico — por composição',
    resumo:
      'Cada item tem quantidade e valor unitário, vindo de composição própria ou SINAPI. O total e o peso de cada serviço saem do valor.',
    ordem: 1,
  },
  PERCENTUAL: {
    chave: 'PERCENTUAL',
    label: 'Percentual — peso sobre o contrato',
    resumo:
      'Você informa o valor do contrato e distribui o peso % entre os serviços; o R$ de cada linha é calculado. A soma tem que fechar 100%.',
    ordem: 2,
  },
  FECHADO: {
    chave: 'FECHADO',
    label: 'Fechado — valor único',
    resumo:
      'Serviço básico que não compensa destrinchar: uma descrição e um valor. Sem fases, sem itens, sem peso.',
    ordem: 3,
  },
};

export const METODOS_ORDENADOS = Object.values(METODOS).sort((a, b) => a.ordem - b.ordem);

export function metodoDe(valor: string | null | undefined): MetodoOrcamento {
  return valor === 'PERCENTUAL' || valor === 'FECHADO' || valor === 'QUANTITATIVO'
    ? valor
    : METODO_PADRAO;
}

export interface CamposVisiveis {
  /** Estrutura de fases e serviços múltiplos. */
  estrutura: boolean;
  /** Colunas de quantidade / unidade / valor unitário no item. */
  quantitativo: boolean;
  /** Coluna de peso % e validação de 100%. */
  peso: boolean;
  /** Valor do contrato digitado no cabeçalho (em vez de somado dos itens). */
  valorContratoEditavel: boolean;
}

export function camposVisiveis(metodo: MetodoOrcamento): CamposVisiveis {
  switch (metodo) {
    case 'PERCENTUAL':
      return { estrutura: true, quantitativo: false, peso: true, valorContratoEditavel: true };
    case 'FECHADO':
      return { estrutura: false, quantitativo: false, peso: false, valorContratoEditavel: true };
    case 'QUANTITATIVO':
    default:
      return { estrutura: true, quantitativo: true, peso: false, valorContratoEditavel: false };
  }
}
