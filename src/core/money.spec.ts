import { describe, it, expect } from 'vitest';
import { dec, add, eq, toDatabase } from './money';

describe('money', () => {
  it('0.1 + 0.2 === 0.3 using Money', () => {
    const a = dec(0.1);
    const b = dec(0.2);
    const sum = add(a, b);
    // exact equality using Decimal
    expect(eq(sum, dec(0.3))).toBe(true);
    // and numeric representation
    expect(toDatabase(sum)).toBeCloseTo(0.3, 10);
  });
});
