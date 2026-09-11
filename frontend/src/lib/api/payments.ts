import { apiRequest } from "@/lib/api/client";

/**
 * Vendor payout/payment setup API client.
 * Contract (backend authoritative — vendorRoutes.js payment-setup/verify handlers):
 *   PATCH /vendors/payment-setup        VENDOR auth
 *   POST   /vendors/payment-account/verify  VENDOR auth
 *   body: { bankAccount, bankCode, contactName? }
 *   required: bankAccount (10-digit NUBAN), bankCode (Paystack settlement bank code)
 *   business name/email/phone are auto-sourced by the backend from the vendor.
 * The verify endpoint only resolves the registered account name — it never
 * creates a subaccount. Setup is the only call that mints the Paystack
 * subaccount, and only with the exact verified bank/account combination.
 */

export interface VendorPaymentSetupPayload {
  bankAccount: string;
  bankCode: string;
}

export interface VendorVerifyPaymentPayload {
  bankAccount: string;
  bankCode: string;
}

/**
 * Curated subset of common Nigerian banks with their Paystack settlement bank
 * codes. Intentionally NOT a full bank registry (that belongs to Paystack's
 * bank-directory endpoint); this keeps a non-technical vendor from ever seeing
 * a raw Paystack code while the endpoint stays unchanged.
 */
export const NIGERIAN_PAYSTACK_BANKS: ReadonlyArray<{
  name: string;
  code: string;
}> = [
  { name: "Access Bank", code: "044" },
  { name: "Access Bank (Diamond)", code: "063" },
  { name: "Ecobank Nigeria", code: "050" },
  { name: "Fidelity Bank", code: "070" },
  { name: "First Bank of Nigeria", code: "011" },
  { name: "First City Monument Bank (FCMB)", code: "214" },
  { name: "Guaranty Trust Bank (GTBank)", code: "058" },
  { name: "Jaiz Bank", code: "301" },
  { name: "Keystone Bank", code: "082" },
  { name: "Kuda Microfinance Bank", code: "50211" },
  { name: "Moniepoint Microfinance Bank", code: "50515" },
  { name: "Polaris Bank", code: "076" },
  { name: "Stanbic IBTC Bank", code: "221" },
  { name: "Sterling Bank", code: "232" },
  { name: "United Bank for Africa (UBA)", code: "033" },
  { name: "Union Bank of Nigeria", code: "032" },
  { name: "Unity Bank", code: "215" },
  { name: "Wema Bank", code: "035" },
  { name: "Zenith Bank", code: "057" },
];

async function parseBackendError(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const data = (await response.json()) as {
      error?: unknown;
      message?: unknown;
    };
    if (typeof data.error === "string" && data.error) return data.error;
    if (typeof data.message === "string" && data.message) return data.message;
  } catch {
    // fall through to the generic message when the body is not JSON
  }
  return fallback;
}

export async function setupVendorPayment(
  payload: VendorPaymentSetupPayload,
): Promise<void> {
  const response = await apiRequest("/vendors/payment-setup", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const backendError = await parseBackendError(
      response,
      "Could not complete payment setup. Please try again.",
    );
    // A failed Paystack sub-account creation surfaces a safe, human-readable
    // message; the raw axios "Request failed with status code xxx" detail adds
    // no actionable value for the vendor.
    throw new Error(
      backendError === "Failed to create Paystack sub-account"
        ? "Paystack couldn't create your payout account. Check your account number and bank, then try again."
        : backendError,
    );
  }
}

/**
 * Resolves the registered account name for a bank account without creating a
 * subaccount or touching vendor state. The returned account name must be shown
 * to the vendor for confirmation BEFORE setup is allowed to mint the
 * subaccount; frontend binding means only that exact bank/account pairing can
 * proceed to PATCH /vendors/payment-setup.
 */
export async function verifyVendorPaymentAccount(
  payload: VendorVerifyPaymentPayload,
): Promise<{ accountName: string }> {
  const response = await apiRequest("/vendors/payment-account/verify", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const backendError = await parseBackendError(
      response,
      "Account verification is temporarily unavailable. Please try again.",
    );
    throw new Error(backendError);
  }
  const data = (await response.json()) as {
    success?: unknown;
    accountName?: unknown;
  };
  if (!data.success || typeof data.accountName !== "string" || !data.accountName) {
    throw new Error(
      "Account verification is temporarily unavailable. Please try again.",
    );
  }
  return { accountName: data.accountName };
}