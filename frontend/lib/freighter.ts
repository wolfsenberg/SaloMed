// Dynamic imports keep this module off the server bundle entirely.
// @stellar/freighter-api reads `window` at load time — a static import crashes SSR.

type FreighterApi = typeof import('@stellar/freighter-api');

async function api(): Promise<FreighterApi | null> {
  if (typeof window === 'undefined') return null;
  try {
    return await import('@stellar/freighter-api');
  } catch (e) {
    console.error('[Freighter] import failed:', e);
    return null;
  }
}

function extractAddress(res: unknown): string | null {
  if (!res || typeof res !== 'object') return null;
  const r = res as Record<string, unknown>;
  if (r.error) { console.warn('[Freighter] error in response:', r.error); return null; }
  const addr = r.address;
  if (typeof addr === 'string' && addr.startsWith('G') && addr.length === 56) return addr;
  return null;
}

// Opens the Freighter extension popup. Throws a readable message on failure.
export async function connectWallet(): Promise<string | null> {
  const f = await api();
  if (!f) throw new Error('Freighter extension not found — install it from freighter.app then refresh.');
  // requestAccess directly opens the popup — no isConnected pre-check needed.
  // isConnected() only tells us if the extension is installed, not if it has
  // granted access, and checking it first can incorrectly block the popup.
  const res = await f.requestAccess();
  const addr = extractAddress(res);
  if (!addr) throw new Error('Freighter connection was rejected or returned no address.');
  return addr;
}

export async function signTransaction(xdr: string): Promise<string | null> {
  const f = await api();
  if (!f) { console.error('[Freighter] extension not found'); return null; }
  try {
    const result = await f.signTransaction(xdr, {
      networkPassphrase: process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ?? 'Test SDF Network ; September 2015',
    });
    if (!result || (result as Record<string, unknown>).error) {
      console.error('[Freighter] sign error:', (result as Record<string, unknown>)?.error);
      return null;
    }
    return (result as { signedTxXdr: string }).signedTxXdr ?? null;
  } catch (e) {
    console.error('[Freighter] signTransaction error:', e);
    return null;
  }
}

export async function isFreighterInstalled(): Promise<boolean> {
  const f = await api();
  if (!f) return false;
  try {
    const conn = await f.isConnected();
    return typeof conn === 'boolean' ? conn : (conn as { isConnected: boolean }).isConnected;
  } catch {
    return false;
  }
}

export async function getAddress(): Promise<string | null> {
  const f = await api();
  if (!f) return null;
  try {
    // isConnected shape differs between v5 (boolean) and v6 ({ isConnected: boolean })
    const conn = await f.isConnected();
    const isConn = typeof conn === 'boolean' ? conn : (conn as { isConnected: boolean }).isConnected;
    if (!isConn) return null;
    return extractAddress(await f.getAddress());
  } catch (e) {
    console.error('[Freighter] getAddress error:', e);
    return null;
  }
}
