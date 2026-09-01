/**
 * Display helper for Nigerian Naira amounts. Purely presentational — the
 * backend remains authoritative for every price, fee, and total.
 */
export function formatNaira(amount: number): string {
  return `₦${Math.round(amount).toLocaleString("en-NG")}`;
}