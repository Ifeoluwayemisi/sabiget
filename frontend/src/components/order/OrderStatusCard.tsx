"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, MapPin, PackageCheck, Truck } from "lucide-react";
import type { Socket } from "socket.io-client";
import { API_BASE_URL, getAccessToken } from "@/lib/api/client";
import {
  getSocket,
  joinCustomerRoom,
  SOCKET_EVENTS,
  type OrderStatusPayload,
} from "@/lib/socket";
import {
  getLatestOrderId,
  getLatestOrderToken,
} from "@/lib/orderTracker";
import { formatNaira } from "@/lib/format";
import { getOrderStatusMeta, isTerminalStatus } from "@/lib/orderStatus";

interface TrackedOrder {
  status?: string;
}

interface OrderStatusCardProps {
  orderId?: string | null;
  vendorName?: string;
  totalAmount?: number;
  reference?: string;
}

export default function OrderStatusCard({
  orderId,
  vendorName,
  totalAmount,
  reference,
}: OrderStatusCardProps) {
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [loading, setLoading] = useState(Boolean(orderId));

  const storedOrderId = getLatestOrderId();
  const effectiveOrderId = orderId || storedOrderId;

  const loadOrder = useCallback(async (): Promise<string | null> => {
    try {
      setLoading(true);

      const accessToken = getAccessToken();

      // Signed-in users track through the authenticated endpoint. Guests
      // use the limited-scope guestOrderToken minted at checkout; it is
      // only presented when tracking exactly the order it was issued for.
      const guestOrderToken =
        !accessToken && getLatestOrderId() === effectiveOrderId
          ? getLatestOrderToken()
          : null;

      const token = accessToken ?? guestOrderToken;
      if (!token) {
        setOrder(null);
        return null;
      }

      // The guest endpoint authenticates with the scoped token itself, so
      // the shared client's session-token logic does not apply here.
      const endpoint = accessToken
        ? `/orders/${effectiveOrderId}`
        : `/orders/${effectiveOrderId}/guest-status`;

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error("Unable to fetch order");
      }

      const data = (await response.json()) as { order?: TrackedOrder };
      setOrder(data.order ?? null);
      return data.order?.status ?? null;
    } catch (error) {
      console.error("Failed to fetch order status:", error);
      return null;
    } finally {
      setLoading(false);
    }
  }, [effectiveOrderId]);

  useEffect(() => {
    if (!effectiveOrderId) return;

    let stopped = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const stopPolling = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const tick = async () => {
      if (stopped) return;
      const status = await loadOrder();

      // Backend has reached a final verdict; no reason to keep polling.
      if (!stopped && status && isTerminalStatus(status)) {
        stopPolling();
      }
    };

    void tick();
    intervalId = setInterval(() => void tick(), 15000);

    return () => {
      stopped = true;
      stopPolling();
    };
  }, [effectiveOrderId, loadOrder]);

  // Realtime layer for signed-in users: socket events never mutate order
  // state directly — they trigger an authoritative REST reconciliation.
  // Guests have no session identity, so they stay on polling only.
  useEffect(() => {
    if (!effectiveOrderId || !getAccessToken()) return;

    let cancelled = false;
    let socket: Socket | null = null;

    const onStatusUpdated = (payload: OrderStatusPayload) => {
      if (!payload?.orderId || payload.orderId === effectiveOrderId) {
        void loadOrder();
      }
    };
    const onConnect = () => void loadOrder();

    const wireRealtime = async () => {
      const pendingSocket = getSocket();
      if (!pendingSocket || cancelled) return;

      socket = await pendingSocket;
      if (cancelled) return;

      if (!(await joinCustomerRoom(socket))) return;

      socket.on(SOCKET_EVENTS.ORDER_STATUS_UPDATED, onStatusUpdated);
      socket.on("connect", onConnect);
    };

    void wireRealtime();

    return () => {
      cancelled = true;
      // Remove only this component's own handlers from the shared socket.
      if (socket) {
        socket.off(SOCKET_EVENTS.ORDER_STATUS_UPDATED, onStatusUpdated);
        socket.off("connect", onConnect);
      }
    };
  }, [effectiveOrderId, loadOrder]);

  const currentStatus = useMemo(() => getOrderStatusMeta(order?.status), [order]);

  if (!effectiveOrderId) return null;

  return (
    <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-strong)] p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#e63d00]">
            Order status
          </p>
          <h4 className="mt-1 text-lg font-bold text-[#111111]">
            {vendorName || "Your order"}
          </h4>
        </div>
        <div className="rounded-full bg-[#ffefe8] px-2.5 py-1 text-[10px] font-bold text-[#a82b00]">
          {order?.status || "PAYMENT STARTED"}
        </div>
      </div>

      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-[#ffefe8]">
        <div
          className="h-full rounded-full bg-linear-to-r from-[#ff4500] to-[#ff6a00] transition-all duration-500"
          style={{ width: `${currentStatus.progress}%` }}
        />
      </div>

      <div className="mt-3 flex items-center justify-between text-sm text-[#5f5a57]">
        <span className="inline-flex items-center gap-2 font-medium">
          {order?.status === "DELIVERED" || order?.status === "COMPLETED" ? (
            <CheckCircle2 className="h-4 w-4 text-[#2e7d32]" />
          ) : order?.status === "OUT_FOR_DELIVERY" ? (
            <Truck className="h-4 w-4 text-[#e63d00]" />
          ) : order?.status === "PREPARING" || order?.status === "ACCEPTED" ? (
            <PackageCheck className="h-4 w-4 text-[#e63d00]" />
          ) : (
            <Clock3 className="h-4 w-4 text-[#e63d00]" />
          )}
          {currentStatus.label}
        </span>
        {typeof totalAmount === "number" && (
          <span className="font-bold text-[#111111]">{formatNaira(totalAmount)}</span>
        )}
      </div>

      <div className="mt-4 space-y-2 text-sm text-[#5f5a57]">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2">
            <MapPin className="h-4 w-4 text-[#ff4500]" />
            Order ID
          </span>
          <span className="font-medium text-[#111111]">{effectiveOrderId}</span>
        </div>
        {reference && (
          <div className="flex items-center justify-between gap-3">
            <span>Reference</span>
            <span className="font-medium text-[#111111]">{reference}</span>
          </div>
        )}
      </div>

      {loading && (
        <p className="mt-3 text-xs text-[#8a8a8a]">
          Refreshing live order status...
        </p>
      )}
    </div>
  );
}
