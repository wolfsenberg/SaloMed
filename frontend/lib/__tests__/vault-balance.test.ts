import { describe, expect, it } from 'vitest';

import { accountingPhpPerXlm, vaultPhpValue } from '../vault-balance';

describe('vault balance display', () => {
  it('uses the backend accounting rate for the primary PHP vault value', () => {
    expect(accountingPhpPerXlm('11.34')).toBe(11.34);
    expect(vaultPhpValue(881_834_215n, '11.34')).toBeCloseTo(1000, 2);
  });

  it('falls back to the configured rate when runtime has not loaded yet', () => {
    expect(accountingPhpPerXlm(null)).toBeGreaterThan(0);
    expect(vaultPhpValue(0n, null)).toBe(0);
  });
});
