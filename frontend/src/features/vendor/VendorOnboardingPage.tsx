"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Loader2,
  Store,
} from "lucide-react";
import {
  fetchVendorProfile,
  type VendorProfile,
} from "@/lib/api/vendorProfile";
import { getAccessToken, subscribeToAuth, clearSession } from "@/lib/api/client";
import {
  getVendorSetupState,
  VENDOR_SETUP_STEPS,
  type VendorSetupStepKey,
} from "@/lib/vendorSetup";
import { BusinessInfoForm, StoreLocationForm } from "@/features/vendor/StoreForms";
import PaymentSetupSection from "@/features/vendor/PaymentSetupSection";
import VendorMenuSection from "@/features/vendor/VendorMenuSection";

/**
 * Dedicated vendor onboarding flow (/vendor/onboarding).
 *
 * A new/incomplete vendor lands here after signup or login instead of being
 * dumped into the normal dashboard. Progress is derived entirely from the
 * backend profile (GET /vendors/me), so leaving and returning never loses
 * completed steps. The four steps are vendor-work; verification is NOT a step
 * (it is an admin action) and is only surfaced on the completion screen.
 *
 * Routing rules live here:
 *   - visiting with a fully-set-up store → dashboard (they do not belong here)
 *   - no/expired token            → sign-in prompt (redirect to /vendor/dashboard)
 */
export default function VendorOnboardingPage() {
  const router = useRouter();
  // The session is deliberately NOT read during the initial render: SSR has no
  // localStorage, so seeding state from it would paint the sign-in gate on the
  // server while an authenticated client paints the loader — a hydration
  // mismatch. Both sides render the neutral loading screen first; the session
  // is resolved after mount (see resolveSession below).
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<VendorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showCompletion, setShowCompletion] = useState(false);

  // React to logout/session changes so a signed-out vendor never stays on a
  // protected page; the dashboard gate becomes the next landing point.
  useEffect(
    () =>
      subscribeToAuth(() => {
        const next = getAccessToken();
        setToken(next);
        if (!next) {
          setLoading(false);
          setProfile(null);
          setShowCompletion(false);
        }
      }),
    [],
  );

  // Post-hydration session resolution: a real token starts the profile load,
  // while a missing one lifts the neutral loader and reveals the sign-in gate.
  useEffect(() => {
    const resolveSession = async () => {
      const next = getAccessToken();
      if (next) {
        setToken(next);
      } else {
        setLoading(false);
      }
    };
    void resolveSession();
  }, []);

  const loadProfile = useCallback(
    async (redirectWhenDone: boolean) => {
      setLoadError(null);
      try {
        const fetched = await fetchVendorProfile();
        const state = getVendorSetupState(fetched);
        // Re-visits once setup is complete belong on the dashboard, not here.
        if (redirectWhenDone && state.setupComplete) {
          router.replace("/vendor/dashboard");
          return;
        }
        setProfile(fetched);
      } catch (loadFailure) {
        // A 401 here means apiRequest already tried refreshing and the
        // session is genuinely dead. The correct landing point is the
        // sign-in gate, never a permanent "store setup unavailable" spinner.
        if ((loadFailure as { status?: number })?.status === 401) {
          clearSession();
          return;
        }
        setLoadError(
          loadFailure instanceof Error
            ? loadFailure.message
            : "Unable to load your store setup.",
        );
      } finally {
        setLoading(false);
      }
    },
    [router],
  );

  useEffect(() => {
    // Load the vendor profile whenever a session exists. The inverted guard
    // would skip the fetch entirely while authenticated, leaving the page
    // stuck on "Loading your store setup..." forever.
    if (!token) return;
    const load = async () => {
      await loadProfile(true);
    };
    void load();
  }, [token, loadProfile]);

  const reloadProfile = useCallback(async () => {
    await loadProfile(false);
  }, [loadProfile]);

  const signedOut = !token;
  if (signedOut && !loading) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-12">
        <div className="mx-auto max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-orange-50 text-orange-500">
            <Store className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-2xl font-black text-gray-900">
            Sign in to set up your store
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Please sign in as a vendor to continue your store setup.
          </p>
          <Link
            href="/vendor/dashboard"
            className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-orange-500 px-6 py-3 text-sm font-bold text-white"
          >
            Go to vendor sign in
          </Link>
        </div>
      </div>
    );
  }

  if (loading && !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="flex items-center gap-2 text-lg font-medium text-gray-600">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading your store setup...
        </div>
      </div>
    );
  }

  if (loadError && !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="max-w-lg rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
          <h2 className="text-xl font-bold">Store setup unavailable</h2>
          <p className="mt-2 text-sm">{loadError}</p>
          <button
            type="button"
            onClick={() => void loadProfile(true)}
            className="mt-4 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  const state = getVendorSetupState(profile);
  const firstIncompleteIndex = Math.min(state.completedCount, 3);
  const currentIndex = Math.min(activeIndex, firstIncompleteIndex);
  const stepCompleteFor = (key: VendorSetupStepKey): boolean => {
    switch (key) {
      case "business":
        return state.hasBusinessInfo;
      case "location":
        return state.hasLocation;
      case "payment":
        return state.hasPayment;
      case "menu":
        return state.hasMenu;
    }
  };

  const goToStep = (index: number) => {
    if (index <= firstIncompleteIndex) setActiveIndex(index);
  };

  const stepPills = VENDOR_SETUP_STEPS.map((step, index) => {
    const complete = stepCompleteFor(step.key);
    const unlocked = index <= firstIncompleteIndex;
    const active = index === currentIndex;
    return (
      <button
        key={step.key}
        type="button"
        onClick={() => goToStep(index)}
        disabled={!unlocked || active}
        className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
          active
            ? "border-orange-500 bg-orange-500 text-white"
            : complete
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : unlocked
                ? "border-gray-300 bg-white text-gray-700"
                : "border-gray-200 bg-gray-50 text-gray-400"
        }`}
      >
        {complete ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <span>{index + 1}</span>
        )}
        {step.label}
      </button>
    );
  });

  const renderStepBody = () => {
    const step = VENDOR_SETUP_STEPS[currentIndex];
    switch (step.key) {
      case "business":
        return (
          <BusinessInfoForm
            key={`business-${profile.id}-${state.completedCount}`}
            profile={profile}
            onSaved={reloadProfile}
          />
        );
      case "location":
        return (
          <StoreLocationForm
            key={`location-${profile.id}-${state.completedCount}`}
            profile={profile}
            onSaved={reloadProfile}
          />
        );
      case "payment":
        return (
          <PaymentSetupSection
            configured={profile.paystackConfigured}
            onSetupComplete={reloadProfile}
          />
        );
      case "menu":
        return <VendorMenuSection />;
    }
  };

  const currentStepComplete = stepCompleteFor(
    VENDOR_SETUP_STEPS[currentIndex].key,
  );

  // Finished the last step → show the verification-pending completion screen.
  if (showCompletion) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-12">
        <div className="mx-auto max-w-md">
          <div className="rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h1 className="mt-5 text-2xl font-black text-gray-900">
              Your store is ready for review
            </h1>
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                Verification status
              </p>
              <p className="mt-1 text-sm font-bold text-amber-800">
                Pending admin verification
              </p>
              <p className="mt-1 text-sm text-amber-800">
                Customers won&apos;t see your store until it has been verified.
                You&apos;ll be able to manage orders and your menu while you
                wait.
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push("/vendor/dashboard")}
              className="mt-6 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold text-white"
            >
              Go to dashboard
            </button>
            <p className="mt-3 text-xs text-gray-400">
              You can always come back until a SabiGet admin verifies your
              store.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-500">
              Vendor onboarding
            </p>
            <h1 className="mt-2 text-2xl font-black text-gray-900">
              Set up your SabiGet store
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Complete these steps to get your store ready.
            </p>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-gray-900">
                {state.completedCount} of {state.requiredCount} completed
              </span>
              <span className="text-gray-500">
                {state.completedCount === state.requiredCount
                  ? "All done"
                  : `${state.requiredCount - state.completedCount} remaining`}
              </span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-orange-500 transition-all"
                style={{
                  width: `${(state.completedCount / state.requiredCount) * 100}%`,
                }}
              />
            </div>
          </div>

          <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
            {stepPills}
          </div>

          <div className="mt-6">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-gray-900">
                Step {currentIndex + 1}: {VENDOR_SETUP_STEPS[currentIndex].label}
              </h2>
              <p className="mt-0.5 text-sm text-gray-500">
                {VENDOR_SETUP_STEPS[currentIndex].detail}
              </p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              {renderStepBody()}
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
              {currentIndex > 0 ? (
                <button
                  type="button"
                  onClick={() => setActiveIndex(currentIndex - 1)}
                  className="inline-flex min-h-[44px] items-center gap-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
              ) : (
                <span />
              )}

              {currentIndex < 3 && (
                <button
                  type="button"
                  onClick={() => setActiveIndex(currentIndex + 1)}
                  disabled={!currentStepComplete}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-bold text-white disabled:bg-gray-300"
                >
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}

              {currentIndex === 3 && (
                <button
                  type="button"
                  onClick={() => setShowCompletion(true)}
                  disabled={!currentStepComplete}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-bold text-white disabled:bg-gray-300"
                >
                  Finish setup
                </button>
              )}
            </div>

            <p className="mt-4 text-center text-xs text-gray-400">
              Your progress saves automatically — you can leave and continue
              later.
            </p>
          </div>
        </div>

        <div className="mt-4 flex justify-center">
          <Link
            href="/vendor/dashboard"
            className="text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}