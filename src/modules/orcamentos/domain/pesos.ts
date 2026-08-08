// ⛔ PROIBIDO NESTE ARQUIVO: react, @supabase/*, @tanstack/*
// Só entra dado, só sai dado. Testável sem browser e sem banco.

/**
 * MODELO PERCENTUAL DO ORÇAMENTO
 *
 * Todo peso é percentual DO CONTRATO INTEIRO — não do serviço que o contém.
 * Cada serviço se comporta de um jeito conforme o nível de detalhe:
 *
 *   - com subitens  → o peso do serviço é a SOMA dos subitens (nunca digitado)
 *   - sem subitens  → o peso é digitado direto no macro
 *
 * A soma dos pesos dos serviços tem que fechar 100%. Só esse total é validado;
 * o resto o usuário preenche livre.
 *
 * Peso em branco não é zero: é "ainda não decidido". O que sobra para 100% é
 * distribuído igualmente entre os nós em branco, e a sugestão vai encolhendo à
 * medida que o orçamento é alimentado.
 */

export interface NoPeso {
  id: string;
  /** null = não digitado ainda (recebe sugestão da sobra). */
  pesoInformado: number | null;
}

export interface ServicoPeso {
  id: string;
  pesoInformado: number | null;
  itens: NoPeso[];
}

export interface PesoCalculado {
  peso: number;
  /** true = veio da distribuição da sobra, não do que o usuário digitou. */
  sugerido: boolean;
}

export interface ResultadoPesos {
  /** Peso efetivo por item, chaveado por id. */
  itens: Map<string, PesoCalculado>;
  /** Peso efetivo por serviço: soma dos itens, ou o próprio peso quando não há itens. */
  servicos: Map<string, PesoCalculado>;
  /** Soma dos pesos dos serviços. Fecha em 100 quando o orçamento está completo. */
  total: number;
}

/**
 * Nós que carregam peso: os subitens de cada serviço, ou o serviço quando ele
 * não tem subitens. Um serviço com subitens nunca entra — o peso dele é derivado.
 */
function nosDePeso(servicos: ServicoPeso[]): { servicoId: string; no: NoPeso; ehServico: boolean }[] {
  const nos: { servicoId: string; no: NoPeso; ehServico: boolean }[] = [];
  for (const sv of servicos) {
    if (sv.itens.length > 0) {
      for (const item of sv.itens) nos.push({ servicoId: sv.id, no: item, ehServico: false });
    } else {
      nos.push({ servicoId: sv.id, no: { id: sv.id, pesoInformado: sv.pesoInformado }, ehServico: true });
    }
  }
  return nos;
}

export function calcularPesos(servicos: ServicoPeso[]): ResultadoPesos {
  const nos = nosDePeso(servicos);

  const informados = nos.filter((n) => n.no.pesoInformado !== null);
  const emBranco = nos.filter((n) => n.no.pesoInformado === null);

  const somaInformada = informados.reduce((s, n) => s + (n.no.pesoInformado ?? 0), 0);
  // Se o que já foi digitado passou de 100, não há sobra para sugerir.
  const sobra = Math.max(100 - somaInformada, 0);
  const sugestao = emBranco.length > 0 ? sobra / emBranco.length : 0;

  const itens = new Map<string, PesoCalculado>();
  const porServico = new Map<string, number>();
  const servicoSugerido = new Map<string, boolean>();

  for (const n of nos) {
    const informado = n.no.pesoInformado !== null;
    const peso = informado ? (n.no.pesoInformado as number) : sugestao;
    if (!n.ehServico) itens.set(n.no.id, { peso, sugerido: !informado });
    porServico.set(n.servicoId, (porServico.get(n.servicoId) ?? 0) + peso);
    if (!informado) servicoSugerido.set(n.servicoId, true);
  }

  const servicosCalc = new Map<string, PesoCalculado>();
  for (const sv of servicos) {
    servicosCalc.set(sv.id, {
      peso: porServico.get(sv.id) ?? 0,
      sugerido: servicoSugerido.get(sv.id) ?? false,
    });
  }

  const total = [...servicosCalc.values()].reduce((s, p) => s + p.peso, 0);

  return { itens, servicos: servicosCalc, total };
}

/** R$ derivado do percentual — no modo PERCENTUAL o dinheiro nunca é digitado. */
export function valorDoPeso(peso: number, valorContrato: number): number {
  return (peso / 100) * valorContrato;
}

/** O total só pode fechar 100%; sobra de arredondamento de centésimo é tolerada. */
export function fechaCem(total: number): boolean {
  return Math.abs(total - 100) < 0.01;
}
