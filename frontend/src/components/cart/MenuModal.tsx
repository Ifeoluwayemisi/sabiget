"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ShoppingCart, X } from "lucide-react";
import { fetchVendorMenu, VendorMenuError } from "@/lib/api/vendors";
import type { VendorMenuInfo } from "@/lib/menu";
import { useCart } from "@/hooks/useCart";
import StorefrontView from "@/components/cart/StorefrontView";
import CheckoutPanel from "@/components/cart/CheckoutPanel";

interface MenuModalProps {
  isOpen: boolean;
  vendorId: string | null;
  vendorName: string;
  onClose: () => void;
}

type MenuState = "idle" | "loading" | "success" | "error";

function MenuSkeleton() {
  return (
    <div className="space-y-4 p-5" aria-busy="true" aria-label="Loading menu">
      <div className="h-28 animate-pulse rounded-2xl bg-[var(--color-brand-soft)]" />
      <div className="space-y-3">
        <div className="h-4 w-1/3 animate-pulse rounded-full bg-[#f1edea]" />
        {[0, 1, 2].map((row) => (
          <div
            key={row}
            className="flex gap-3 rounded-2xl border border-[var(--color-line)] p-3"
          >
            <div className="h-20 w-20 animate-pulse rounded-xl bg-[#f1edea]" />
            <div className="flex-1 space-y-2 py-1">
              <div className="h-4 w-2/3 animate-pulse rounded-full bg-[#f1edea]" />
              <div className="h-3 w-5/6 animate-pulse rounded-full bg-[#f1edea]" />
              <div className="h-3 w-1/3 animate-pulse rounded-full bg-[#f1edea]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MenuErrorState({
  message,
  onRetry,
}: {
  message: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center px-5 py-16 text-center">
      <ShoppingCart className="h-10 w-10 text-[#ffb38f]" />
      <p className="mt-3 max-w-xs text-sm text-[var(--color-ink-muted)]">
        {message ?? "We couldn't load this vendor's menu. Please try again."}
      </p>
      <button
        onClick={onRetry}
        className="mt-5 rounded-xl bg-[#ff4500] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#e63d00]"
      >
        Retry
      </button>
    </div>
  );
}

function EmptyMenuState() {
  return (
    <div className="flex flex-col items-center px-5 py-16 text-center">
      <ShoppingCart className="h-10 w-10 text-[#ffb38f]" />
      <p className="mt-3 text-sm text-[var(--color-ink-muted)]">
        No items are available from this vendor right now.
      </p>
    </div>
  );
}

export default function MenuModal({
  isOpen,
  vendorId,
  vendorName,
  onClose,
}: MenuModalProps) {
  const [menu, setMenu] = useState<VendorMenuInfo | null>(null);
  const [menuState, setMenuState] = useState<MenuState>("idle");
  const [menuError, setMenuError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [view, setView] = useState<"storefront" | "cart">("storefront");

  const cart = useCart(vendorId);

  // Escape closes the drawer.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  // Fetch the menu for the active vendor and reset drawer view.
  useEffect(() => {
    if (!isOpen || !vendorId) return;

    let cancelled = false;
    const load = async () => {
      setMenuState("loading");
      setMenuError(null);
      setView("storefront");
      try {
        const info = await fetchVendorMenu(vendorId);
        if (cancelled) return;
        setMenu(info);
        setMenuState("success");
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to load menu:", error);
        setMenuState("error");
        setMenuError(
          error instanceof VendorMenuError
            ? error.message
            : "We couldn't load this vendor's menu. Please try again.",
        );
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [isOpen, vendorId, retryNonce]);

  // Prices/availability can change between menu fetches. Drop cart lines for
  // products that left the menu and clamp quantities to current stock rather
  // than letting the backend reject a stale cart later.
  useEffect(() => {
    if (!menu || cart.lines.length === 0) return;

    let cancelled = false;
    const available = new Set(
      menu.categories.flatMap((category) =>
        category.products.map((product) => product.id),
      ),
    );
    const reconcile = async () => {
      if (!cancelled) cart.reconcileWithMenu(available);
    };

    void reconcile();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menu, vendorId]);

  const hasProducts = useMemo(
    () =>
      Boolean(menu && menu.categories.some((category) => category.products.length > 0)),
    [menu],
  );

  const showBackToMenu =
    view === "cart" && menuState === "success" && menu && hasProducts;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`${vendorName} menu and checkout`}
            className="fixed right-0 top-0 z-50 h-full w-full max-w-xl overflow-y-auto bg-[var(--color-surface-strong)] shadow-2xl"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 240, damping: 26 }}
          >
            <div className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[var(--color-line)] bg-[var(--color-surface-strong)] px-4">
              <div className="flex items-center gap-2">
                {showBackToMenu && (
                  <button
                    onClick={() => setView("storefront")}
                    aria-label="Back to menu"
                    className="touch-target -ml-1 flex h-10 w-10 items-center justify-center rounded-full text-[#111111] hover:bg-[#fff2ea]"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                )}
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#e63d00]">
                    {view === "cart" ? "Checkout" : "Menu"}
                  </p>
                  <h2 className="truncate text-lg font-bold text-[#111111]">
                    {view === "cart" && showBackToMenu ? "Your order" : vendorName}
                  </h2>
                </div>
              </div>
              <button
                onClick={onClose}
                aria-label="Close menu"
                className="touch-target flex h-10 w-10 items-center justify-center rounded-full text-[#5f5a57] hover:bg-[#fff2ea]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {menuState === "loading" && <MenuSkeleton />}

            {menuState === "error" && (
              <MenuErrorState
                message={menuError}
                onRetry={() => setRetryNonce((nonce) => nonce + 1)}
              />
            )}

            {menuState === "success" && menu && !hasProducts && (
              <EmptyMenuState />
            )}

            {menuState === "success" && menu && hasProducts && (
              <AnimatePresence mode="wait">
                {view === "storefront" ? (
                  <motion.div
                    key="storefront"
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ duration: 0.18 }}
                  >
                    <StorefrontView
                      menu={menu}
                      cart={cart}
                      onOpenCart={() => setView("cart")}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="cart"
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 16 }}
                    transition={{ duration: 0.18 }}
                  >
                    <CheckoutPanel
                      vendorId={vendorId}
                      vendorName={vendorName}
                      cart={cart}
                      onBack={() => setView("storefront")}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}