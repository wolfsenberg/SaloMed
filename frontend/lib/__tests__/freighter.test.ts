import { afterEach, describe, expect, it, vi } from 'vitest';

const STELLAR_ADDRESS = 'G'.padEnd(56, 'A');

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (globalThis as any).window;
});

async function loadFreighter(mockApi: Record<string, unknown>) {
  vi.doMock('@stellar/freighter-api', () => mockApi);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).window = {};
  return import('../freighter');
}

describe('connectWallet', () => {
  it('rejects instead of hanging when Freighter never answers the access request', async () => {
    const { connectWallet } = await loadFreighter({
      requestAccess: vi.fn(() => new Promise(() => {})),
      getAddress: vi.fn(),
    });

    const result = await Promise.race([
      connectWallet(10)
        .then(() => 'connected')
        .catch(error => error instanceof Error ? error.message : String(error)),
      new Promise(resolve => setTimeout(() => resolve('still waiting'), 100)),
    ]);

    expect(result).toMatch(/did not respond/i);
  });

  it('uses getAddress when requestAccess grants access without returning the address', async () => {
    const { connectWallet } = await loadFreighter({
      requestAccess: vi.fn(async () => ({ isAllowed: true })),
      getAddress: vi.fn(async () => ({ address: STELLAR_ADDRESS })),
    });

    await expect(connectWallet()).resolves.toBe(STELLAR_ADDRESS);
  });

  it('surfaces the Freighter rejection reason instead of replacing it with a generic no-address error', async () => {
    const getAddress = vi.fn();
    const { connectWallet } = await loadFreighter({
      requestAccess: vi.fn(async () => ({
        address: '',
        error: { message: 'User rejected access' },
      })),
      getAddress,
    });

    await expect(connectWallet()).rejects.toThrow('Freighter: User rejected access');
    expect(getAddress).not.toHaveBeenCalled();
  });
});
