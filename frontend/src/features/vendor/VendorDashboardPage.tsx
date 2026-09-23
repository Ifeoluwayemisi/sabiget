"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  LayoutDashboard,
  LogOut,
  ShoppingBag,
  Store,
  UtensilsCrossed,
  Wallet,
  Mail,
  Lock,
  Phone,
  ChevronRight,
} from "lucide-react";
import {
  apiRequest,
  getAccessToken,
  storeAuthPayload,
  subscribeToAuth,
  logout,
} from "@/lib/api/client";
import { closeSocket } from "@/lib/socket";
import {
  fetchVendorProfile,
  type VendorProfile,
} from "@/lib/api/vendorProfile";
import { getVendorSetupState } from "@/lib/vendorSetup";
import { getOrderStatusMeta } from "@/lib/orderStatus";
import VendorOrdersSection from "@/features/vendor/VendorOrdersSection";
import VendorMenuSection from "@/features/vendor/VendorMenuSection";
import PaymentSetupSection from "@/features/vendor/PaymentSetupSection";
import StoreStatusBanner from "@/features/vendor/StoreStatusBanner";
import {
  BusinessInfoForm,
  StoreLocationForm,
} from "@/features/vendor/StoreForms";

interface DashboardStats {
  totalOrders: number;
  pendingOrders: number;
  activeOrders: number;
  completedOrders: number;
  refundedOrders: number;
  cancelledOrders: number;
}

interface RecentOrder {
  id: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  user?: {
    name?: string;
    phone?: string;
  };
  items?: Array<{ id: string; quantity: number; totalPrice: number }>;
}

interface VendorDashboardData {
  vendor: {
    id: string;
    name: string;
    isVerified: boolean;
    isActive: boolean;
    lga: string;
    paystackSubcodeConfigured: boolean;
  };
  orders: DashboardStats;
  earnings: {
    pendingRevenue: number;
    completedRevenue: number;
    refundedAmount: number;
    totalRevenue: number;
  };
  recentOrders: RecentOrder[];
}

type DashboardTab = "overview" | "orders" | "menu" | "payments" | "store";

const NAV_ITEMS: Array<{
  key: DashboardTab;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { key: "overview", label: "Home", icon: LayoutDashboard },
  { key: "orders", label: "Orders", icon: ShoppingBag },
  { key: "menu", label: "Menu", icon: UtensilsCrossed },
  { key: "payments", label: "Payments", icon: Wallet },
  { key: "store", label: "Store", icon: Store },
];

export default function VendorDashboardPage() {
  const router = useRouter();

  // The session is deliberately NOT read during the initial render: SSR has no
  // localStorage, so seeding state from it would paint the sign-in gate on the
  // server while an authenticated client paints the loader — a hydration
  // mismatch. Both sides render the neutral loading screen first; the session
  // is resolved after mount (see resolveSession below).
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<VendorDashboardData | null>(null);
  const [profile, setProfile] = useState<VendorProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");

  // Track auth via the shared client so logging in/out (anywhere) rerenders
  // the gate immediately, rather than reading localStorage once on mount.
  const [token, setToken] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authForm, setAuthForm] = useState({
    email: "",
    password: "",
    businessName: "",
    businessPhone: "",
  });
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);

  useEffect(() => subscribeToAuth(() => setToken(getAccessToken())), []);

  // Post-hydration session resolution: a real token starts the dashboard load,
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

  const handleVendorAuth = async () => {
    const isSignup = authMode === "signup";

    if (!authForm.email || !authForm.password) {
      setAuthError("Email and password are required.");
      return;
    }
    if (isSignup) {
      if (!authForm.businessName.trim() || !authForm.businessPhone.trim()) {
        setAuthError("Business name and phone are required.");
        return;
      }
      if (authForm.password.length < 8) {
        setAuthError("Password must be at least 8 characters.");
        return;
      }
    }

    setAuthSubmitting(true);
    setAuthError(null);

    try {
      const response = await apiRequest(
        isSignup ? "/auth/vendor/signup" : "/auth/vendor/login",
        {
          method: "POST",
          body: JSON.stringify(
            isSignup
              ? {
                  email: authForm.email,
                  password: authForm.password,
                  businessName: authForm.businessName,
                  businessPhone: authForm.businessPhone,
                }
              : {
                  email: authForm.email,
                  password: authForm.password,
                },
          ),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || data.message || "Vendor authentication failed",
        );
      }

      // Vendor sessions have no `user` field in the payload; only the tokens
      // are persisted and the subscription below lifts the gate to dashboard.
      storeAuthPayload({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });
    } catch (authFailure) {
      console.error("Vendor authentication failed:", authFailure);
      setAuthError(
        authFailure instanceof Error
          ? authFailure.message
          : "Vendor authentication failed.",
      );
    } finally {
      setAuthSubmitting(false);
    }
  };

  const fetchDashboard = useCallback(async () => {
    if (!token) {
      setError("Please sign in as a vendor to view this dashboard.");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [statsResponse, vendorProfile] = await Promise.all([
        apiRequest("/vendors/dashboard/stats"),
        fetchVendorProfile(),
      ]);

      const data = await statsResponse.json();

      if (!statsResponse.ok) {
        throw new Error(data.error || "Unable to load vendor dashboard");
      }

      // Route incomplete vendors to onboarding BEFORE any dashboard content is
      // rendered, using backend state (GET /vendors/me). `dashboard` stays
      // null and `loading` stays true, so the neutral loading screen covers
      // the redirect and a fresh signup can never flash the dashboard shell.
      if (!getVendorSetupState(vendorProfile).setupComplete) {
        setProfile(vendorProfile);
        router.replace("/vendor/onboarding");
        return;
      }

      setDashboard(data);
      setProfile(vendorProfile);
      setError(null);
      setLoading(false);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load vendor dashboard.",
      );
      setLoading(false);
    }
  }, [token, router]);

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      await fetchDashboard();
    };
    void load();
  }, [token, fetchDashboard]);

  const reloadProfile = useCallback(async () => {
    try {
      const updated = await fetchVendorProfile();
      setProfile(updated);
    } catch {
      // Non-critical refresh; current profile stays visible on failure.
    }
  }, []);

  const handlePaymentSetupComplete = async () => {
    await reloadProfile();
    await fetchDashboard();
  };

  const handleLogout = async () => {
    await logout();
    closeSocket();
  };

  const statsCard = dashboard
    ? [
        {
          title: "Total orders",
          value: dashboard.orders.totalOrders,
          icon: ShoppingBag,
          accent: "bg-[var(--color-brand)]",
        },
        {
          title: "Active orders",
          value: dashboard.orders.activeOrders,
          icon: Clock3,
          accent: "bg-[#d97706]",
        },
        {
          title: "Completed",
          value: dashboard.orders.completedOrders,
          icon: CheckCircle2,
          accent: "bg-[var(--color-accent)]",
        },
        {
          title: "Revenue",
          value: `₦${dashboard.earnings.totalRevenue.toLocaleString()}`,
          icon: Wallet,
          accent: "bg-[#8b5e34]",
        },
      ]
    : [];

  if (!token && !loading) {
    const isSignup = authMode === "signup";
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4 py-10">
        <div className="sabiget-card w-full max-w-md p-6 sm:p-8">
          <Link
            href="/"
            className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-[var(--color-ink-muted)] hover:text-[var(--color-brand-deep)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to SabiGet
          </Link>

          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-brand-soft)] text-[var(--color-brand)]">
            <Store className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-2xl font-black text-[var(--color-ink)]">
            Vendor dashboard
          </h1>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
            Sign in to manage your store and incoming orders. New businesses can
            create an account below.
          </p>

          <div className="mt-6 flex rounded-2xl bg-[var(--color-surface-muted)] p-1">
            <button
              type="button"
              onClick={() => {
                setAuthMode("signin");
                setAuthError(null);
              }}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                !isSignup
                  ? "bg-white text-[var(--color-ink)] shadow-[var(--shadow-card)]"
                  : "text-[var(--color-ink-muted)]"
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode("signup");
                setAuthError(null);
              }}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                isSignup
                  ? "bg-white text-[var(--color-ink)] shadow-[var(--shadow-card)]"
                  : "text-[var(--color-ink-muted)]"
              }`}
            >
              Create account
            </button>
          </div>

          <div className="mt-6 space-y-4">
            {isSignup && (
              <>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-[var(--color-ink)]">
                    Business name
                  </span>
                  <div className="flex items-center gap-3 rounded-xl border border-[var(--color-line-strong)] bg-[var(--color-surface)] px-3 py-3 focus-within:border-[var(--color-brand)]">
                    <Store className="h-4 w-4 text-[var(--color-ink-muted)]" />
                    <input
                      type="text"
                      value={authForm.businessName}
                      onChange={(event) =>
                        setAuthForm((prev) => ({
                          ...prev,
                          businessName: event.target.value,
                        }))
                      }
                      className="w-full border-0 bg-transparent text-sm outline-none"
                      placeholder="Buka & Flame"
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-[var(--color-ink)]">
                    Business phone
                  </span>
                  <div className="flex items-center gap-3 rounded-xl border border-[var(--color-line-strong)] bg-[var(--color-surface)] px-3 py-3 focus-within:border-[var(--color-brand)]">
                    <Phone className="h-4 w-4 text-[var(--color-ink-muted)]" />
                    <input
                      type="tel"
                      inputMode="tel"
                      value={authForm.businessPhone}
                      onChange={(event) =>
                        setAuthForm((prev) => ({
                          ...prev,
                          businessPhone: event.target.value,
                        }))
                      }
                      className="w-full border-0 bg-transparent text-sm outline-none"
                      placeholder="+2348123456789"
                    />
                  </div>
                </label>
              </>
            )}

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[var(--color-ink)]">
                Email
              </span>
              <div className="flex items-center gap-3 rounded-xl border border-[var(--color-line-strong)] bg-[var(--color-surface)] px-3 py-3 focus-within:border-[var(--color-brand)]">
                <Mail className="h-4 w-4 text-[var(--color-ink-muted)]" />
                <input
                  type="email"
                  autoComplete="email"
                  value={authForm.email}
                  onChange={(event) =>
                    setAuthForm((prev) => ({
                      ...prev,
                      email: event.target.value,
                    }))
                  }
                  className="w-full border-0 bg-transparent text-sm outline-none"
                  placeholder="vendor@business.com"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[var(--color-ink)]">
                Password
              </span>
              <div className="flex items-center gap-3 rounded-xl border border-[var(--color-line-strong)] bg-[var(--color-surface)] px-3 py-3 focus-within:border-[var(--color-brand)]">
                <Lock className="h-4 w-4 text-[var(--color-ink-muted)]" />
                <input
                  type="password"
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  value={authForm.password}
                  onChange={(event) =>
                    setAuthForm((prev) => ({
                      ...prev,
                      password: event.target.value,
                    }))
                  }
                  className="w-full border-0 bg-transparent text-sm outline-none"
                  placeholder="At least 8 characters"
                />
              </div>
            </label>

            {authError && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {authError}
              </div>
            )}

            <button
              onClick={handleVendorAuth}
              disabled={authSubmitting}
              className="sabiget-punch w-full rounded-xl px-4 py-3 text-sm font-bold disabled:bg-[var(--color-line)] disabled:text-[var(--color-ink-muted)]"
            >
              {authSubmitting
                ? "Please wait..."
                : isSignup
                  ? "Create vendor account"
                  : "Sign in to dashboard"}
            </button>

            <p className="text-center text-xs text-[var(--color-ink-muted)]">
              New vendors are taken straight into a guided store setup.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading && !dashboard) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
        <div className="text-lg font-semibold text-[var(--color-ink-muted)]">
          Loading dashboard...
        </div>
      </div>
    );
  }

  if (error && !dashboard) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
        <div className="max-w-lg rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700 shadow-[var(--shadow-card)]">
          <h2 className="text-xl font-bold">Dashboard unavailable</h2>
          <p className="mt-2">{error}</p>
          <button
            type="button"
            onClick={() => void fetchDashboard()}
            className="mt-4 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return null;
  }

  const renderContent = () => {
    switch (activeTab) {
      case "orders":
        return <VendorOrdersSection />;
      case "menu":
        return <VendorMenuSection />;
      case "payments":
        return (
          <PaymentSetupSection
            configured={profile?.paystackConfigured ?? false}
            onSetupComplete={handlePaymentSetupComplete}
          />
        );
      case "store":
        return (
          <div className="space-y-6">
            {profile && <StoreStatusBanner profile={profile} />}
            {profile && (
              <BusinessInfoForm
                key={`business-${profile.name}-${String(profile.description ?? "")}`}
                profile={profile}
                onSaved={reloadProfile}
              />
            )}
            {profile && (
              <StoreLocationForm
                key={`location-${profile.latitude ?? "none"}-${profile.longitude ?? "none"}`}
                profile={profile}
                onSaved={reloadProfile}
              />
            )}
            <div className="flex justify-center border-t border-[var(--color-line)] pt-6">
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="sabiget-outline inline-flex min-h-[44px] items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold"
              >
                <LogOut className="h-4 w-4" />
                Log out of dashboard
              </button>
            </div>
          </div>
        );
      case "overview":
      default: {
        const recentOrders = dashboard.recentOrders.slice(0, 5);
        return (
          <div className="space-y-6">
            {profile && <StoreStatusBanner profile={profile} />}

            <div className="sabiget-panel p-5 sm:p-6">
              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                <div>
                  <p className="sabiget-badge sabiget-badge-brand">
                    Vendor dashboard
                  </p>
                  <h1 className="mt-2 text-2xl font-black text-[var(--color-ink)]">
                    {dashboard.vendor.name}
                  </h1>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`sabiget-badge ${dashboard.vendor.isActive ? "sabiget-badge-accent" : "bg-[var(--color-surface-muted)] text-[var(--color-ink-muted)]"}`}
                  >
                    {dashboard.vendor.isActive ? "Active" : "Inactive"}
                  </span>
                  <span
                    className={`sabiget-badge ${dashboard.vendor.isVerified ? "bg-[#eaf2ff] text-[#285b9a]" : "bg-[#fff4df] text-[#9a5b00]"}`}
                  >
                    {dashboard.vendor.isVerified
                      ? "Verified"
                      : "Pending verification"}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {statsCard.map(({ title, value, icon: Icon, accent }) => (
                <motion.div
                  key={title}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="sabiget-card p-5"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-[var(--color-ink-muted)]">
                        {title}
                      </p>
                      <h3 className="mt-3 text-2xl font-black text-[var(--color-ink)]">
                        {value}
                      </h3>
                    </div>
                    <div
                      className={`${accent} flex h-11 w-11 items-center justify-center rounded-xl text-white`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {(
                [
                  { key: "orders", label: "View orders", icon: ShoppingBag },
                  { key: "menu", label: "Manage menu", icon: UtensilsCrossed },
                  { key: "payments", label: "Payments", icon: Wallet },
                ] as Array<{
                  key: DashboardTab;
                  label: string;
                  icon: typeof ShoppingBag;
                }>
              ).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key)}
                  className="sabiget-card flex items-center justify-between gap-2 p-4 text-left transition-transform hover:-translate-y-0.5 hover:border-[var(--color-brand)]"
                >
                  <span className="flex items-center gap-2.5 text-sm font-semibold text-[var(--color-ink)]">
                    <Icon className="h-4 w-4 text-[var(--color-brand)]" />
                    {label}
                  </span>
                  <ChevronRight className="h-4 w-4 text-[var(--color-ink-muted)]" />
                </button>
              ))}
            </div>

            <section className="sabiget-card p-5 sm:p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-[var(--color-ink)]">
                  Recent orders
                </h2>
                <button
                  type="button"
                  onClick={() => setActiveTab("orders")}
                  className="text-sm font-bold text-[var(--color-brand-deep)]"
                >
                  View all
                </button>
              </div>

              {recentOrders.length === 0 ? (
                <div className="rounded-xl bg-[var(--color-surface-muted)] p-4 text-sm text-[var(--color-ink-muted)]">
                  No orders yet — when customers place orders they&apos;ll show
                  up here.
                </div>
              ) : (
                <div className="space-y-3">
                  {recentOrders.map((order) => {
                    const meta = getOrderStatusMeta(order.status);
                    return (
                      <div
                        key={order.id}
                        className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-[var(--color-ink)]">
                              Order {order.id.slice(0, 8)}
                            </p>
                            <p className="text-xs text-[var(--color-ink-muted)]">
                              {order.user?.name || "Guest customer"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${meta.tone}`}
                            >
                              {meta.label}
                            </span>
                            <span className="text-sm font-bold text-[var(--color-ink)]">
                              ₦{Number(order.totalAmount || 0).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        );
      }
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-[var(--color-line)] bg-[var(--color-surface-strong)] lg:flex">
        <div className="flex items-center gap-2 border-b border-[var(--color-line)] px-6 py-6">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-brand)] text-sm font-black text-white shadow-[var(--shadow-floating)]">
            S
          </span>
          <div>
            <p className="text-sm font-extrabold text-[var(--color-ink)]">
              SabiGet
            </p>
            <p className="text-xs text-[var(--color-ink-muted)]">
              Vendor dashboard
            </p>
          </div>
        </div>

        <nav aria-label="Vendor dashboard sections" className="flex-1 p-4">
          <ul className="space-y-1">
            {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => setActiveTab(key)}
                  className={`flex min-h-[44px] w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                    activeTab === key
                      ? "bg-[var(--color-brand-soft)] text-[var(--color-brand-deep)]"
                      : "text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-muted)]"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t border-[var(--color-line)] p-4">
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="flex min-h-[44px] w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold text-[var(--color-ink-muted)] transition-colors hover:bg-[var(--color-surface-muted)]"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        <main className="px-4 py-6 pb-28 lg:px-8 lg:pb-12">
          <div className="mx-auto max-w-5xl">{renderContent()}</div>
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav
        aria-label="Vendor dashboard sections"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--color-line)] bg-[var(--color-surface-strong)] pb-[calc(0.25rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(55,28,12,0.06)] lg:hidden"
      >
        <ul className="flex items-stretch justify-between px-2 pt-1.5">
          {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
            <li key={key} className="flex-1">
              <button
                type="button"
                onClick={() => setActiveTab(key)}
                aria-current={activeTab === key ? "page" : undefined}
                className={`flex min-h-[52px] w-full flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-semibold ${
                  activeTab === key
                    ? "bg-[var(--color-brand-soft)] text-[var(--color-brand-deep)]"
                    : "text-[var(--color-ink-muted)]"
                }`}
              >
                <Icon className="h-5 w-5" />
                {label}
              </button>
            </li>
          ))}
          <li className="flex-1">
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="flex min-h-[52px] w-full flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-semibold text-[var(--color-ink-muted)]"
            >
              <LogOut className="h-5 w-5" />
              Log out
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}
