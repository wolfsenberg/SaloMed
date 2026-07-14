/**
 * Pure pre-sign balance guard.
 *
 * Shared by PaymentTab and RemittanceForm: a payment or padala is blocked when
 * the requested amount exceeds the live on-chain vault balance. Keeping this a
 * pure predicate lets it be property-tested and reused so the vault can never
 * be driven negative and the user is never asked to sign a doomed transaction.
 */

/** True when `amount` exceeds `liveBalance` and the transaction must be blocked. */
export function blocksForInsufficientBalance(amount: number, liveBalance: number): boolean {
  return amount > liveBalance;
}
