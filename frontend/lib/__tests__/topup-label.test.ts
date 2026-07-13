import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

import { topUpMethodLabel, GENERIC_TOPUP_LABEL } from '../topup-label';

const FORBIDDEN = ['simulated', 'fake', 'mock', 'demo'];

describe('topUpMethodLabel', () => {
  it('maps the three known sources to their exact labels', () => {
    expect(topUpMethodLabel('gcash')).toBe('Top-up via GCash');
    expect(topUpMethodLabel('instapay')).toBe('Top-up via InstaPay');
    expect(topUpMethodLabel('freighter')).toBe('Top-up via Freighter Wallet');
  });

  it('is case-insensitive for known sources', () => {
    expect(topUpMethodLabel('GCash')).toBe('Top-up via GCash');
    expect(topUpMethodLabel('  INSTAPAY ')).toBe('Top-up via InstaPay');
  });

  it('falls back to a generic label for null/undefined', () => {
    expect(topUpMethodLabel(null)).toBe(GENERIC_TOPUP_LABEL);
    expect(topUpMethodLabel(undefined)).toBe(GENERIC_TOPUP_LABEL);
  });

  // Feature: reliable-traceable-transactions, Property 3: Top-up method label
  // is total and safe. (minimum 100 iterations)
  it('Property 3: is total and never emits forbidden words', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constantFrom('gcash', 'instapay', 'freighter'),
          fc.constant(null),
          fc.string(),
        ),
        source => {
          const label = topUpMethodLabel(source as string | null);
          // Total: always a non-empty string.
          expect(typeof label).toBe('string');
          expect(label.length).toBeGreaterThan(0);
          // Known sources map to their label; everything else is generic.
          const key = (source ?? '').toString().trim().toLowerCase();
          if (key === 'gcash') expect(label).toBe('Top-up via GCash');
          else if (key === 'instapay') expect(label).toBe('Top-up via InstaPay');
          else if (key === 'freighter') expect(label).toBe('Top-up via Freighter Wallet');
          else expect(label).toBe(GENERIC_TOPUP_LABEL);
          // Safe: never contains a forbidden word.
          const lower = label.toLowerCase();
          for (const word of FORBIDDEN) expect(lower.includes(word)).toBe(false);
        },
      ),
      { numRuns: 200 },
    );
  });
});
