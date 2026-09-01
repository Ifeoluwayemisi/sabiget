/**
 * Single owner of the "latest order" tracking keys so MenuModal, OrderStatusCard,
 * and HomePage never duplicate literal storage keys.
 *
 * The localStorage `storage` event only fires in OTHER tabs, so writers also
 * dispatch a same-tab CustomEvent. This guarantees the live-order section on
 * Home appears the moment a checkout succeeds, without a page reload.
 */

const ORDER_ID_KEY = "latestOrderId";
const TOKEN_KEY = "latestOrderToken";
const EVENT_NAME = "sabiget:latest-order";

function hasWindow(): boolean {
  return typeof window !== "undefined";
}

export function getLatestOrderId(): string | null {
  if (!hasWindow()) return null;
  return window.localStorage.getItem(ORDER_ID_KEY);
}

export function getLatestOrderToken(): string | null {
  if (!hasWindow()) return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

/**
 * Persist the most recent order. A member checkout must clear any stale guest
 * token so it can never be replayed against a different order.
 */
export function setLatestOrder(orderId: string, guestOrderToken?: string | null): void {
  if (!hasWindow()) return;
  window.localStorage.setItem(ORDER_ID_KEY, orderId);
  if (guestOrderToken) {
    window.localStorage.setItem(TOKEN_KEY, guestOrderToken);
  } else {
    window.localStorage.removeItem(TOKEN_KEY);
  }
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: orderId }));
}

/** Subscribe to same-tab and cross-tab changes. Returns an unsubscribe fn. */
export function subscribeToLatestOrder(listener: () => void): () => void {
  if (!hasWindow()) return () => {};
  window.addEventListener("storage", listener);
  window.addEventListener(EVENT_NAME, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(EVENT_NAME, listener);
  };
}