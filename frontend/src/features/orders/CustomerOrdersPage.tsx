"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Loader2,
  RotateCcw,
  ShoppingBag,
} from "lucide-react";
import { apiRequest, getAccessToken } from "@/lib/api/client";
import { formatNaira } from "@/lib/format";
import { getOrderStatusMeta } from "@/lib/orderStatus";

interface OrderItem {
  quantity?: number;
  totalPrice?: number;
  product?: {
    name?: string;
  };
}

interface CustomerOrder {
  id: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  vendor?: {
    name?: string;
  };
  items?: OrderItem[];
}

export default function CustomerOrdersPage() {
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    if (!getAccessToken()) {
      setError("Please sign in to view your order history.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiRequest("/orders");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load your orders.");
      }

      setOrders(data.orders || []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load orders right now.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Resolve the initial load through the async promise chain instead of a
    // synchronous effect body, so the unchecked-access-token guard above and
    // the setState calls run after the awaited request rather than inline.
    let cancelled = false;

    const loadInitialOrders = async () => {
      if (!getAccessToken()) {
        setError("Please sign in to view your order history.");
        setLoading(false);
        return;
      }

      try {
        const response = await apiRequest("/orders");
        const data = await response.json();

        if (cancelled) return;
        if (!response.ok) {
          throw new Error(data.error || "Unable to load your orders.");
        }
        setOrders(data.orders || []);
      } catch (loadError) {
        if (cancelled) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load orders right now.",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadInitialOrders();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--color-surface)] px-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ffefe8]">
          <Loader2 className="h-7 w-7 animate-spin text-[#ff4500]" />
        </span>
        <h2 className="mt-4 text-lg font-bold text-[#111111]">
          Loading your orders
        </h2>
        <p className="mt-2 text-sm text-[#8a8a8a]">
          Hang on a moment...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--color-surface)] px-4">
        <div className="max-w-md rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-strong)] p-6 text-center shadow-[var(--shadow-card)] sm:p-8">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff4ec] text-[#b3400f] sm:h-14 sm:w-14">
            <AlertTriangle className="h-6 w-6 sm:h-7 sm:w-7" />
          </span>
          <h1 className="mt-4 text-lg font-bold text-[#111111] sm:text-xl">
            Order history unavailable
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[#666666]">
            {error}
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => void loadOrders()}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-[#ff4500] px-6 py-3 text-sm font-bold text-white shadow-[0_8px_24px_-6px_rgba(255,69,0,0.5)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#e63d00]"
            >
              <RotateCcw className="h-4 w-4" />
              Try again
            </button>
            <Link
              href="/"
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-[var(--color-line-strong)] px-6 py-3 text-sm font-bold text-[#111111] transition-all duration-200 hover:-translate-y-0.5 hover:border-[rgba(26,26,26,0.22)]"
            >
              Go home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-surface)] px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#e63d00]">
              Customer area
            </p>
            <h1 className="mt-2 text-xl font-extrabold text-[#111111] sm:text-2xl">
              My orders
            </h1>
          </div>

          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center rounded-full border border-[var(--color-line-strong)] px-4 py-2 text-sm font-bold text-[#111111] transition-all duration-200 hover:-translate-y-0.5 hover:border-[rgba(26,26,26,0.22)]"
          >
            Back home
          </Link>
        </div>

        {orders.length === 0 ? (
          <div className="mx-auto max-w-md rounded-2xl border border-dashed border-[var(--color-line)] bg-[var(--color-surface-strong)] p-10 text-center shadow-[var(--shadow-card)]">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ffefe8] text-[#e63d00] sm:h-14 sm:w-14">
              <ShoppingBag className="h-6 w-6 sm:h-7 sm:w-7" />
            </span>
            <h2 className="mt-4 text-lg font-bold text-[#111111]">
              No orders yet
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#666666]">
              Your recent meals and deliveries will appear here once you place
              an order.
            </p>
            <Link
              href="/"
              className="mt-5 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-[#ff4500] px-6 py-3 text-sm font-bold text-white shadow-[0_8px_24px_-6px_rgba(255,69,0,0.5)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#e63d00]"
            >
              Explore vendors
            </Link>
          </div>
        ) : (
          <div className="grid gap-5">
            {orders.map((order) => {
              const meta = getOrderStatusMeta(order.status);
              const StatusIcon = meta.icon;

              return (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-strong)] p-5 shadow-[var(--shadow-card)]"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-xs text-[#8a8a8a]">Order ID</p>
                      <h2 className="mt-1 text-base font-bold text-[#111111]">
                        {order.id}
                      </h2>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${meta.tone}`}
                      >
                        <StatusIcon className="h-3.5 w-3.5" />
                        {meta.label}
                      </span>
                      <span className="text-lg font-extrabold text-[#111111]">
                        {formatNaira(Number(order.totalAmount || 0))}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.15em] text-[#8a8a8a]">
                        Vendor
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[#5f5a57]">
                        {order.vendor?.name || "Vendor"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.15em] text-[#8a8a8a]">
                        Placed
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[#5f5a57]">
                        {new Date(order.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.15em] text-[#8a8a8a]">
                        Items
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[#5f5a57]">
                        {(order.items || []).reduce(
                          (sum, item) => sum + (item.quantity || 0),
                          0,
                        )}{" "}
                        item(s)
                      </p>
                    </div>
                  </div>

                  {(order.items || []).length > 0 && (
                    <div className="mt-5 rounded-xl bg-[var(--color-surface)] p-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#8a8a8a]">
                        Items
                      </p>
                      <div className="space-y-2">
                        {(order.items || []).map((item, index) => (
                          <div
                            key={`${order.id}-${index}`}
                            className="flex items-center justify-between text-sm text-[#5f5a57]"
                          >
                            <span>
                              {item.product?.name || `Item ${index + 1}`}
                            </span>
                            <span>
                              {item.quantity || 1} x{" "}
                              {formatNaira(Number(item.totalPrice || 0))}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
