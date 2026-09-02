"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  Minus,
  MapPin,
  Plus,
  ShoppingCart,
  Trash2,
  XCircle,
} from "lucide-react";
import {
  apiRequest,
  getAccessToken,
  subscribeToAuth,
} from "@/lib/api/client";
import { formatNaira } from "@/lib/format";
import { estimateTotal } from "@/lib/pricing";
import { setLatestOrder } from "@/lib/orderTracker";
import { useOrderStatus } from "@/hooks/useOrderStatus";
import type { UseCartReturn } from "@/hooks/useCart";
import OrderStatusCard from "@/components/order/OrderStatusCard";

const guestPhoneRegex = /^(\+234|0)[789]\d{9}$/;

interface CheckoutPanelProps {
  vendorId: string | null;
  vendorName: string;
  cart: UseCartReturn;
  onBack: () => void;
}

interface PlacedOrder {
  orderId: string;
  reference: string;
  authorizationUrl: string;
}

type Feedback = { kind: "error" | "info" | "success"; text: string } | null;

function QuantityStepper({
  quantity,
  onDecrement,
  onIncrement,
  itemName,
  incrementDisabled = false,
}: {
  quantity: number;
  onDecrement: () => void;
  onIncrement: () => void;
  itemName: string;
  incrementDisabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onDecrement}
        aria-label={`Remove one ${itemName}`}
        className="touch-target flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-line-strong)] text-[#111111] hover:bg-[#fff2ea]"
      >
        <Minus className="h-4 w-4" />
      </button>
      <span className="w-6 text-center text-sm font-bold text-[#111111]">
        {quantity}
      </span>
      <button
        onClick={onIncrement}
        disabled={incrementDisabled}
        aria-label={`Add one more ${itemName}`}
        className="touch-target flex h-10 w-10 items-center justify-center rounded-full bg-[#ff4500] text-white hover:bg-[#e63d00] disabled:cursor-not-allowed disabled:bg-[#ffb38f]"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

type PaymentStage =
  | "pending"
  | "confirmed"
  | "failed"
  | "refunded"
  | "disputed";

function PaymentStatusView({
  placedOrder,
  isGuest,
  onDone,
}: {
  placedOrder: PlacedOrder;
  isGuest: boolean;
  onDone: () => void;
}) {
  const { order, status, loading } = useOrderStatus(placedOrder.orderId);
  const [paymentWindowOpened, setPaymentWindowOpened] = useState(false);

  // Derived purely from the backend's authoritative order status. The UI
  // never declares "Payment successful" — only the webhook-verified order
  // state can. Unknown/new statuses lean towards a pending, non-fatal state.
  const stage = useMemo<PaymentStage>(() => {
    switch (status) {
      case "PENDING":
      case "ACCEPTED":
      case "PREPARING":
      case "OUT_FOR_DELIVERY":
      case "DELIVERED":
      case "COMPLETED":
        return "confirmed";
      case "CANCELLED_CUSTOMER":
        return "failed";
      case "REFUNDED":
        return "refunded";
      case "DISPUTED":
        return "disputed";
      default:
        return "pending";
    }
  }, [status]);

  const openPayment = () => {
    setPaymentWindowOpened(true);
    window.open(placedOrder.authorizationUrl, "_blank", "noopener,noreferrer");
  };

  const copy: Record<PaymentStage, { title: string; body: string }> = {
    pending: {
      title: "Finish your payment",
      body: paymentWindowOpened
        ? "Your order is saved. Waiting for Paystack to confirm the payment — this usually takes a moment."
        : "Your order is saved. Complete payment in the Paystack window so the vendor can start preparing it.",
    },
    confirmed: {
      title: "Payment confirmed",
      body: "Your payment went through. The vendor has been notified and will start on your order shortly.",
    },
    failed: {
      title: "Payment wasn't completed",
      body: "The payment didn't go through, so this order was cancelled. You can place a new order and try again.",
    },
    refunded: {
      title: "Order refunded",
      body: "This order was refunded. The money returns to your original payment method within a few business days.",
    },
    disputed: {
      title: "Order under review",
      body: "This order is being reviewed before any refund can be issued.",
    },
  };

  const heading = copy[stage];

  return (
    <div className="p-5 pb-36">
      <div className="flex flex-col items-center py-6 text-center">
        {stage === "confirmed" ? (
          <CheckCircle2 className="h-14 w-14 text-[#2e7d32]" />
        ) : stage === "failed" || stage === "refunded" ? (
          <XCircle className="h-14 w-14 text-[#a82b00]" />
        ) : stage === "disputed" ? (
          <Loader2 className="h-14 w-14 animate-spin text-[#ff4500]" />
        ) : (
          <Loader2 className="h-14 w-14 animate-spin text-[#ff4500]" />
        )}
        <h3 className="mt-4 text-xl font-bold text-[#111111]">{heading.title}</h3>
        <p className="mt-2 max-w-sm text-sm text-[var(--color-ink-muted)]">
          {heading.body}
        </p>

        {stage === "pending" && (
          <>
            <button
              onClick={openPayment}
              className="mt-6 flex items-center gap-2 rounded-xl bg-[#ff4500] px-6 py-3 text-sm font-bold text-white hover:bg-[#e63d00]"
            >
              <ExternalLink className="h-4 w-4" />
              Open Paystack to pay
            </button>
            <p className="mt-3 text-xs text-[#8a8a8a]">
              {loading
                ? "Checking payment status…"
                : "We'll update this page automatically once payment is confirmed."}
            </p>
          </>
        )}
      </div>

      <OrderStatusCard
        orderId={placedOrder.orderId}
        totalAmount={order?.totalAmount}
        reference={placedOrder.reference}
      />

      <button
        onClick={onDone}
        className="mt-5 w-full rounded-xl border border-[var(--color-line-strong)] px-4 py-3 text-sm font-semibold text-[#111111] hover:bg-[#fff2ea]"
      >
        {isGuest ? "Track on this device" : "Done"}
      </button>
    </div>
  );
}

export default function CheckoutPanel({
  vendorId,
  vendorName,
  cart,
  onBack,
}: CheckoutPanelProps) {
  const hasAccessToken = useSyncExternalStore(
    subscribeToAuth,
    () => Boolean(getAccessToken()),
    () => false,
  );

  const [guestPhone, setGuestPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryCoords, setDeliveryCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [placedOrder, setPlacedOrder] = useState<PlacedOrder | null>(null);

  // Coordinates are held in memory only and used solely for this checkout.
  useEffect(() => {
    if (deliveryCoords || !("geolocation" in navigator)) return;
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (cancelled) return;
        setDeliveryCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {
        // Denied or unavailable: checkout proceeds without coordinates.
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
    return () => {
      cancelled = true;
    };
  }, [deliveryCoords]);

  const estimatedTotal = estimateTotal(cart.subtotal);

  const handleCheckout = async () => {
    if (cart.lines.length === 0) {
      setFeedback({
        kind: "error",
        text: "Add at least one item before checkout.",
      });
      return;
    }

    if (!hasAccessToken) {
      const phone = guestPhone.trim();
      if (!phone) {
        setFeedback({
          kind: "error",
          text: "Enter your phone number for guest checkout.",
        });
        return;
      }
      if (!guestPhoneRegex.test(phone)) {
        setFeedback({
          kind: "error",
          text: "Enter a valid Nigerian phone number, e.g. +2348123456789.",
        });
        return;
      }
    }

    if (!deliveryAddress.trim()) {
      setFeedback({ kind: "error", text: "Add a delivery address." });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      const payload = {
        vendorId,
        deliveryAddress: deliveryAddress.trim(),
        ...(deliveryCoords
          ? { deliveryLat: deliveryCoords.lat, deliveryLng: deliveryCoords.lng }
          : {}),
        // Client sends line data only; the backend recalculates the
        // authoritative amount and validates prices, stock and ownership.
        items: cart.lines.map((line) => ({
          productId: line.product.id,
          quantity: line.quantity,
          specialRequests: line.specialRequest.trim(),
        })),
        ...(hasAccessToken ? {} : { phone: guestPhone.trim() }),
      };

      const response = await apiRequest(
        `/orders${hasAccessToken ? "" : "/guest-checkout"}`,
        { method: "POST", body: JSON.stringify(payload) },
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data?.error || data?.message || "Checkout failed. Please try again.",
        );
      }

      const orderId = String(data?.orderId || "");
      if (!orderId) {
        throw new Error("Checkout didn't return an order.");
      }

      setLatestOrder(
        orderId,
        hasAccessToken ? null : data?.guestOrderToken || null,
      );

      setPlacedOrder({
        orderId,
        reference: String(data?.reference || ""),
        authorizationUrl: String(data?.authorizationUrl || ""),
      });

      cart.clearCart();
    } catch (error) {
      console.error("Checkout failed:", error);
      setFeedback({
        kind: "error",
        text:
          error instanceof Error
            ? error.message
            : "Checkout failed. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (placedOrder) {
    return (
      <PaymentStatusView
        placedOrder={placedOrder}
        isGuest={!hasAccessToken}
        onDone={onBack}
      />
    );
  }

  return (
    <div className="p-5 pb-40">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-[#111111]">Review your order</h3>
          <p className="text-sm text-[var(--color-ink-muted)]">{vendorName}</p>
        </div>
        <ShoppingCart className="h-5 w-5 text-[#ff4500]" />
      </div>

      {cart.lines.length === 0 ? (
        <div className="flex flex-col items-center py-14 text-center">
          <ShoppingCart className="h-10 w-10 text-[#ffb38f]" />
          <p className="mt-3 text-sm text-[var(--color-ink-muted)]">
            Your cart is empty. Add something from the menu to get started.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-4 space-y-3">
            {cart.lines.map((line) => {
              const atMax =
                line.product.stockQuantity != null &&
                line.quantity >= line.product.stockQuantity;
              return (
                <div
                  key={line.product.id}
                  className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-strong)] p-3 shadow-[var(--shadow-card)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-[#111111]">
                        {line.product.name}
                      </p>
                      <p className="text-xs text-[#8a8a8a]">
                        {formatNaira(line.product.price)} each
                      </p>
                    </div>
                    <button
                      onClick={() => cart.removeLine(line.product.id)}
                      aria-label={`Remove ${line.product.name} from cart`}
                      className="touch-target flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#8a8a8a] hover:bg-[#ffefe8] hover:text-[#a82b00]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <QuantityStepper
                      quantity={line.quantity}
                      onDecrement={() =>
                        line.quantity === 1
                          ? cart.removeLine(line.product.id)
                          : cart.setQuantity(line.product.id, line.quantity - 1)
                      }
                      onIncrement={() => cart.addItem(line.product)}
                      incrementDisabled={atMax}
                      itemName={line.product.name}
                    />
                    <span className="font-bold text-[#111111]">
                      {formatNaira(line.product.price * line.quantity)}
                    </span>
                  </div>

                  <input
                    type="text"
                    value={line.specialRequest}
                    onChange={(event) =>
                      cart.setSpecialRequest(line.product.id, event.target.value)
                    }
                    placeholder="Note for vendor (optional)"
                    aria-label={`Special request for ${line.product.name}`}
                    className="mt-3 w-full rounded-xl border border-[var(--color-line-strong)] bg-[var(--color-surface-strong)] px-3 py-2 text-sm text-[#111111] outline-none placeholder:text-[#8a8a8a] focus:border-[#ff4500]"
                  />
                </div>
              );
            })}
          </div>

          <div className="mt-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-strong)] p-4 text-sm shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between text-[var(--color-ink-muted)]">
              <span>Subtotal</span>
              <span className="font-medium text-[#111111]">
                {formatNaira(cart.subtotal)}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[var(--color-ink-muted)]">
              <span>Delivery / service fee</span>
              <span className="font-medium text-[#111111]">
                {formatNaira(estimateTotal(cart.subtotal) - cart.subtotal)}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-[var(--color-line)] pt-3">
              <span className="font-semibold text-[#111111]">Total</span>
              <span className="font-bold text-[#111111]">
                {formatNaira(estimatedTotal)}
              </span>
            </div>
            <p className="mt-2 text-xs text-[#8a8a8a]">
              Final total is confirmed by the server when you place the order.
            </p>
          </div>

          <div className="mt-4 space-y-3">
            <input
              type="text"
              value={deliveryAddress}
              onChange={(event) => setDeliveryAddress(event.target.value)}
              placeholder="Delivery address (street, area, landmark)"
              aria-label="Delivery address"
              className="w-full rounded-xl border border-[var(--color-line-strong)] bg-[var(--color-surface-strong)] px-3 py-2.5 text-sm text-[#111111] outline-none placeholder:text-[#8a8a8a] focus:border-[#ff4500]"
            />
            {!hasAccessToken && (
              <input
                type="tel"
                value={guestPhone}
                onChange={(event) => setGuestPhone(event.target.value)}
                placeholder="Phone number: +2348123456789"
                aria-label="Phone number"
                autoComplete="tel"
                className="w-full rounded-xl border border-[var(--color-line-strong)] bg-[var(--color-surface-strong)] px-3 py-2.5 text-sm text-[#111111] outline-none placeholder:text-[#8a8a8a] focus:border-[#ff4500]"
              />
            )}
            <p className="flex items-center gap-1.5 text-xs text-[#8a8a8a]">
              <MapPin className="h-3.5 w-3.5 text-[#ff4500]" />
              {deliveryCoords
                ? "Using your current location"
                : "Your location is used only to help the rider, if allowed."}
            </p>
          </div>

          {feedback && (
            <div
              className={`mt-4 rounded-lg border px-3 py-2 text-sm ${
                feedback.kind === "error"
                  ? "border-[#ffd9c7] bg-[#fff2ea] text-[#a82b00]"
                  : feedback.kind === "success"
                    ? "border-[#bfe3c4] bg-[#edf7ee] text-[#2e7d32]"
                    : "border-[#ffe3b8] bg-[#fff7ec] text-[#7a4b10]"
              }`}
            >
              {feedback.text}
            </div>
          )}

          <div className="fixed bottom-0 right-0 z-50 w-full max-w-xl border-t border-[var(--color-line)] bg-[var(--color-surface-strong)] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-10px_30px_rgba(0,0,0,0.08)]">
            <div className="mb-3 flex items-center justify-between text-sm">
              <span className="inline-flex items-center gap-2 font-semibold text-[#111111]">
                <ShoppingCart className="h-4 w-4 text-[#ff4500]" />
                {cart.cartCount} {cart.cartCount === 1 ? "item" : "items"}
              </span>
              <span className="font-bold text-[#111111]">
                {formatNaira(estimatedTotal)}
              </span>
            </div>
            <button
              onClick={handleCheckout}
              disabled={submitting || cart.lines.length === 0}
              className="w-full rounded-xl bg-[#ff4500] px-4 py-3 text-sm font-bold text-white hover:bg-[#e63d00] disabled:cursor-not-allowed disabled:bg-[#f1edea] disabled:text-[#8a8a8a]"
            >
              {submitting
                ? "Placing order…"
                : `Place order • ${formatNaira(estimatedTotal)}`}
            </button>
            <p className="mt-2 text-center text-xs text-[#8a8a8a]">
You&apos;ll complete payment securely with Paystack after placing the
          order.
            </p>
          </div>
        </>
      )}
    </div>
  );
}