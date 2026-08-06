import Decimal from 'decimal.js';

Decimal.set({ rounding: Decimal.ROUND_HALF_UP });

export type Money = Decimal & { __brand: 'Money' };

const SCALE_VALUES = 2;
const SCALE_UNIT = 4;

function toMoney(d: Decimal): Money {
  return d as unknown as Money;
}

export function dec(v: number | string | Decimal, unit = false): Money {
  const d = new Decimal(v);
  const scale = unit ? SCALE_UNIT : SCALE_VALUES;
  return toMoney(d.toDecimalPlaces(scale, Decimal.ROUND_HALF_UP));
}

export function fromDatabase(n: number | string): Money {
  return dec(n, false);
}

export function toDatabase(m: Money): number {
  return Number(m.toFixed(SCALE_VALUES));
}

export function add(a: Money, b: Money, unit = false): Money {
  const scale = unit ? SCALE_UNIT : SCALE_VALUES;
  return toMoney(a.add(b).toDecimalPlaces(scale, Decimal.ROUND_HALF_UP));
}

export function sub(a: Money, b: Money, unit = false): Money {
  const scale = unit ? SCALE_UNIT : SCALE_VALUES;
  return toMoney(a.sub(b).toDecimalPlaces(scale, Decimal.ROUND_HALF_UP));
}

export function mul(a: Money, b: Decimal | Money | number | string, unit = false): Money {
  const bb = b instanceof Decimal ? b : new Decimal(b as any);
  const scale = unit ? SCALE_UNIT : SCALE_VALUES;
  return toMoney(a.mul(bb).toDecimalPlaces(scale, Decimal.ROUND_HALF_UP));
}

export function div(a: Money, b: Decimal | Money | number | string, unit = false): Money {
  const bb = b instanceof Decimal ? b : new Decimal(b as any);
  const scale = unit ? SCALE_UNIT : SCALE_VALUES;
  return toMoney(a.div(bb).toDecimalPlaces(scale, Decimal.ROUND_HALF_UP));
}

export function pct(a: Money, percent: number | string | Decimal): Money {
  const p = percent instanceof Decimal ? percent : new Decimal(percent as any);
  return mul(a, p.div(100));
}

export function isZero(a: Money): boolean {
  return a.equals(0);
}

export function gt(a: Money, b: Money): boolean {
  return a.gt(b);
}

export function lt(a: Money, b: Money): boolean {
  return a.lt(b);
}

export function eq(a: Money, b: Money): boolean {
  return a.equals(b);
}

export function formatBRL(m: Money): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(m.toFixed(2)));
}

export const ROUND_HALF_UP = Decimal.ROUND_HALF_UP;

export default {
  dec,
  fromDatabase,
  toDatabase,
  add,
  sub,
  mul,
  div,
  pct,
  isZero,
  gt,
  lt,
  eq,
  formatBRL,
};
