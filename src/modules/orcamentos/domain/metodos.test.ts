import { describe, it, expect } from 'vitest';
import { camposVisiveis, metodoDe, METODOS, METODOS_ORDENADOS } from './metodos';

describe('metodoDe — tolerante a dado velho', () => {
  it('reconhece os três métodos', () => {
    expect(metodoDe('QUANTITATIVO')).toBe('QUANTITATIVO');
    expect(metodoDe('PERCENTUAL')).toBe('PERCENTUAL');
    expect(metodoDe('FECHADO')).toBe('FECHADO');
  });

  it('orçamento anterior à migration cai no analítico, sem quebrar', () => {
    expect(metodoDe(null)).toBe('QUANTITATIVO');
    expect(metodoDe(undefined)).toBe('QUANTITATIVO');
    expect(metodoDe('')).toBe('QUANTITATIVO');
    expect(metodoDe('LIXO')).toBe('QUANTITATIVO');
  });
});

describe('camposVisiveis — quanto mais simples o método, menos campo', () => {
  it('analítico pede quantidade e deriva o valor', () => {
    const c = camposVisiveis('QUANTITATIVO');
    expect(c.estrutura).toBe(true);
    expect(c.quantitativo).toBe(true);
    expect(c.peso).toBe(false);
    expect(c.valorContratoEditavel).toBe(false);
  });

  it('percentual troca quantidade por peso e pede o contrato', () => {
    const c = camposVisiveis('PERCENTUAL');
    expect(c.estrutura).toBe(true);
    expect(c.quantitativo).toBe(false);
    expect(c.peso).toBe(true);
    expect(c.valorContratoEditavel).toBe(true);
  });

  it('fechado esconde a estrutura inteira', () => {
    const c = camposVisiveis('FECHADO');
    expect(c.estrutura).toBe(false);
    expect(c.quantitativo).toBe(false);
    expect(c.peso).toBe(false);
    expect(c.valorContratoEditavel).toBe(true);
  });

  it('quantitativo e peso nunca aparecem juntos — são fontes da verdade rivais', () => {
    for (const m of METODOS_ORDENADOS) {
      const c = camposVisiveis(m.chave);
      expect(c.quantitativo && c.peso).toBe(false);
    }
  });

  it('o valor é digitado exatamente quando não é derivado dos itens', () => {
    for (const m of METODOS_ORDENADOS) {
      const c = camposVisiveis(m.chave);
      expect(c.valorContratoEditavel).toBe(!c.quantitativo);
    }
  });
});

describe('METODOS — catálogo', () => {
  it('lista os três, do mais detalhado ao mais enxuto', () => {
    expect(METODOS_ORDENADOS.map((m) => m.chave)).toEqual([
      'QUANTITATIVO',
      'PERCENTUAL',
      'FECHADO',
    ]);
  });

  it('todo método tem rótulo e resumo para a tela', () => {
    for (const m of Object.values(METODOS)) {
      expect(m.label.length).toBeGreaterThan(0);
      expect(m.resumo.length).toBeGreaterThan(0);
    }
  });
});
