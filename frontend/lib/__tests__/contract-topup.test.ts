import { afterEach, describe, expect, it, vi } from 'vitest';

const demoTopUp = vi.fn(async () => 'DEMO-TX');

vi.mock('../runtime', () => ({
  contractDeposit: vi.fn(),
  contractPayment: vi.fn(),
  contractVaultTransfer: vi.fn(),
  demoPayment: vi.fn(),
  demoRemittance: vi.fn(),
  demoTopUp,
  getRuntimeStatus: vi.fn(async () => ({ php_per_asset: '11.34' })),
  getRuntimeVault: vi.fn(),
}));

afterEach(() => {
  demoTopUp.mockClear();
});

describe('depositToVault', () => {
  it('uses the original PHP amount when provided instead of deriving PHP from rounded XLM', async () => {
    const { depositToVault } = await import('../contract');

    await depositToVault('G'.padEnd(56, 'A'), 87.64, 'gcash', 1000);

    expect(demoTopUp).toHaveBeenCalledWith('G'.padEnd(56, 'A'), 1000, 'gcash');
  });
});
