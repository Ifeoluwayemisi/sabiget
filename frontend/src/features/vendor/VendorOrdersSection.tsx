"use client";

import { useCallback, useEffect, useState } from "react";
import type { Socket } from "socket.io-client";
import { AlertTriangle, Loader2, ShoppingBag } from "lucide-react";
import { apiRequest } from "@/lib/api/client";
import { getSocket, joinVendorRoom, SOCKET_EVENTS } from "@/lib/socket";
import { getOrderStatusMeta } from "@/lib/orderStatus";

interface VendorOrderItem {
  id: string;
  quantity: number;
  totalPrice: number;
  product?: { id: string; name?: string } | null;
}

interface VendorOrder {
  id: string;
  vendorId?: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  user?: { name?: string; phone?: string } | null;
  items?: VendorOrderItem[];
}

const ACTIVE_STATUSES = new Set([
  "PENDING",
  "ACCEPTED",
  "PREPARING",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
]);

export default function VendorOrdersSection() {
  const [orders, setOrders] = useState<VendorOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [dvcMap, setDvcMap] = useState<Record<string, string>>({});

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiRequest("/orders");
      const data = (await response.json()) as {
        success?: unknown;
        orders?: unknown;
      };
      if (!response.ok) {
        throw new Error(
          (data as { error?: string }).error || "Unable to load orders",
        );
      }
      setOrders(Array.isArray(data.orders) ? (data.orders as VendorOrder[]) : []);
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load your orders.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      await fetchOrders();
    };
    void load();
  }, [fetchOrders]);

  const vendorId = orders.find((order) => order.vendorId)?.vendorId;

  // Realtime layer: socket events only trigger an authoritative REST
  // reconciliation, never direct state mutation.
  useEffect(() => {
    if (!vendorId) return;
    let cancelled = false;
    let socket: Socket | null = null;

    const onOrderEvent = () => void fetchOrders();
    const onConnect = () => void fetchOrders();

    const wireRealtime = async () => {
      const pendingSocket = getSocket();
      if (!pendingSocket || cancelled) return;

      socket = await pendingSocket;
      if (cancelled) return;

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
  }, [vendorId, fetchOrders]);

  const updateOrderStatus = async (
    orderId: string,
    action: string,
    extraBody?: Record<string, string>,
  ) => {
    setSubmittingId(orderId);
    try {
      const response = await apiRequest(`/orders/${orderId}/${action}`, {
        method: "POST",
        body: extraBody ? JSON.stringify(extraBody) : undefined,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          (data as { error?: string }).error || "Action failed",
        );
      }
      await fetchOrders();
    } catch (actionError) {
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

  const renderOrderActions = (order: VendorOrder) => (
    <div className="mt-4 flex flex-wrap gap-2">
      {order.status === "PENDING" && (
        <>
          <button
            onClick={() => void updateOrderStatus(order.id, "accept")}
            disabled={submittingId === order.id}
            className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:bg-emerald-300"
          >
            {submittingId === order.id ? "Processing..." : "Accept order"}
          </button>
          <button
            onClick={() => void handleRejectOrder(order.id)}
            disabled={submittingId === order.id}
            className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white disabled:bg-red-300"
          >
            Reject order
          </button>
        </>
      )}

      {order.status === "ACCEPTED" && (
        <button
          onClick={() => void updateOrderStatus(order.id, "preparing")}
          disabled={submittingId === order.id}
          className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-white disabled:bg-amber-300"
        >
          Mark as preparing
        </button>
      )}

      {order.status === "PREPARING" && (
        <button
          onClick={() => void updateOrderStatus(order.id, "out-for-delivery")}
          disabled={submittingId === order.id}
          className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-white disabled:bg-amber-300"
        >
          Mark out for delivery
        </button>
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
              void updateOrderStatus(order.id, "verify-dvc", {
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
          onClick={() => void updateOrderStatus(order.id, "complete")}
          disabled={submittingId === order.id}
          className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:bg-blue-300"
        >
          Complete order
        </button>
      )}
    </div>
  );

  const renderOrder = (order: VendorOrder) => {
    const statusMeta = getOrderStatusMeta(order.status);
    return (
    <div
      key={order.id}
      className="rounded-2xl border border-gray-200 bg-white p-4"
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
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusMeta.tone}`}>
            {statusMeta.label}
          </span>
          <span className="text-sm font-bold text-gray-900">
            ₦{Number(order.totalAmount || 0).toLocaleString()}
          </span>
        </div>
      </div>

      {order.items && order.items.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-gray-500">
          {order.items.map((item) => (
            <li key={item.id}>
              {item.quantity} × {item.product?.name || "Item"} — ₦
              {Number(item.totalPrice || 0).toLocaleString()}
            </li>
          ))}
        </ul>
      )}

      {renderOrderActions(order)}
    </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading orders...
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700"
      >
        {error}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
          <ShoppingBag className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-lg font-bold text-gray-900">No orders yet</h2>
        <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">
          When customers place orders with your store they&apos;ll appear here,
          ready for you to accept.
        </p>
      </div>
    );
  }

  const pending = orders.filter((order) => order.status === "PENDING");
  const active = orders.filter(
    (order) => ACTIVE_STATUSES.has(order.status) && order.status !== "PENDING",
  );
  const past = orders.filter(
    (order) => !ACTIVE_STATUSES.has(order.status),
  );

  return (
    <div className="space-y-8">
      {pending.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-900">Pending</h2>
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-700">
              {pending.length}
            </span>
          </div>
          <div className="space-y-3">{pending.map(renderOrder)}</div>
        </section>
      )}

      {active.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-900">In progress</h2>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">
              {active.length}
            </span>
          </div>
          <div className="space-y-3">{active.map(renderOrder)}</div>
        </section>
      )}

      {past.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-900">Past orders</h2>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-600">
              {past.length}
            </span>
          </div>
          <div className="space-y-3">{past.map(renderOrder)}</div>
        </section>
      )}

      {pending.length === 0 && active.length === 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            You&apos;re all caught up — no active orders right now.
          </span>
        </div>
      )}
    </div>
  );
}