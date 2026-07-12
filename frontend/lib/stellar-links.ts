/**
 * Stellar Explorer link helpers.
 *
 * Every SaloMed transaction shown in the app is a real on-chain Stellar
 * transaction. These helpers build the correct public Stellar Explorer URL for
 * the active network so users can independently verify activity, and provide a
 * clear Testnet / Mainnet distinction badge label.
 */

import { STELLAR_NETWORK_KIND } from './config';

export type StellarNetworkKind = 'testnet' | 'public';

export const NETWORK_KIND: StellarNetworkKind = STELLAR_NETWORK_KIND;

const EXPLORER_BASE = 'https://stellar.expert/explorer';
const TX_HASH_RE = /^[0-9a-fA-F]{64}$/;

/** True only for a genuine 64-char hex Stellar transaction hash. */
export function isRealTxHash(value: string | null | undefined): boolean {
  return typeof value === 'string' && TX_HASH_RE.test(value.trim());
}

/**
 * Explorer URL for a transaction hash. Returns '' for anything that is not a
 * real on-chain hash (e.g. legacy off-chain identifiers), so callers can fall
 * back to plain text instead of rendering a dead link.
 */
export function explorerTxUrl(txHash: string, kind: StellarNetworkKind = NETWORK_KIND): string {
  if (!isRealTxHash(txHash)) return '';
  return `${EXPLORER_BASE}/${kind}/tx/${txHash.trim()}`;
}

export function explorerAccountUrl(address: string, kind: StellarNetworkKind = NETWORK_KIND): string {
  return `${EXPLORER_BASE}/${kind}/account/${address}`;
}

export function explorerContractUrl(contractId: string, kind: StellarNetworkKind = NETWORK_KIND): string {
  return `${EXPLORER_BASE}/${kind}/contract/${contractId}`;
}

/** UI badge text: "Testnet" | "Mainnet". */
export function networkBadgeLabel(kind: StellarNetworkKind = NETWORK_KIND): string {
  return kind === 'public' ? 'Mainnet' : 'Testnet';
}
