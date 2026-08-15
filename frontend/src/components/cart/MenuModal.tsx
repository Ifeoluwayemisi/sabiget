"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Clock, IndianRupee, Plus, Minus, ShoppingCart } from "lucide-react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

interface MenuModalProps {
  isOpen: boolean;
  vendorId: string | null;
  vendorName: string;
  onClose: () => void;
}

interface ProductItem {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl?: string;
  preparationTime?: number;
  tags?: string[];
}

interface MenuCategory {
  category: string;
  products: ProductItem[];
}

const fallbackMenu: Record<string, MenuCategory[]> = {
  default: [
    {
      category: "Popular",
      products: [
        {
          id: "demo-jollof",
          name: "Party Jollof Rice",
          description: "Rich tomato rice with grilled chicken and plantain.",
          price: 5400,
          preparationTime: 25,
          tags: ["Best seller", "Protein"],
        },
        {
          id: "demo-soup",
          name: "Pepper Soup Combo",
          description: "Spicy soup with fresh fish, yam and greens.",
          price: 6200,
          preparationTime: 20,
          tags: ["Hot", "Fresh"],
        },
        {
          id: "demo-burger",
          name: "Classic Chicken Burger",
          description: "Savory burger served with slaw and fries.",
          price: 4900,
          preparationTime: 18,
          tags: ["Quick", "Filling"],
        },
      ],
    },
  ],
};

export default function MenuModal({
  isOpen,
  vendorId,
  vendorName,
  onClose,
}: MenuModalProps) {
  const [categories, setCategories] = useState<MenuCategory[]>(
    fallbackMenu.default,
  );
  const [loading, setLoading] = useState(false);
  const [cart, setCart] = useState<
    Record<string, { product: ProductItem; quantity: number }>
  >({});
  const [guestPhone, setGuestPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [orderStatus, setOrderStatus] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [hasAccessToken, setHasAccessToken] = useState(false);

  useEffect(() => {
    setHasAccessToken(Boolean(localStorage.getItem("accessToken")));
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !vendorId) return;

    const fetchMenu = async () => {
      const token = localStorage.getItem("accessToken");
      setLoading(true);
      setOrderStatus(null);

      try {
        const response = await fetch(
          `${API_BASE_URL}/customers/vendors/${vendorId}/menu`,
          {
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
              "Content-Type": "application/json",
            },
          },
        );

        if (!response.ok) {
          throw new Error("Unable to load menu");
        }

        const data = await response.json();
        const nextCategories = data.vendor?.categories || fallbackMenu.default;
        setCategories(nextCategories);
      } catch (error) {
        console.error("Failed to load menu:", error);
        setCategories(fallbackMenu.default);
      } finally {
        setLoading(false);
      }
    };

    fetchMenu();
  }, [isOpen, vendorId]);

  const cartItems = useMemo(() => Object.values(cart), [cart]);

  const subtotal = cartItems.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0,
  );
  const serviceFee = cartItems.length > 0 ? 500 : 0;
  const total = subtotal + serviceFee;

  const addToCart = (product: ProductItem) => {
    setCart((prev) => {
      const current = prev[product.id];
      return {
        ...prev,
        [product.id]: {
          product,
          quantity: (current?.quantity || 0) + 1,
        },
      };
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) => {
      const current = prev[productId];
      if (!current) return prev;

      const nextQuantity = current.quantity + delta;
      if (nextQuantity <= 0) {
        const { [productId]: _removed, ...rest } = prev;
        return rest;
      }

      return {
        ...prev,
        [productId]: {
          ...current,
          quantity: nextQuantity,
        },
      };
    });
  };

  const handleCheckout = async () => {
    if (cartItems.length === 0) {
      setOrderStatus("Add at least one item before checkout.");
      return;
    }

    const token = localStorage.getItem("accessToken");

    if (!token && !guestPhone.trim()) {
      setOrderStatus("Please enter your phone number for guest checkout.");
      return;
    }

    if (!deliveryAddress.trim()) {
      setOrderStatus("Please add a delivery address.");
      return;
    }

    setCheckingOut(true);
    setOrderStatus(null);

    try {
      const payload = {
        vendorId,
        deliveryAddress,
        deliveryLat: 6.6018,
        deliveryLng: 3.3515,
        items: cartItems.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
          specialRequests: "",
        })),
        ...(token ? {} : { phone: guestPhone }),
      };

      const response = await fetch(
        `${API_BASE_URL}/orders${token ? "" : "/guest-checkout"}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || "Checkout failed");
      }

      if (data.orderId || data.id) {
        localStorage.setItem("latestOrderId", String(data.orderId || data.id));
      }

      if (data.authorizationUrl) {
        window.open(data.authorizationUrl, "_blank", "noopener,noreferrer");
        setOrderStatus(
          "Checkout started. Complete payment in the Paystack window.",
        );
      } else {
        setOrderStatus("Order created successfully.");
      }

      setCart({});
      setGuestPhone("");
      setDeliveryAddress("");
    } catch (error) {
      console.error("Checkout failed:", error);
      setOrderStatus(
        error instanceof Error
          ? error.message
          : "Checkout failed. Please try again.",
      );
    } finally {
      setCheckingOut(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/50 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            className="fixed right-0 top-0 h-full w-full max-w-xl bg-white z-50 shadow-2xl overflow-y-auto"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 240, damping: 26 }}
          >
            <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-orange-500 font-semibold">
                  Menu
                </p>
                <h2 className="text-2xl font-bold text-gray-900">
                  {vendorName}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-gray-100 text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 pb-32">
              {loading ? (
                <div className="text-center py-16 text-gray-500">
                  Loading menu...
                </div>
              ) : (
                <div className="space-y-8">
                  {categories.map((category) => (
                    <div key={category.category}>
                      <h3 className="text-lg font-bold text-gray-900 mb-4">
                        {category.category}
                      </h3>
                      <div className="space-y-4">
                        {category.products.map((product) => (
                          <div
                            key={product.id}
                            className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm"
                          >
                            <div className="flex gap-3">
                              <div className="h-20 w-20 rounded-xl overflow-hidden bg-gray-200 shrink-0">
                                <img
                                  src={
                                    product.imageUrl ||
                                    "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300&h=300&fit=crop"
                                  }
                                  alt={product.name}
                                  className="h-full w-full object-cover"
                                />
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <h4 className="font-bold text-gray-900">
                                      {product.name}
                                    </h4>
                                    <p className="text-sm text-gray-500 mt-1">
                                      {product.description ||
                                        "Freshly prepared and served hot."}
                                    </p>
                                  </div>
                                  <button
                                    onClick={() => addToCart(product)}
                                    className="rounded-full bg-orange-500 p-2 text-white hover:bg-orange-600"
                                  >
                                    <Plus className="w-4 h-4" />
                                  </button>
                                </div>

                                <div className="mt-3 flex items-center justify-between">
                                  <div className="flex items-center gap-4 text-sm text-gray-600">
                                    <span className="inline-flex items-center gap-1">
                                      <IndianRupee className="w-4 h-4" />
                                      {Number(product.price).toLocaleString()}
                                    </span>
                                    <span className="inline-flex items-center gap-1">
                                      <Clock className="w-4 h-4" />
                                      {product.preparationTime || 20} min
                                    </span>
                                  </div>
                                </div>

                                {product.tags && product.tags.length > 0 && (
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {product.tags.slice(0, 3).map((tag) => (
                                      <span
                                        key={tag}
                                        className="rounded-full bg-orange-50 text-orange-700 px-2 py-1 text-[10px] font-semibold"
                                      >
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="fixed bottom-0 right-0 w-full max-w-xl border-t border-gray-200 bg-white p-4 shadow-[0_-10px_30px_rgba(0,0,0,0.08)] z-50">
              <div className="mb-3 rounded-2xl bg-gray-50 p-3">
                <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                  <span className="inline-flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-orange-500" />
                    {cartItems.reduce(
                      (count, item) => count + item.quantity,
                      0,
                    )}{" "}
                    item(s)
                  </span>
                  <span>₦{total.toLocaleString()}</span>
                </div>

                {cartItems.map((item) => (
                  <div
                    key={item.product.id}
                    className="flex items-center justify-between py-2 border-b border-gray-200 last:border-b-0"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-800">
                        {item.product.name}
                      </span>
                      <span className="text-xs text-gray-500">
                        ₦{item.product.price.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.product.id, -1)}
                        className="rounded-full border border-gray-300 p-1"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-5 text-center text-sm font-medium">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.product.id, 1)}
                        className="rounded-full border border-gray-300 p-1"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {!hasAccessToken && (
                <div className="space-y-3 mb-3">
                  <input
                    type="tel"
                    value={guestPhone}
                    onChange={(event) => setGuestPhone(event.target.value)}
                    placeholder="Guest phone: +2348123456789"
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-orange-500"
                  />
                  <input
                    type="text"
                    value={deliveryAddress}
                    onChange={(event) => setDeliveryAddress(event.target.value)}
                    placeholder="Delivery address"
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-orange-500"
                  />
                </div>
              )}

              {orderStatus && (
                <div className="mb-3 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-700">
                  {orderStatus}
                </div>
              )}

              <button
                onClick={handleCheckout}
                disabled={checkingOut || cartItems.length === 0}
                className="w-full rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold text-white disabled:bg-gray-300"
              >
                {checkingOut
                  ? "Processing..."
                  : `Checkout • ₦${total.toLocaleString()}`}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
