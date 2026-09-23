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

type ActionErrorKind = "invalid" | "locked" | "network" | "generic";

interface ActionError {
  kind: ActionErrorKind;
  message: string;
  attemptsRemaining?: number;
  lockedUntil?: string;
}

// Mirrors the "N attempts left" pattern already used for OTP in AuthModal.tsx.
function formatActionError(err: ActionError): string {
  if (err.kind === "invalid") {
    if (typeof err.attemptsRemaining === "number") {
      if (err.attemptsRemaining > 0) {
        return `${err.message} You have ${err.attemptsRemaining} attempt${
          err.attemptsRemaining === 1 ? "" : "s"
        } left.`;
      }
      return `${err.message} No attempts left — verification is now locked.`;
    }
    return err.message;
  }
  if (err.kind === "locked") {
    if (err.lockedUntil) {
      const until = new Date(err.lockedUntil);
      if (!Number.isNaN(until.getTime())) {
        return `${err.message} Try again after ${until.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}.`;
      }
    }
    return err.message;
  }
  if (err.kind === "network") {
    return `${err.message} Check your connection and try again.`;
  }
  return err.message;
}

export default function VendorOrdersSection() {
  const [orders, setOrders] = useState<VendorOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [dvcMap, setDvcMap] = useState<Record<string, string>>({});
  // Scoped per-order so a single failed action (DVC or otherwise) never
  // hides the rest of the vendor's pending/active/past orders.
  const [actionErrors, setActionErrors] = useState<Record<string, ActionError>>(
    {},
  );

  const clearActionError = useCallback((orderId: string) => {
    setActionErrors((prev) => {
      if (!(orderId in prev)) return prev;
      const next = { ...prev };
      delete next[orderId];
      return next;
    });
  }, []);

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
      setOrders(
        Array.isArray(data.orders) ? (data.orders as VendorOrder[]) : [],
      );
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
    clearActionError(orderId);
    try {
      const response = await apiRequest(`/orders/${orderId}/${action}`, {
        method: "POST",
        body: extraBody ? JSON.stringify(extraBody) : undefined,
      });

      let data: {
        error?: string;
        locked?: boolean;
        lockedUntil?: string;
        attemptsRemaining?: number;
      } | null = null;
      try {
        data = await response.json();
      } catch {
        // Non-JSON body on failure — fall through to the generic message.
      }

      if (!response.ok) {
        const message = data?.error || "Action failed";

        if (action === "verify-dvc" && data?.locked) {
          setActionErrors((prev) => ({
            ...prev,
            [orderId]: {
              kind: "locked",
              message,
              lockedUntil: data?.lockedUntil,
            },
          }));
        } else if (
          action === "verify-dvc" &&
          typeof data?.attemptsRemaining === "number"
        ) {
          setActionErrors((prev) => ({
            ...prev,
            [orderId]: {
              kind: "invalid",
              message,
              attemptsRemaining: data?.attemptsRemaining,
            },
          }));
        } else {
          setActionErrors((prev) => ({
            ...prev,
            [orderId]: { kind: "generic", message },
          }));
        }
        return;
      }

      clearActionError(orderId);
      await fetchOrders();
    } catch (actionError) {
      setActionErrors((prev) => ({
        ...prev,
        [orderId]: {
          kind: "network",
          message:
            actionError instanceof Error
              ? actionError.message
              : "Could not update order status.",
        },
      }));
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
            className="rounded-xl bg-[var(--color-accent)] px-3 py-2 text-xs font-bold text-white shadow-sm disabled:bg-[var(--color-accent-soft)] disabled:text-[var(--color-accent)]"
          >
            {submittingId === order.id ? "Processing..." : "Accept order"}
          </button>
          <button
            onClick={() => void handleRejectOrder(order.id)}
            disabled={submittingId === order.id}
            className="rounded-xl bg-red-600 px-3 py-2 text-xs font-bold text-white shadow-sm disabled:bg-red-200"
          >
            Reject order
          </button>
        </>
      )}

      {order.status === "ACCEPTED" && (
        <button
          onClick={() => void updateOrderStatus(order.id, "preparing")}
          disabled={submittingId === order.id}
          className="rounded-xl bg-[#d97706] px-3 py-2 text-xs font-bold text-white shadow-sm disabled:bg-[#f5d9a8]"
        >
          Mark as preparing
        </button>
      )}

      {order.status === "PREPARING" && (
        <button
          onClick={() => void updateOrderStatus(order.id, "out-for-delivery")}
          disabled={submittingId === order.id}
          className="rounded-xl bg-[#d97706] px-3 py-2 text-xs font-bold text-white shadow-sm disabled:bg-[#f5d9a8]"
        >
          Mark out for delivery
        </button>
      )}

      {order.status === "OUT_FOR_DELIVERY" && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={dvcMap[order.id] || ""}
            onChange={(event) => {
              setDvcMap((prev) => ({
                ...prev,
                [order.id]: event.target.value,
              }));
              clearActionError(order.id);
            }}
            placeholder="Enter DVC code"
            className="min-h-[44px] min-w-[140px] rounded-xl border border-[var(--color-line-strong)] bg-[var(--color-surface-strong)] px-3 py-2 text-xs text-[var(--color-ink)] outline-none focus:border-[var(--color-brand)] focus:ring-4 focus:ring-[rgba(255,69,0,0.12)]"
          />
          <button
            onClick={() =>
              void updateOrderStatus(order.id, "verify-dvc", {
                dvcCode: dvcMap[order.id] || "",
              })
            }
            disabled={submittingId === order.id}
            className="rounded-xl bg-[var(--color-brand)] px-3 py-2 text-xs font-bold text-white shadow-sm disabled:bg-[#ffb38f]"
          >
            Verify delivery code
          </button>
        </div>
      )}

      {order.status === "DELIVERED" && (
        <button
          onClick={() => void updateOrderStatus(order.id, "complete")}
          disabled={submittingId === order.id}
          className="rounded-xl bg-[var(--color-brand-deep)] px-3 py-2 text-xs font-bold text-white shadow-sm disabled:bg-[#e8b4a0]"
        >
          Complete order
        </button>
      )}
    </div>
  );

  const renderOrder = (order: VendorOrder) => {
    const statusMeta = getOrderStatusMeta(order.status);
    return (
      <div key={order.id} className="sabiget-card p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--color-ink)]">
              Order {order.id.slice(0, 8)}
            </p>
            <p className="text-sm text-[var(--color-ink-muted)]">
              {order.user?.name || "Guest customer"} •{" "}
              {order.user?.phone || "No phone"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusMeta.tone}`}
            >
              {statusMeta.label}
            </span>
            <span className="text-sm font-bold text-[var(--color-ink)]">
              ₦{Number(order.totalAmount || 0).toLocaleString()}
            </span>
          </div>
        </div>

        {order.items && order.items.length > 0 && (
          <ul className="mt-3 space-y-1 border-t border-[var(--color-line)] pt-3 text-xs text-[var(--color-ink-muted)]">
            {order.items.map((item) => (
              <li key={item.id}>
                {item.quantity} × {item.product?.name || "Item"} — ₦
                {Number(item.totalPrice || 0).toLocaleString()}
              </li>
            ))}
          </ul>
        )}

        {renderOrderActions(order)}

        {actionErrors[order.id] && (
          <div
            role="alert"
            className={`mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
              actionErrors[order.id].kind === "locked"
                ? "border-red-200 bg-red-50 text-red-700"
                : actionErrors[order.id].kind === "invalid"
                  ? "border-[#f2d59f] bg-[#fff8e8] text-[#8b5a00]"
                  : "border-[var(--color-line)] bg-[var(--color-surface-muted)] text-[var(--color-ink-muted)]"
            }`}
          >
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{formatActionError(actionErrors[order.id])}</span>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="sabiget-card flex items-center gap-2 p-5 text-sm text-[var(--color-ink-muted)]">
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
      <div className="sabiget-card border-dashed p-10 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-brand-soft)] text-[var(--color-brand)]">
          <ShoppingBag className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-lg font-bold text-[var(--color-ink)]">
          No orders yet
        </h2>
        <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--color-ink-muted)]">
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
  const past = orders.filter((order) => !ACTIVE_STATUSES.has(order.status));

  return (
    <div className="space-y-8">
      {pending.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-lg font-bold text-[var(--color-ink)]">
              Pending
            </h2>
            <span className="rounded-full bg-[var(--color-brand-soft)] px-2 py-0.5 text-xs font-bold text-[var(--color-brand-deep)]">
              {pending.length}
            </span>
          </div>
          <div className="space-y-3">{pending.map(renderOrder)}</div>
        </section>
      )}

      {active.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-lg font-bold text-[var(--color-ink)]">
              In progress
            </h2>
            <span className="rounded-full bg-[#eaf2ff] px-2 py-0.5 text-xs font-bold text-[#285b9a]">
              {active.length}
            </span>
          </div>
          <div className="space-y-3">{active.map(renderOrder)}</div>
        </section>
      )}

      {past.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-lg font-bold text-[var(--color-ink)]">
              Past orders
            </h2>
            <span className="rounded-full bg-[var(--color-surface-muted)] px-2 py-0.5 text-xs font-bold text-[var(--color-ink-muted)]">
              {past.length}
            </span>
          </div>
          <div className="space-y-3">{past.map(renderOrder)}</div>
        </section>
      )}

      {pending.length === 0 && active.length === 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-[#c9dcf5] bg-[#f1f6ff] px-3 py-2 text-sm text-[#285b9a]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>You&apos;re all caught up — no active orders right now.</span>
        </div>
      )}
    </div>
  );
}
