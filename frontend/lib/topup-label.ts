/**
 * Top up method label map.
 *
 * Maps the stored `source` of a top up transaction to a user-facing label.
 * The mapping is total (every input yields a label) and safe (a label never
 * contains the words "simulated", "fake", "mock", or "demo").
 */

export const TOPUP_METHOD_LABELS: Readonly<Record<string, string>> = {
  gcash: 'Top up via GCash',
  instapay: 'Top up via InstaPay',
  freighter: 'Top up via Freighter Wallet',
};

/** Generic fallback used for unknown or missing sources. */
export const GENERIC_TOPUP_LABEL = 'Vault top up';

/**
 * Resolve the display label for a top up method source. Returns the mapped
 * label for the three known sources (case-insensitive) and a generic label for
 * null, undefined, or any unknown value.
 */
export function topUpMethodLabel(source: string | null | undefined): string {
  if (!source) return GENERIC_TOPUP_LABEL;
  const key = source.trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(TOPUP_METHOD_LABELS, key)
    ? TOPUP_METHOD_LABELS[key]
    : GENERIC_TOPUP_LABEL;
}
