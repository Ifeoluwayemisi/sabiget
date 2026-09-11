"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Banknote,
  Landmark,
  Hash,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import {
  NIGERIAN_PAYSTACK_BANKS,
  type VendorPaymentSetupPayload,
  type VendorVerifyPaymentPayload,
} from "@/lib/api/payments";

const modalVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { type: "spring", stiffness: 300, damping: 30 },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.2 },
  },
};

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const inputClasses =
  "w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 outline-none transition-colors focus:border-orange-500 focus:ring-2 focus:ring-orange-100";

interface PaymentSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Verifies the bank account against Paystack (backend) and returns the
   * registered account name. Never creates a subaccount on its own.
   */
  onVerify: (payload: VendorVerifyPaymentPayload) => Promise<string>;
  /** Performs the setup API call + reconciliation and throws on failure. */
  onSubmit: (payload: VendorPaymentSetupPayload) => Promise<void>;
}

/**
 * Two-stage payout setup:
 *   1. Select bank + account → "Verify account" (backend resolves the name).
 *   2. Confirmation shows the resolved account name → "Confirm & connect"
 *      (the ONLY path that mints the Paystack subaccount).
 * The confirmation stage only accepts the exact verified bank/account pairing:
 * any edit to either field falls back to stage 1 with values preserved, so a
 * previously verified name can never be submitted against changed details.
 */
export default function PaymentSetupModal({
  isOpen,
  onClose,
  onVerify,
  onSubmit,
}: PaymentSetupModalProps) {
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [verified, setVerified] = useState<{
    bankCode: string;
    bankAccount: string;
    accountName: string;
  } | null>(null);

  // Reset the form every time the modal opens so a previous session's values
  // never leak into the next attempt (same render-time reset pattern used by
  // the product form and auth modal).
  const [prevOpen, setPrevOpen] = useState(isOpen);
  if (prevOpen !== isOpen) {
    setPrevOpen(isOpen);
    if (isOpen) {
      setError(null);
      setVerifying(false);
      setSubmitting(false);
      setVerified(null);
      setBankCode("");
      setAccountNumber("");
    }
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // The confirmation stage is only shown while the fields still match the
  // exact combination that was verified; editing either field falls back to
  // the form stage without destroying the entered values.
  const showConfirm =
    verified !== null &&
    verified.bankCode === bankCode &&
    verified.bankAccount === accountNumber;

  const busy = verifying || submitting;

  const selectedBank = NIGERIAN_PAYSTACK_BANKS.find(
    (bank) => bank.code === bankCode,
  );

  const handleVerify = async () => {
    if (!bankCode) {
      setError("Select the bank the payout account belongs to.");
      return;
    }

    if (!/^\d{10}$/.test(accountNumber)) {
      setError("Account number must be exactly 10 digits.");
      return;
    }

    setVerifying(true);
    setError(null);

    try {
      const accountName = await onVerify({
        bankAccount: accountNumber,
        bankCode,
      });
      setVerified({ bankCode, bankAccount: accountNumber, accountName });
    } catch (verifyError) {
      // The verification endpoint never mints a subaccount, so a failure here
      // is always safe to retry from the form with the values preserved.
      setError(
        verifyError instanceof Error
          ? verifyError.message
          : "Account verification is temporarily unavailable. Please try again.",
      );
    } finally {
      setVerifying(false);
    }
  };

  const handleConfirm = async () => {
    if (!showConfirm || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      // Submit the exact verified pairing — never whatever happens to sit in
      // the inputs at this moment.
      await onSubmit({
        bankAccount: verified.bankAccount,
        bankCode: verified.bankCode,
      });
      onClose();
    } catch (submitError) {
      // Keep the verified details on screen so the vendor can retry the
      // connect without re-verifying, but never report a false success.
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not save your payout details. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/50"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={() => {
              if (!busy) onClose();
            }}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-setup-title"
            className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[92%] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-500">
                  Payout setup
                </p>
                <h2
                  id="payment-setup-title"
                  className="mt-1 text-2xl font-bold text-gray-900"
                >
                  {showConfirm
                    ? "Confirm your payout account"
                    : "Connect your bank account"}
                </h2>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                disabled={busy}
                className="rounded-full p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {showConfirm ? (
              <section aria-label="Verified account confirmation">
                <div className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white">
                    <CheckCircle2 className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-emerald-900">
                      Account verified
                    </p>
                    <p className="mt-0.5 break-words text-base font-bold text-gray-900">
                      {verified.accountName}
                    </p>
                    <p className="mt-1 text-sm text-emerald-700">
                      {selectedBank?.name ?? "Selected bank"} ·{" "}
                      <span aria-label={`Account ending ${verified.bankAccount.slice(-4)}`}>
                        ••••••{verified.bankAccount.slice(-4)}
                      </span>
                    </p>
                  </div>
                </div>

                <p className="mt-4 text-sm text-gray-600">
                  Is this the correct account for SabiGet to pay you into? Once
                  you confirm, this is the only payout account connected to
                  your store.
                </p>

                {error && (
                  <div
                    role="alert"
                    className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                  >
                    {error}
                  </div>
                )}

                <div className="mt-5 flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setVerified(null);
                    }}
                    disabled={busy}
                    className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Change details
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleConfirm()}
                    disabled={busy}
                    className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-600 disabled:bg-gray-300"
                  >
                    {submitting && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    {submitting ? "Connecting..." : "Confirm & connect"}
                  </button>
                </div>
              </section>
            ) : (
              <form
                className="mt-5 space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleVerify();
                }}
              >
                <p className="text-sm text-gray-500">
                  We will verify your bank details first, then connect your
                  payout account so SabiGet can process orders for your store.
                </p>

                <div>
                  <label
                    htmlFor="payout-bank"
                    className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-gray-700"
                  >
                    <Landmark className="h-4 w-4 text-orange-500" />
                    Bank
                  </label>
                  <select
                    id="payout-bank"
                    value={bankCode}
                    onChange={(event) => setBankCode(event.target.value)}
                    disabled={busy}
                    className={`${inputClasses} appearance-none bg-white`}
                  >
                    <option value="">Select your bank</option>
                    {NIGERIAN_PAYSTACK_BANKS.map((bank) => (
                      <option key={bank.code} value={bank.code}>
                        {bank.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="payout-account"
                    className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-gray-700"
                  >
                    <Hash className="h-4 w-4 text-orange-500" />
                    Account number
                  </label>
                  <input
                    id="payout-account"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{10}"
                    maxLength={10}
                    value={accountNumber}
                    onChange={(event) =>
                      setAccountNumber(
                        event.target.value.replace(/[^0-9]/g, "").slice(0, 10),
                      )
                    }
                    placeholder="10-digit account number"
                    autoComplete="off"
                    disabled={busy}
                    className={inputClasses}
                  />
                </div>

                <div className="flex items-start gap-2 rounded-xl bg-gray-50 px-3 py-2.5 text-xs text-gray-500">
                  <Banknote className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                  <span>
                    Your store name and contact details are already on file with
                    SabiGet. You will only ever be asked for payout bank details
                    — never Paystack API keys or card information.
                  </span>
                </div>

                {error && (
                  <div
                    role="alert"
                    className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                  >
                    {error}
                  </div>
                )}

                <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={busy}
                    className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={
                      verifying ||
                      !bankCode ||
                      !/^\d{10}$/.test(accountNumber)
                    }
                    className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-600 disabled:bg-gray-300"
                  >
                    {verifying && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    {verifying ? "Verifying..." : "Verify account"}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}