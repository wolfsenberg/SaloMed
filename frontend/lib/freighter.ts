// Dynamic imports keep this module off the server bundle entirely.
// @stellar/freighter-api reads `window` at load time — a static import crashes SSR.

type FreighterApi = typeof import('@stellar/freighter-api');

let apiPromise: Promise<FreighterApi | null> | null = null;
let lastKnownAddress: string | null = null;
const FREIGHTER_REQUEST_TIMEOUT_MS = 5_000;

async function api(): Promise<FreighterApi | null> {
  if (typeof window === 'undefined') return null;
  if (apiPromise) return apiPromise;
  apiPromise = import('@stellar/freighter-api')
    .catch(e => {
      console.error('[Freighter] import failed:', e);
      apiPromise = null;
      return null;
    });
  return apiPromise;
}

export function preloadFreighter(): void {
  try {
    void api();
  } catch {
    // Best-effort warmup only.
  }
}

function isStellarAddress(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('G') && value.length === 56;
}

function extractAddress(res: unknown): string | null {
  if (isStellarAddress(res)) return res;
  if (!res || typeof res !== 'object') return null;
  const r = res as Record<string, unknown>;
  const candidates = [
    r.address,
    r.publicKey,
    r.public_key,
    r.account,
    r.accountId,
    r.account_id,
  ];
  for (const candidate of candidates) {
    if (isStellarAddress(candidate)) return candidate;
  }
  return null;
}

function freighterErrorMessage(res: unknown): string | null {
  if (!res || typeof res !== 'object') return null;
  const error = (res as Record<string, unknown>).error;
  if (!error) return null;
  if (typeof error === 'string') return error;
  if (typeof error !== 'object') return JSON.stringify(error);

  const fields = error as Record<string, unknown>;
  if (typeof fields.message === 'string') return fields.message;
  if (typeof fields.title === 'string') return fields.title;
  return JSON.stringify(error);
}

function throwFreighterError(res: unknown): void {
  const message = freighterErrorMessage(res);
  if (message) throw new Error(`Freighter: ${message}`);
}

function rememberAddress(address: string | null): string | null {
  lastKnownAddress = address ? address.toUpperCase() : null;
  return lastKnownAddress;
}

async function withFreighterTimeout<T>(
  operation: Promise<T>,
  message = 'Freighter did not respond. Unlock it, approve the popup, then try again.',
  timeoutMs = FREIGHTER_REQUEST_TIMEOUT_MS,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

// Opens the Freighter extension popup. Throws a readable message on failure.
export async function connectWallet(timeoutMs = FREIGHTER_REQUEST_TIMEOUT_MS): Promise<string | null> {
  const f = await api();
  if (!f) throw new Error('Freighter extension not found — install it from freighter.app then refresh.');
  // requestAccess directly opens the popup — no isConnected pre-check needed.
  // isConnected() only tells us if the extension is installed, not if it has
  // granted access, and checking it first can incorrectly block the popup.
  const res = await withFreighterTimeout(f.requestAccess(), undefined, timeoutMs);
  throwFreighterError(res);
  let addr = extractAddress(res);
  if (!addr) {
    // Freighter versions differ: some approval responses are only an access
    // flag, with the address available through a follow-up getAddress call.
    const addressRes = await withFreighterTimeout(f.getAddress(), undefined, timeoutMs);
    throwFreighterError(addressRes);
    addr = extractAddress(addressRes);
  }
  if (!addr) {
    throw new Error('Freighter approved access but returned no address. Make sure an account is selected and unlocked.');
  }
  return rememberAddress(addr);
}

export async function signTransaction(xdr: string, signerAddress?: string): Promise<string | null> {
  const f = await api();
  if (!f) throw new Error('Freighter extension not found. Install it from freighter.app and refresh.');

  const passphrase = process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ?? 'Test SDF Network ; September 2015';
  if (signerAddress && lastKnownAddress && lastKnownAddress !== signerAddress.toUpperCase()) {
    throw new Error('Freighter active account changed. Reconnect your wallet so SaloMed uses the current address.');
  }

  // signTransaction itself triggers the Freighter approval popup. We pass the
  // signer address (when known) so the extension targets the right account.
  // No extra requestAccess/getAddress round-trips here: the wallet is already
  // connected before any signing flow, so those only added latency.
  const result = await f.signTransaction(xdr, {
    networkPassphrase: passphrase,
    ...(signerAddress ? { address: signerAddress } : {}),
  });

  const err = (result as Record<string, unknown>)?.error;
  if (err) {
    const msg = typeof err === 'string' ? err : (err as { message?: string })?.message ?? JSON.stringify(err);
    throw new Error(`Freighter: ${msg}`);
  }
  const signed = (result as { signedTxXdr?: string })?.signedTxXdr;
  if (!signed) throw new Error('Freighter returned no signed transaction. Is it set to Testnet and unlocked?');
  return signed;
}

export async function isFreighterInstalled(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const check = async (): Promise<boolean> => {
    const f = await api();
    if (!f) return false;
    try {
      const conn = await f.isConnected();
      return typeof conn === 'boolean' ? conn : (conn as { isConnected: boolean }).isConnected;
    } catch {
      return false;
    }
  };

  // First attempt immediately
  if (await check()) return true;

  // Extension content-scripts load asynchronously — retry once after a delay
  await new Promise(r => setTimeout(r, 1200));
  return check();
}

export async function getAddress(): Promise<string | null> {
  const f = await api();
  if (!f) return rememberAddress(null);
  try {
    // isConnected shape differs between v5 (boolean) and v6 ({ isConnected: boolean })
    const conn = await f.isConnected();
    const isConn = typeof conn === 'boolean' ? conn : (conn as { isConnected: boolean }).isConnected;
    if (!isConn) return rememberAddress(null);
    return rememberAddress(extractAddress(await f.getAddress()));
  } catch (e) {
    console.error('[Freighter] getAddress error:', e);
    rememberAddress(null);
    return null;
  }
}
