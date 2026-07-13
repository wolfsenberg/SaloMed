import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

import { blocksForInsufficientBalance } from '../balance-guard';

describe('blocksForInsufficientBalance', () => {
  it('blocks when amount exceeds balance', () => {
    expect(blocksForInsufficientBalance(10, 5)).toBe(true);
  });

  it('allows when amount is within balance', () => {
    expect(blocksForInsufficientBalance(5, 5)).toBe(false);
    expect(blocksForInsufficientBalance(4, 5)).toBe(false);
  });

  // Feature: reliable-traceable-transactions, Property 6: Pre-sign
  // insufficient-balance guard. (minimum 100 iterations)
  it('Property 6: blocks if and only if amount exceeds live balance', () => {
    let signed = 0;
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 1e9, noNaN: true }),
        fc.float({ min: 0, max: 1e9, noNaN: true }),
        (amount, liveBalance) => {
          const blocked = blocksForInsufficientBalance(amount, liveBalance);
          expect(blocked).toBe(amount > liveBalance);
          // Simulate the guard: signing only proceeds when not blocked.
          if (!blocked) {
            expect(amount).toBeLessThanOrEqual(liveBalance);
            signed += 1;
          }
        },
      ),
      { numRuns: 200 },
    );
    // At least some allowed cases exercised the non-blocking branch.
    expect(signed).toBeGreaterThan(0);
  });
});
