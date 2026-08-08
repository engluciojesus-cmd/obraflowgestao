import { describe, it, expect } from 'vitest';
import * as M from './money';

describe('Money — aritmética segura', () => {
  it('0.1 + 0.2 === 0.3 (não 0.30000000000000004)', () => {
    const result = M.add(M.dec('0.1'), M.dec('0.2'));
    expect(M.eq(result, M.dec('0.3'))).toBe(true);
  });

  it('add funciona com valores reais', () => {
    const r = M.add(M.dec('10.50'), M.dec('20.30'));
    expect(M.eq(r, M.dec('30.80'))).toBe(true);
  });

  it('sub funciona', () => {
    const r = M.sub(M.dec('100.00'), M.dec('30.50'));
    expect(M.eq(r, M.dec('69.50'))).toBe(true);
  });

  it('mul funciona', () => {
    const r = M.mul(M.dec('100'), M.dec('0.15'));
    expect(M.eq(r, M.dec('15'))).toBe(true);
  });

  it('div com 2 casas', () => {
    const r = M.div(M.dec('10'), M.dec('3'));
    expect(M.eq(r, M.dec('3.33'))).toBe(true);
  });

  it('pct funciona', () => {
    const r = M.pct(M.dec('1000'), 10);
    expect(M.eq(r, M.dec('100'))).toBe(true);
  });

  it('pct com decimal', () => {
    const r = M.pct(M.dec('1000'), 2.5);
    expect(M.eq(r, M.dec('25'))).toBe(true);
  });

  it('isZero', () => {
    expect(M.isZero(M.dec('0'))).toBe(true);
    expect(M.isZero(M.dec('0.01'))).toBe(false);
  });

  it('comparadores', () => {
    const a = M.dec('10');
    const b = M.dec('20');
    expect(M.lt(a, b)).toBe(true);
    expect(M.gt(b, a)).toBe(true);
    expect(M.eq(a, a)).toBe(true);
    expect(M.lte(a, b)).toBe(true);
    expect(M.gte(b, a)).toBe(true);
  });

  it('fromDatabase com null', () => {
    const r1 = M.fromDatabase(null);
    const r2 = M.fromDatabase(undefined);
    const r3 = M.fromDatabase('');
    expect(M.isZero(r1)).toBe(true);
    expect(M.isZero(r2)).toBe(true);
    expect(M.isZero(r3)).toBe(true);
  });

  it('toDatabase converte pra number', () => {
    const n = M.toDatabase(M.dec('123.45'));
    expect(n).toBe(123.45);
    expect(typeof n).toBe('number');
  });

  it('formatBRL', () => {
    expect(M.formatBRL(M.dec('1234.56'))).toBe('R$ 1.234,56');
    expect(M.formatBRL(M.dec('10.00'))).toBe('R$ 10,00');
    expect(M.formatBRL(M.dec('1000000.99'))).toBe('R$ 1.000.000,99');
  });

  it('zero constant', () => {
    expect(M.isZero(M.zero)).toBe(true);
  });
});
