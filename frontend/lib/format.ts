/**
 * SaloMed display formatting helpers.
 *
 * Single source of truth for how monetary values appear in the UI. These are
 * DISPLAY ONLY and must never be used to derive on-chain values (stroops,
 * contract-call arguments, idempotency keys). On-chain precision stays at 7
 * decimals; the UI shows a clean maximum of 2 decimals.
 */

function toFiniteNumber(value: number | string): number {
  const n = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

/** Philippine Peso: exactly 2 decimals with thousands separators -> "1,250.00". */
export function fmtPhp(value: number | string): string {
  return toFiniteNumber(value).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Vault asset (USDC): exactly 2 decimals -> "22.32", "0.00". */
export function fmtAsset(value: number | string): string {
  return toFiniteNumber(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Native XLM: same 2-decimal rule as the vault asset. */
export function fmtXlm(value: number | string): string {
  return fmtAsset(value);
}

/** Convenience: "22.32 USDC". */
export function fmtAssetWithCode(value: number | string, code = 'USDC'): string {
  return `${fmtAsset(value)} ${code}`;
}
