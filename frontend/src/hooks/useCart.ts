"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ProductItem } from "@/lib/menu";

export interface CartLine {
  product: ProductItem;
  quantity: number;
  specialRequest: string;
}

export type UseCartReturn = ReturnType<typeof useCart>;

function storageKey(vendorId: string): string {
  return `sabiget:cart:${vendorId}`;
}

function isProduct(value: unknown): value is ProductItem {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.name === "string" &&
    typeof record.price === "number"
  );
}

/** Read + validate a persisted cart. Corrupt rows are dropped silently. */
function loadStoredCart(vendorId: string | null): CartLine[] {
  if (!vendorId || typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(vendorId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is CartLine => {
      if (!entry || typeof entry !== "object") return false;
      const record = entry as Record<string, unknown>;
      return (
        isProduct(record.product) &&
        typeof record.quantity === "number" &&
        record.quantity > 0
      );
    });
  } catch {
    return [];
  }
}

function maxFor(product: ProductItem): number | null {
  return product.stockQuantity;
}

/** Clamp a quantity to the product's stock (null = unlimited). */
function clampQuantity(product: ProductItem, quantity: number): number {
  const capped = Math.max(1, Math.floor(quantity));
  const max = maxFor(product);
  return max == null ? capped : Math.min(capped, max);
}

export function useCart(
  vendorId: string | null,
): {
  lines: CartLine[];
  cartCount: number;
  subtotal: number;
  addItem: (product: ProductItem) => void;
  setQuantity: (productId: string, quantity: number) => void;
  setSpecialRequest: (productId: string, request: string) => void;
  removeLine: (productId: string) => void;
  clearCart: () => void;
  /** Drop lines whose products left the menu and clamp quantities to stock. */
  reconcileWithMenu: (availableProductIds: Set<string>) => void;
} {
  const [lines, setLines] = useState<CartLine[]>(() => loadStoredCart(vendorId));

  useEffect(() => {
    if (!vendorId) return;
    let cancelled = false;
    const load = async () => {
      const stored = loadStoredCart(vendorId);
      if (!cancelled) setLines(stored);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [vendorId]);

  useEffect(() => {
    if (!vendorId || typeof window === "undefined") return;
    window.localStorage.setItem(storageKey(vendorId), JSON.stringify(lines));
  }, [lines, vendorId]);

  const addItem = useCallback(
    (product: ProductItem) => {
      setLines((prev) => {
        const existing = prev.find((line) => line.product.id === product.id);
        if (existing) {
          return prev.map((line) =>
            line.product.id === product.id
              ? {
                  ...line,
                  quantity: clampQuantity(product, line.quantity + 1),
                }
              : line,
          );
        }
        if (product.stockQuantity === 0) return prev;
        return [
          ...prev,
          { product, quantity: 1, specialRequest: "" },
        ];
      });
    },
    [],
  );

  const setQuantity = useCallback(
    (productId: string, quantity: number) => {
      setLines((prev) =>
        prev.map((line) =>
          line.product.id === productId
            ? { ...line, quantity: clampQuantity(line.product, quantity) }
            : line,
        ),
      );
    },
    [],
  );

  const setSpecialRequest = useCallback(
    (productId: string, request: string) => {
      setLines((prev) =>
        prev.map((line) =>
          line.product.id === productId
            ? { ...line, specialRequest: request }
            : line,
        ),
      );
    },
    [],
  );

  const removeLine = useCallback((productId: string) => {
    setLines((prev) => prev.filter((line) => line.product.id !== productId));
  }, []);

  const clearCart = useCallback(() => {
    setLines([]);
    if (vendorId && typeof window !== "undefined") {
      window.localStorage.removeItem(storageKey(vendorId));
    }
  }, [vendorId]);

  const reconcileWithMenu = useCallback((availableProductIds: Set<string>) => {
    setLines((prev) =>
      prev
        .filter((line) => availableProductIds.has(line.product.id))
        .map((line) => ({
          ...line,
          quantity: clampQuantity(line.product, line.quantity),
        })),
    );
  }, []);

  const cartCount = useMemo(
    () => lines.reduce((count, line) => count + line.quantity, 0),
    [lines],
  );

  const subtotal = useMemo(
    () => lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0),
    [lines],
  );

  return {
    lines,
    cartCount,
    subtotal,
    addItem,
    setQuantity,
    setSpecialRequest,
    removeLine,
    clearCart,
    reconcileWithMenu,
  };
}