/**
 * Display-only service fee mirror.
 *
 * IMPORTANT: This is presentational. The backend recalculates the
 * authoritative order amount (foodCost + serviceFee + platformFee), so the
 * estimate below must never be treated as the payable total. It exists only
 * so the cart/checkout UI can show a friendly figure before checkout.
 */

export const SERVICE_FEE_NAIRA = 500;

/** Estimated total for display: subtotal + service fee when anything is in the cart. */
export function estimateTotal(subtotal: number): number {
  return subtotal > 0 ? subtotal + SERVICE_FEE_NAIRA : 0;
}