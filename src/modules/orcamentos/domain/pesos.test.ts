import { describe, it, expect } from 'vitest';
import { calcularPesos, fechaCem, valorDoPeso, type ServicoPeso } from './pesos';

describe('calcularPesos — modelo percentual do contrato', () => {
  it('serviço com subitens tem peso = soma dos subitens', () => {
    const servicos: ServicoPeso[] = [
      {
        id: 'estrutura',
        pesoInformado: null,
        itens: [
          { id: 'sapata', pesoInformado: 4 },
          { id: 'baldrame', pesoInformado: 5 },
          { id: 'pilar', pesoInformado: 6 },
          { id: 'laje', pesoInformado: 13 },
        ],
      },
    ];
    const r = calcularPesos(servicos);
    expect(r.servicos.get('estrutura')?.peso).toBe(28);
    expect(r.servicos.get('estrutura')?.sugerido).toBe(false);
  });

  it('serviço sem subitens usa o peso digitado no macro', () => {
    const r = calcularPesos([{ id: 'cobertura', pesoInformado: 6, itens: [] }]);
    expect(r.servicos.get('cobertura')?.peso).toBe(6);
  });

  it('mistura os dois níveis de detalhe no mesmo orçamento', () => {
    const r = calcularPesos([
      { id: 'estrutura', pesoInformado: null, itens: [{ id: 's', pesoInformado: 28 }] },
      { id: 'alvenaria', pesoInformado: null, itens: [{ id: 'a', pesoInformado: 34 }] },
      { id: 'cobertura', pesoInformado: 38, itens: [] },
    ]);
    expect(r.total).toBe(100);
    expect(fechaCem(r.total)).toBe(true);
  });

  it('distribui a sobra igualmente entre os nós em branco', () => {
    const r = calcularPesos([
      { id: 'a', pesoInformado: 40, itens: [] },
      { id: 'b', pesoInformado: null, itens: [] },
      { id: 'c', pesoInformado: null, itens: [] },
    ]);
    // sobra 60 dividida entre 2 => 30 cada
    expect(r.servicos.get('b')?.peso).toBe(30);
    expect(r.servicos.get('c')?.peso).toBe(30);
    expect(r.servicos.get('b')?.sugerido).toBe(true);
    expect(r.servicos.get('a')?.sugerido).toBe(false);
    expect(r.total).toBe(100);
  });

  it('a sugestão encolhe conforme o orçamento é alimentado', () => {
    const antes = calcularPesos([
      { id: 'a', pesoInformado: 10, itens: [] },
      { id: 'b', pesoInformado: null, itens: [] },
      { id: 'c', pesoInformado: null, itens: [] },
    ]);
    const depois = calcularPesos([
      { id: 'a', pesoInformado: 10, itens: [] },
      { id: 'b', pesoInformado: 70, itens: [] },
      { id: 'c', pesoInformado: null, itens: [] },
    ]);
    expect(antes.servicos.get('c')?.peso).toBe(45);
    expect(depois.servicos.get('c')?.peso).toBe(20);
  });

  it('não sugere peso negativo quando o digitado já passou de 100', () => {
    const r = calcularPesos([
      { id: 'a', pesoInformado: 120, itens: [] },
      { id: 'b', pesoInformado: null, itens: [] },
    ]);
    expect(r.servicos.get('b')?.peso).toBe(0);
    expect(fechaCem(r.total)).toBe(false);
  });

  it('serviço Misto de item único carrega o peso inteiro do serviço', () => {
    const r = calcularPesos([
      { id: 'fase-cinza', pesoInformado: null, itens: [{ id: 'pacote', pesoInformado: 6 }] },
    ]);
    expect(r.itens.get('pacote')?.peso).toBe(6);
    expect(r.servicos.get('fase-cinza')?.peso).toBe(6);
  });

  it('orçamento vazio não quebra', () => {
    const r = calcularPesos([]);
    expect(r.total).toBe(0);
    expect(fechaCem(r.total)).toBe(false);
  });
});

describe('valorDoPeso — R$ é derivado do %', () => {
  it('calcula o valor do subitem a partir do contrato', () => {
    expect(valorDoPeso(4, 132000)).toBe(5280);
    expect(valorDoPeso(13, 132000)).toBe(17160);
  });

  it('contrato zerado devolve zero em vez de NaN', () => {
    expect(valorDoPeso(25, 0)).toBe(0);
  });
});

describe('fechaCem — tolerância de arredondamento', () => {
  it('aceita centésimo de sobra', () => {
    expect(fechaCem(99.995)).toBe(true);
    expect(fechaCem(100.005)).toBe(true);
  });

  it('recusa desvio real', () => {
    expect(fechaCem(99.5)).toBe(false);
    expect(fechaCem(101)).toBe(false);
  });
});
