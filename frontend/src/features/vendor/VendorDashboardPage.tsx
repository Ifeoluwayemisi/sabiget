"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Clock3,
  ShoppingBag,
  Store,
  Wallet,
  Mail,
  Lock,
  Phone,
  ArrowLeft,
} from "lucide-react";
import type { Socket } from "socket.io-client";
import {
  apiRequest,
  getAccessToken,
  storeAuthPayload,
  subscribeToAuth,
} from "@/lib/api/client";
import {
  getSocket,
  joinVendorRoom,
  SOCKET_EVENTS,
} from "@/lib/socket";

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

const statusLabel: Record<string, string> = {
  PENDING: "Pending",
  ACCEPTED: "Accepted",
  PREPARING: "Preparing",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  COMPLETED: "Completed",
  CANCELLED_CUSTOMER: "Cancelled by customer",
  CANCELLED_VENDOR: "Cancelled by vendor",
  CANCELLED_AUTO_KILL: "Auto-cancelled",
  REFUNDED: "Refunded",
};

export default function VendorDashboardPage() {
  // Start loading only when a session already exists; otherwise the auth gate
  // renders immediately on first paint instead of flashing a spinner.
  const [loading, setLoading] = useState(() => getAccessToken() !== null);
  const [dashboard, setDashboard] = useState<VendorDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [dvcMap, setDvcMap] = useState<Record<string, string>>({});

  // Track auth via the shared client so logging in/out (anywhere) rerenders
  // the gate immediately, rather than reading localStorage once on mount.
  const [token, setToken] = useState<string | null>(() => getAccessToken());
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

    try {
      setLoading(true);
      const response = await apiRequest("/vendors/dashboard/stats");

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load vendor dashboard");
      }

      setDashboard(data);
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load vendor dashboard.",
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const load = async () => {
      await fetchDashboard();
    };
    void load();
  }, [fetchDashboard]);

  const vendorId = dashboard?.vendor.id;

  // Realtime layer: order events never mutate dashboard state directly —
  // they trigger an authoritative REST reconciliation via fetchDashboard.
  useEffect(() => {
    if (!token || !vendorId) return;

    let cancelled = false;
    let socket: Socket | null = null;

    const onOrderEvent = () => void fetchDashboard();
    const onConnect = () => void fetchDashboard();

    const wireRealtime = async () => {
      const pendingSocket = getSocket();
      if (!pendingSocket || cancelled) return;

      socket = await pendingSocket;
      if (cancelled) return;

      // Room membership is ownership-checked server side; a failure here
      // simply leaves the dashboard on its normal REST behavior.
      if (!(await joinVendorRoom(socket, vendorId))) return;

      socket.on(SOCKET_EVENTS.ORDER_NEW, onOrderEvent);
      socket.on(SOCKET_EVENTS.ORDER_STATUS_UPDATED, onOrderEvent);
      socket.on("connect", onConnect);
    };

    void wireRealtime();

    return () => {
      cancelled = true;
      if (socket) {
        socket.off(SOCKET_EVENTS.ORDER_NEW, onOrderEvent);
        socket.off(SOCKET_EVENTS.ORDER_STATUS_UPDATED, onOrderEvent);
        socket.off("connect", onConnect);
      }
    };
  }, [token, vendorId, fetchDashboard]);

  const updateOrderStatus = async (
    orderId: string,
    action: string,
    extraBody?: Record<string, string>,
  ) => {
    if (!token) return;

    setSubmittingId(orderId);

    try {
      const response = await apiRequest(`/orders/${orderId}/${action}`, {
        method: "POST",
        body: extraBody ? JSON.stringify(extraBody) : undefined,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Action failed");
      }

      await fetchDashboard();
    } catch (actionError) {
      console.error(actionError);
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Could not update order status.",
      );
    } finally {
      setSubmittingId(null);
    }
  };

  const handleRejectOrder = async (orderId: string) => {
    // Destructive + financial (triggers a refund): require explicit intent.
    const confirmed = window.confirm(
      "Reject this order? The customer's payment will be refunded.",
    );
    if (!confirmed) return;

    await updateOrderStatus(orderId, "reject");
  };

  if (!token && !loading) {
    const isSignup = authMode === "signup";
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <Link
            href="/"
            className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to SabiGet
          </Link>

          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-50 text-orange-500">
            <Store className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-2xl font-black text-gray-900">
            Vendor dashboard
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Sign in to view and manage your incoming orders. New businesses can
            create an account below.
          </p>

          <div className="mt-6 flex rounded-xl bg-gray-100 p-1">
            <button
              type="button"
              onClick={() => {
                setAuthMode("signin");
                setAuthError(null);
              }}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                !isSignup
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500"
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
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500"
              }`}
            >
              Create account
            </button>
          </div>

          <div className="mt-6 space-y-4">
            {isSignup && (
              <>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-gray-700">
                    Business name
                  </span>
                  <div className="flex items-center gap-3 rounded-xl border border-gray-300 px-3 py-3 focus-within:border-orange-500">
                    <Store className="h-4 w-4 text-gray-400" />
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
                  <span className="mb-2 block text-sm font-medium text-gray-700">
                    Business phone
                  </span>
                  <div className="flex items-center gap-3 rounded-xl border border-gray-300 px-3 py-3 focus-within:border-orange-500">
                    <Phone className="h-4 w-4 text-gray-400" />
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
              <span className="mb-2 block text-sm font-medium text-gray-700">
                Email
              </span>
              <div className="flex items-center gap-3 rounded-xl border border-gray-300 px-3 py-3 focus-within:border-orange-500">
                <Mail className="h-4 w-4 text-gray-400" />
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
              <span className="mb-2 block text-sm font-medium text-gray-700">
                Password
              </span>
              <div className="flex items-center gap-3 rounded-xl border border-gray-300 px-3 py-3 focus-within:border-orange-500">
                <Lock className="h-4 w-4 text-gray-400" />
                <input
                  type="password"
                  autoComplete={
                    isSignup ? "new-password" : "current-password"
                  }
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
              className="w-full rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold text-white disabled:bg-gray-300"
            >
              {authSubmitting
                ? "Please wait..."
                : isSignup
                  ? "Create vendor account"
                  : "Sign in to dashboard"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-lg font-medium text-gray-600">
          Loading dashboard...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="max-w-lg rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
          <h2 className="text-xl font-bold">Dashboard unavailable</h2>
          <p className="mt-2">{error}</p>
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return null;
  }

  const statsCard = [
    {
      title: "Total orders",
      value: dashboard.orders.totalOrders,
      icon: ShoppingBag,
      accent: "bg-orange-500",
    },
    {
      title: "Active orders",
      value: dashboard.orders.activeOrders,
      icon: Clock3,
      accent: "bg-amber-500",
    },
    {
      title: "Completed",
      value: dashboard.orders.completedOrders,
      icon: CheckCircle2,
      accent: "bg-emerald-500",
    },
    {
      title: "Revenue",
      value: `₦${dashboard.earnings.totalRevenue.toLocaleString()}`,
      icon: Wallet,
      accent: "bg-violet-500",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-500">
              Vendor dashboard
            </p>
            <h1 className="mt-2 text-3xl font-black text-gray-900">
              {dashboard.vendor.name}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${dashboard.vendor.isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-700"}`}
            >
              {dashboard.vendor.isActive ? "Active" : "Inactive"}
            </span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${dashboard.vendor.isVerified ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}
            >
              {dashboard.vendor.isVerified
                ? "Verified"
                : "Pending verification"}
            </span>
          </div>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {statsCard.map(({ title, value, icon: Icon, accent }) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-500">{title}</p>
                  <h3 className="mt-3 text-2xl font-black text-gray-900">
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

        <div className="grid gap-6 xl:grid-cols-[1.8fr_1fr]">
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Recent orders</h2>
              <span className="text-sm text-gray-500">
                {dashboard.recentOrders.length} items
              </span>
            </div>

            <div className="space-y-4">
              {dashboard.recentOrders.length === 0 ? (
                <div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">
                  No orders yet.
                </div>
              ) : (
                dashboard.recentOrders.map((order) => (
                  <div
                    key={order.id}
                    className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          Order {order.id.slice(0, 8)}
                        </p>
                        <p className="text-sm text-gray-500">
                          {order.user?.name || "Guest customer"} •{" "}
                          {order.user?.phone || "No phone"}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-700">
                          {statusLabel[order.status] || order.status}
                        </span>
                        <span className="text-sm font-bold text-gray-900">
                          ₦{Number(order.totalAmount || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {order.status === "PENDING" && (
                        <>
                          <button
                            onClick={() => updateOrderStatus(order.id, "accept")}
                            disabled={submittingId === order.id}
                            className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:bg-emerald-300"
                          >
                            {submittingId === order.id
                              ? "Processing..."
                              : "Accept order"}
                          </button>
                          <button
                            onClick={() => handleRejectOrder(order.id)}
                            disabled={submittingId === order.id}
                            className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white disabled:bg-red-300"
                          >
                            Reject order
                          </button>
                        </>
                      )}

                      {order.status === "ACCEPTED" && (
                        <>
                          <button
                            onClick={() =>
                              updateOrderStatus(order.id, "preparing")
                            }
                            disabled={submittingId === order.id}
                            className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-white disabled:bg-amber-300"
                          >
                            Mark as preparing
                          </button>
                        </>
                      )}

                      {order.status === "PREPARING" && (
                        <>
                          <button
                            onClick={() =>
                              updateOrderStatus(order.id, "out-for-delivery")
                            }
                            disabled={submittingId === order.id}
                            className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-white disabled:bg-amber-300"
                          >
                            Mark out for delivery
                          </button>
                        </>
                      )}

                      {order.status === "OUT_FOR_DELIVERY" && (
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="text"
                            value={dvcMap[order.id] || ""}
                            onChange={(event) =>
                              setDvcMap((prev) => ({
                                ...prev,
                                [order.id]: event.target.value,
                              }))
                            }
                            placeholder="Enter DVC code"
                            className="min-w-[140px] rounded-lg border border-gray-300 bg-white px-2 py-2 text-xs text-gray-700 outline-none focus:border-orange-500"
                          />
                          <button
                            onClick={() =>
                              updateOrderStatus(order.id, "verify-dvc", {
                                dvcCode: dvcMap[order.id] || "",
                              })
                            }
                            disabled={submittingId === order.id}
                            className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white disabled:bg-violet-300"
                          >
                            Verify delivery code
                          </button>
                        </div>
                      )}

                      {order.status === "DELIVERED" && (
                        <button
                          onClick={() =>
                            updateOrderStatus(order.id, "complete")
                          }
                          disabled={submittingId === order.id}
                          className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:bg-blue-300"
                        >
                          Complete order
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <aside className="space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-lg font-bold text-gray-900">
                Operational summary
              </h3>
              <div className="space-y-4 text-sm text-gray-600">
                <div className="flex items-center justify-between">
                  <span>Pending</span>
                  <span className="font-bold text-gray-900">
                    {dashboard.orders.pendingOrders}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Refunded</span>
                  <span className="font-bold text-gray-900">
                    {dashboard.orders.refundedOrders}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Cancelled</span>
                  <span className="font-bold text-gray-900">
                    {dashboard.orders.cancelledOrders}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Paystack setup</span>
                  <span
                    className={`font-bold ${dashboard.vendor.paystackSubcodeConfigured ? "text-emerald-600" : "text-amber-600"}`}
                  >
                    {dashboard.vendor.paystackSubcodeConfigured
                      ? "Ready"
                      : "Missing"}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-lg font-bold text-gray-900">Earnings</h3>
              <div className="space-y-4 text-sm text-gray-600">
                <div className="flex items-center justify-between">
                  <span>Pending revenue</span>
                  <span className="font-bold text-gray-900">
                    ₦{dashboard.earnings.pendingRevenue.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Completed revenue</span>
                  <span className="font-bold text-gray-900">
                    ₦{dashboard.earnings.completedRevenue.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Refunded</span>
                  <span className="font-bold text-gray-900">
                    ₦{dashboard.earnings.refundedAmount.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
