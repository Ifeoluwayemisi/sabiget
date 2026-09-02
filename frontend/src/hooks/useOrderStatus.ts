"use client";

import { useCallback, useEffect, useState } from "react";
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
import { isTerminalStatus } from "@/lib/orderStatus";

export interface TrackedOrder {
  status?: string;
  totalAmount?: number;
}

/**
 * Shared order-tracking hook.
 *
 * Authoritative state comes from REST. Socket events never set order state
 * directly — they trigger an authoritative REST reconciliation; polling
 * remains the fallback and stops once the backend reaches a terminal verdict.
 * Guests have no session identity, so they stay on polling only.
 */
export function useOrderStatus(orderId: string | null) {
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [loading, setLoading] = useState(Boolean(orderId));

  const effectiveOrderId = orderId || getLatestOrderId();

  const loadOrder = useCallback(async (): Promise<string | null> => {
    if (!effectiveOrderId) {
      setOrder(null);
      return null;
    }
    try {
      setLoading(true);

      const accessToken = getAccessToken();

      // Signed-in users track through the authenticated endpoint. Guests use
      // the limited-scope guestOrderToken minted at checkout; it is only
      // presented when tracking exactly the order it was issued for.
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

  return {
    order,
    status: order?.status ?? null,
    loading,
    refetch: loadOrder,
  };
}