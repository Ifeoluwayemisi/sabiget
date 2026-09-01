// Single shared Socket.IO connection for the whole app.
//
// The backend handshake middleware verifies `auth.token` as a JWT access
// token; the function form re-evaluates on every attempt so reconnects always
// present the CURRENT token after a refresh. REST remains authoritative —
// socket events only trigger reconciliation fetches, never local state writes.

import { io, type Socket } from "socket.io-client";
import {
  API_BASE_URL,
  getAccessToken,
  readCurrentUser,
} from "./api/client";

export const SOCKET_URL = API_BASE_URL.replace(/\/api\/v1\/?$/, "");

// Must match backend emitters/listeners exactly (socketService.js contract).
export const SOCKET_EVENTS = {
  CUSTOMER_JOIN: "customer:join",
  VENDOR_JOIN: "vendor:join",
  CONNECTION_SUCCESS: "connection:success",
  CONNECTION_ERROR: "connection:error",
  ORDER_NEW: "order:new",
  ORDER_STATUS_UPDATED: "order:statusUpdated",
} as const;

export interface OrderStatusPayload {
  orderId?: string;
  status?: string;
  vendorId?: string;
  userId?: string;
}

export interface ConnectionSuccessPayload {
  socketId?: string;
  userId?: string;
  role?: string;
  vendorId?: string;
}

let socketPromise: Promise<Socket> | null = null;

/**
 * Return the shared socket, creating it lazily on first use in the browser
 * with a valid session. Resolves even while disconnected so consumers can
 * attach handlers before the (re)connection completes.
 */
export function getSocket(): Promise<Socket> | null {
  if (typeof window === "undefined") return null;
  if (!getAccessToken()) return null;

  socketPromise ??= new Promise((resolve) => {
    const socket = io(SOCKET_URL, {
      auth: (callback) => callback({ token: getAccessToken() }),
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 15000,
    });

    // Resolve once a terminal-ish state is reached; auto-reconnection keeps
    // trying afterwards and registered listeners will fire when it lands.
    let settled = false;
    const settle = () => {
      if (!settled) {
        settled = true;
        resolve(socket);
      }
    };
    socket.once("connect", settle);
    socket.once("connect_error", settle);
  });

  return socketPromise;
}

/** Tear down the shared connection (logout / user switch). */
export function closeSocket(): void {
  if (!socketPromise) return;
  void socketPromise.then((socket) => socket.disconnect());
  socketPromise = null;
}

function waitForJoinConfirmation(
  socket: Socket,
  isOwnConfirmation: (payload: Record<string, unknown>) => boolean,
): Promise<boolean> {
  return new Promise((resolve) => {
    const cleanup = () => {
      clearTimeout(timer);
      socket.off(SOCKET_EVENTS.CONNECTION_SUCCESS, onSuccess);
      socket.off(SOCKET_EVENTS.CONNECTION_ERROR, onError);
    };

    const timer = setTimeout(() => {
      cleanup();
      resolve(false);
    }, 5000);

    const onSuccess = (payload: Record<string, unknown>) => {
      if (!isOwnConfirmation(payload)) return;
      cleanup();
      resolve(true);
    };

    const onError = () => {
      cleanup();
      resolve(false);
    };

    socket.on(SOCKET_EVENTS.CONNECTION_SUCCESS, onSuccess);
    socket.on(SOCKET_EVENTS.CONNECTION_ERROR, onError);
  });
}

/**
 * Join this session user's customer room. Room membership is validated
 * server-side against the handshake token; the argument is only a hint.
 */
export async function joinCustomerRoom(socket: Socket): Promise<boolean> {
  const user = readCurrentUser();
  if (!user?.id) return false;

  const confirmed = waitForJoinConfirmation(
    socket,
    (payload) => payload?.userId === user.id,
  );
  socket.emit(SOCKET_EVENTS.CUSTOMER_JOIN, user.id);
  return confirmed;
}

/**
 * Join a vendor room. The backend resolves ownership from the authenticated
 * vendor user and rejects joins for vendors they do not own.
 */
export async function joinVendorRoom(
  socket: Socket,
  vendorId: string,
): Promise<boolean> {
  const confirmed = waitForJoinConfirmation(
    socket,
    (payload) => payload?.vendorId === vendorId,
  );
  socket.emit(SOCKET_EVENTS.VENDOR_JOIN, vendorId);
  return confirmed;
}
