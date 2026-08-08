import Decimal from 'decimal.js';

Decimal.set({ rounding: Decimal.ROUND_HALF_UP, precision: 28 });

export type Money = Decimal & { readonly __money: true };

export const dec = (value: string | number | Decimal): Money =>
  new Decimal(value) as Money;

export const add = (a: Money, b: Money): Money =>
  a.plus(b) as Money;

export const sub = (a: Money, b: Money): Money =>
  a.minus(b) as Money;

export const mul = (a: Money, b: string | number | Decimal): Money =>
  a.times(b) as Money;

export const div = (a: Money, b: string | number | Decimal): Money =>
  a.dividedBy(b).toDecimalPlaces(2, Decimal.ROUND_HALF_UP) as Money;

export const pct = (a: Money, percent: string | number): Money =>
  a.times(percent).dividedBy(100).toDecimalPlaces(2) as Money;

export const isZero = (m: Money): boolean => m.isZero();

export const gt = (a: Money, b: Money): boolean => a.greaterThan(b);
export const lt = (a: Money, b: Money): boolean => a.lessThan(b);
export const eq = (a: Money, b: Money): boolean => a.equals(b);
export const gte = (a: Money, b: Money): boolean => a.greaterThanOrEqualTo(b);
export const lte = (a: Money, b: Money): boolean => a.lessThanOrEqualTo(b);

export const fromDatabase = (n: number | string | null | undefined): Money =>
  n == null || n === '' ? dec(0) : dec(n);

export const toDatabase = (m: Money): number =>
  Number(m.toFixed(2));

export const formatBRL = (m: Money): string => {
  const str = m.toFixed(2);
  const [inteiro, decimais] = str.split('.');
  const inteiroBRL = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `R$ ${inteiroBRL},${decimais}`;
};

export const zero: Money = dec(0);
