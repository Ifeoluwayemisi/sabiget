"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Wallet } from "lucide-react";
import { setupVendorPayment, verifyVendorPaymentAccount } from "@/lib/api/payments";
import PaymentSetupModal from "@/features/vendor/PaymentSetupModal";

interface PaymentSetupSectionProps {
  /** Authoritative status from the backend dashboard stats payload. */
  configured: boolean;
  /** Parent refetches vendor state after a successful setup. */
  onSetupComplete: () => Promise<void>;
}

export default function PaymentSetupSection({
  configured,
  onSetupComplete,
}: PaymentSetupSectionProps) {
  const [showModal, setShowModal] = useState(false);

  // Resolves the registered account name via the verify-only backend endpoint.
  // It never creates a subaccount; the modal shows this name for confirmation
  // before setup is ever allowed to run.
  const handleVerify = async (payload: Parameters<typeof verifyVendorPaymentAccount>[0]) => {
    const { accountName } = await verifyVendorPaymentAccount(payload);
    return accountName;
  };

  // Runs the Paystack setup, then asks the parent to reconcile from the
  // backend before the modal reports success. Throws on failure so the modal
  // keeps the confirmation stage open for a safe retry.
  const handleSubmit = async (payload: Parameters<typeof setupVendorPayment>[0]) => {
    await setupVendorPayment(payload);
    await onSetupComplete();
  };

  if (configured) {
    return (
      <motion.section
        aria-label="Payment setup"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white">
            <CheckCircle2 className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-bold text-emerald-900">
              Paystack setup: Connected
            </p>
            <p className="mt-0.5 text-sm text-emerald-700">
              Your payout account is connected. SabiGet can now process orders
              for your store.
            </p>
          </div>
        </div>
      </motion.section>
    );
  }

  return (
    <motion.section
      aria-label="Payment setup"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8 flex flex-col gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white">
          <Wallet className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-bold text-amber-900">
            Paystack setup: Missing
          </p>
          <p className="mt-0.5 text-sm text-amber-800">
            Connect your payout account so SabiGet can process orders for your
            store.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowModal(true)}
        className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-orange-600"
      >
        Set up payments
      </button>

      <PaymentSetupModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onVerify={handleVerify}
        onSubmit={handleSubmit}
      />
    </motion.section>
  );
}