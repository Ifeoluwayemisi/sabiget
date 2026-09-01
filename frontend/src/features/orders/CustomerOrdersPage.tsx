"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
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

  useEffect(() => {
    const loadOrders = async () => {
      if (!getAccessToken()) {
        setError("Please sign in to view your order history.");
        setLoading(false);
        return;
      }

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
    };

    void loadOrders();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-lg font-medium text-gray-600">
          Loading your orders...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="max-w-lg rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700 shadow-sm">
          <h1 className="text-2xl font-bold">Order history unavailable</h1>
          <p className="mt-2">{error}</p>
          <Link
            href="/"
            className="mt-5 inline-block rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Go home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#e63d00]">
              Customer area
            </p>
            <h1 className="mt-2 text-3xl font-black text-gray-900">
              My orders
            </h1>
          </div>

          <Link
            href="/"
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-orange-300 hover:text-orange-600"
          >
            Back home
          </Link>
        </div>

        {orders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center shadow-sm">
            <h2 className="text-xl font-bold text-gray-900">No orders yet</h2>
            <p className="mt-2 text-gray-600">
              Your recent meals and deliveries will appear here once you place
              an order.
            </p>
            <Link
              href="/"
              className="mt-5 inline-block rounded-lg bg-[#ff4500] px-5 py-3 text-sm font-bold text-white"
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
                  className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Order ID</p>
                      <h2 className="mt-1 text-xl font-bold text-gray-900">
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
                      <span className="text-lg font-black text-gray-900">
                        {formatNaira(Number(order.totalAmount || 0))}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.15em] text-gray-400">
                        Vendor
                      </p>
                      <p className="mt-1 text-sm font-semibold text-gray-800">
                        {order.vendor?.name || "Vendor"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.15em] text-gray-400">
                        Placed
                      </p>
                      <p className="mt-1 text-sm font-semibold text-gray-800">
                        {new Date(order.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.15em] text-gray-400">
                        Items
                      </p>
                      <p className="mt-1 text-sm font-semibold text-gray-800">
                        {(order.items || []).reduce(
                          (sum, item) => sum + (item.quantity || 0),
                          0,
                        )}{" "}
                        item(s)
                      </p>
                    </div>
                  </div>

                  {(order.items || []).length > 0 && (
                    <div className="mt-5 rounded-xl bg-gray-50 p-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
                        Items
                      </p>
                      <div className="space-y-2">
                        {(order.items || []).map((item, index) => (
                          <div
                            key={`${order.id}-${index}`}
                            className="flex items-center justify-between text-sm text-gray-700"
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
