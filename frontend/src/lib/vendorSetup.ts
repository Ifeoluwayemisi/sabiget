import type { VendorProfile } from "@/lib/api/vendorProfile";

/**
 * Vendor store-setup state, derived ONLY from the authoritative backend
 * profile (GET /vendors/me). Used by the onboarding flow, the dashboard, and
 * the store-settings section so the "what counts as setup complete" rule lives
 * in exactly one place.
 *
 * Required setup steps (vendor-completed):
 *   1. Business information
 *   2. Store location
 *   3. Payment account
 *   4. Menu (at least one product)
 *
 * Verification is NOT a vendor step — it requires admin action and is
 * represented by the `phase` ("pending" / "ready").
 */
export const VENDOR_SETUP_STEPS = [
  { key: "business", label: "Business information", detail: "Name and description" },
  { key: "location", label: "Store location", detail: "Coordinates for nearby discovery" },
  { key: "payment", label: "Payment account", detail: "Payout account for orders" },
  { key: "menu", label: "Menu", detail: "Add at least one item" },
] as const;

export type VendorSetupStepKey = (typeof VENDOR_SETUP_STEPS)[number]["key"];

export interface VendorSetupState {
  hasBusinessInfo: boolean;
  hasLocation: boolean;
  hasPayment: boolean;
  hasMenu: boolean;
  completedCount: number;
  requiredCount: number;
  setupComplete: boolean;
  /** Where the vendor belongs in the lifecycle (backend-driven). */
  phase: "suspended" | "onboarding" | "pending" | "ready";
}

export function getVendorSetupState(profile: VendorProfile): VendorSetupState {
  const hasBusinessInfo = Boolean(
    profile.name.trim() && profile.description?.trim(),
  );
  const hasLocation =
    profile.latitude !== null && profile.longitude !== null;
  const hasPayment = profile.paystackConfigured;
  const hasMenu = profile.totalProducts > 0;

  const completedCount = [
    hasBusinessInfo,
    hasLocation,
    hasPayment,
    hasMenu,
  ].filter(Boolean).length;
  const requiredCount = 4;
  const setupComplete = completedCount === requiredCount;

  let phase: VendorSetupState["phase"];
  if (!profile.isActive) {
    phase = "suspended";
  } else if (!setupComplete) {
    phase = "onboarding";
  } else if (!profile.isVerified) {
    phase = "pending";
  } else {
    phase = "ready";
  }

  return {
    hasBusinessInfo,
    hasLocation,
    hasPayment,
    hasMenu,
    completedCount,
    requiredCount,
    setupComplete,
    phase,
  };
}