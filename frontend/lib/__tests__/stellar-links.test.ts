import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

import { explorerTxUrl, isRealTxHash } from '../stellar-links';

const hexHash = fc.string({ minLength: 64, maxLength: 64 }).filter(s => /^[0-9a-fA-F]{64}$/.test(s));
const realHash = fc.hexaString({ minLength: 64, maxLength: 64 });

describe('explorerTxUrl / isRealTxHash', () => {
  it('returns empty string for non-hash identifiers', () => {
    expect(explorerTxUrl('DEMO-ABC123')).toBe('');
    expect(explorerTxUrl('')).toBe('');
    expect(explorerTxUrl('xyz')).toBe('');
  });

  it('builds a testnet or public explorer url for a real hash', () => {
    const h = 'a'.repeat(64);
    expect(explorerTxUrl(h, 'testnet')).toBe(`https://stellar.expert/explorer/testnet/tx/${h}`);
    expect(explorerTxUrl(h, 'public')).toBe(`https://stellar.expert/explorer/public/tx/${h}`);
  });

  // Feature: reliable-traceable-transactions, Property 4: Verify link validity
  // and network correctness. (minimum 100 iterations)
  it('Property 4: non-empty url iff real hash, with correct network segment', () => {
    fc.assert(
      fc.property(
        fc.oneof(realHash, fc.string(), fc.constant('DEMO-1'), fc.constant('')),
        fc.constantFrom('testnet', 'public') as fc.Arbitrary<'testnet' | 'public'>,
        (value, kind) => {
          const url = explorerTxUrl(value, kind);
          if (isRealTxHash(value)) {
            expect(url).toBe(`https://stellar.expert/explorer/${kind}/tx/${value.trim()}`);
            expect(url).toContain(`/explorer/${kind}/tx/`);
          } else {
            expect(url).toBe('');
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
