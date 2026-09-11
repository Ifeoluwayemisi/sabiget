import Link from "next/link";
import {
  AlertTriangle,
  Clock3,
  Pencil,
  ShieldCheck,
} from "lucide-react";
import type { VendorProfile } from "@/lib/api/vendorProfile";
import { getVendorSetupState } from "@/lib/vendorSetup";

/**
 * Single source of the store status copy shown to vendors (onboarding,
 * dashboard overview, and the Store section). Verification is an admin
 * action, never a vendor-completed step, so the pending message says exactly
 * that instead of asking the vendor to "complete verification".
 */
export default function StoreStatusBanner({
  profile,
}: {
  profile: VendorProfile;
}) {
  const state = getVendorSetupState(profile);

  if (state.phase === "suspended") {
    return (
      <div
        role="alert"
        className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
      >
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Your store is currently inactive. Contact SabiGet support to
          reactivate it.
        </span>
      </div>
    );
  }

  if (state.phase === "pending") {
    return (
      <div
        role="alert"
        className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
      >
        <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Your store setup is complete. An admin needs to verify your business
          before customers can discover your store. Nothing is lost — your
          setup is saved.
        </span>
      </div>
    );
  }

  if (state.phase === "onboarding") {
    return (
      <div className="flex items-start justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
        <div className="flex items-start gap-2">
          <Pencil className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            You&apos;re verified. Finish the remaining setup steps so your store
            is ready for nearby customers.
          </span>
        </div>
        <Link
          href="/vendor/onboarding"
          className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white"
        >
          Continue setup
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        Store setup complete — your store is ready and discoverable for nearby
        customers. New orders will appear on your dashboard.
      </span>
    </div>
  );
}