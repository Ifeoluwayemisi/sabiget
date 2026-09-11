"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Check,
  Loader2,
  UtensilsCrossed,
  AlignLeft,
  Tags,
  Link2,
} from "lucide-react";
import type { Product, ProductPayload } from "@/lib/api/products";

const modalVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { type: "spring", stiffness: 300, damping: 30 },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.2 },
  },
};

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const inputClasses =
  "w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 outline-none transition-colors focus:border-orange-500 focus:ring-2 focus:ring-orange-100";

interface ProductFormModalProps {
  isOpen: boolean;
  /** "create" for a blank form, "edit" to prefill from `product`. */
  mode: "create" | "edit";
  product: Product | null;
  /** Existing category names for the datalist suggestions. */
  categories: string[];
  onClose: () => void;
  /** Parent performs the API call + reconciliation and throws on failure. */
  onSubmit: (payload: ProductPayload) => Promise<void>;
}

export default function ProductFormModal({
  isOpen,
  mode,
  product,
  categories,
  onClose,
  onSubmit,
}: ProductFormModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isAvailable, setIsAvailable] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Reset the form every time the modal opens so a previous session's values
  // can never leak into the next attempt. Adjusting state while rendering
  // (React's documented pattern for reacting to a changing prop) beats an
  // effect here: it resets before first paint and avoids a cascading-render
  // lint error. Edit mode prefills from the product being edited.
  const [prevOpen, setPrevOpen] = useState(isOpen);
  if (prevOpen !== isOpen) {
    setPrevOpen(isOpen);
    if (isOpen) {
      setError(null);
      setSubmitting(false);
      if (mode === "edit" && product) {
        setName(product.name);
        setDescription(product.description ?? "");
        setPrice(String(product.price));
        setCategory(product.category ?? "");
        setImageUrl(product.imageUrl ?? "");
        setIsAvailable(product.isAvailable);
      } else {
        setName("");
        setDescription("");
        setPrice("");
        setCategory("");
        setImageUrl("");
        setIsAvailable(true);
      }
    }
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Enter a product name.");
      return;
    }

    const numericPrice = Number(price.replace(/[\s,]/g, ""));
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      setError("Enter a valid price greater than zero.");
      return;
    }

    const trimmedImage = imageUrl.trim();
    if (trimmedImage && !/^https?:\/\/\S+$/i.test(trimmedImage)) {
      setError("Image URL must start with http:// or https://.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        name: trimmedName,
        price: Number(numericPrice.toFixed(2)),
        description: description.trim() || undefined,
        category: category.trim() || undefined,
        imageUrl: trimmedImage || undefined,
        isAvailable,
      });
      onClose();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not save the product. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/50"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={() => {
              if (!submitting) onClose();
            }}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-form-title"
            className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[92%] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-500">
                  Menu management
                </p>
                <h2 id="product-form-title" className="mt-1 text-2xl font-bold text-gray-900">
                  {mode === "edit" ? "Edit product" : "Add a product"}
                </h2>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                disabled={submitting}
                className="rounded-full p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              className="mt-5 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void handleSubmit();
              }}
            >
              <div>
                <label
                  htmlFor="product-name"
                  className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-gray-700"
                >
                  <UtensilsCrossed className="h-4 w-4 text-orange-500" />
                  Product name
                </label>
                <input
                  id="product-name"
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Jollof Rice + Chicken"
                  autoComplete="off"
                  disabled={submitting}
                  className={inputClasses}
                />
              </div>

              <div>
                <label
                  htmlFor="product-description"
                  className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-gray-700"
                >
                  <AlignLeft className="h-4 w-4 text-orange-500" />
                  Description (optional)
                </label>
                <textarea
                  id="product-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Short summary your customers will see."
                  rows={3}
                  disabled={submitting}
                  className={`${inputClasses} resize-none`}
                />
              </div>

              <div>
                <label
                  htmlFor="product-price"
                  className="mb-1.5 block text-sm font-semibold text-gray-700"
                >
                  Price (₦)
                </label>
                <input
                  id="product-price"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                  placeholder="3500"
                  disabled={submitting}
                  className={inputClasses}
                />
              </div>

              <div>
                <label
                  htmlFor="product-category"
                  className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-gray-700"
                >
                  <Tags className="h-4 w-4 text-orange-500" />
                  Category (optional)
                </label>
                <input
                  id="product-category"
                  type="text"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  placeholder="e.g. Main Meals, Small Chops, Drinks"
                  autoComplete="off"
                  disabled={submitting}
                  list="product-category-options"
                  className={inputClasses}
                />
                <datalist id="product-category-options">
                  {categories.map((categoryName) => (
                    <option key={categoryName} value={categoryName} />
                  ))}
                </datalist>
              </div>

              <div>
                <label
                  htmlFor="product-image-url"
                  className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-gray-700"
                >
                  <Link2 className="h-4 w-4 text-orange-500" />
                  Image URL (optional)
                </label>
                <input
                  id="product-image-url"
                  type="url"
                  value={imageUrl}
                  onChange={(event) => setImageUrl(event.target.value)}
                  placeholder="https://example.com/photo.jpg"
                  autoComplete="off"
                  disabled={submitting}
                  className={inputClasses}
                />
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={isAvailable}
                onClick={() => setIsAvailable((prev) => !prev)}
                className={`flex w-full items-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition-colors ${
                  isAvailable
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-gray-200 bg-gray-50 text-gray-600"
                }`}
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full ${
                    isAvailable
                      ? "bg-emerald-500 text-white"
                      : "bg-gray-300 text-white"
                  }`}
                >
                  <Check className="h-4 w-4" />
                </span>
                {isAvailable
                  ? "Available for ordering"
                  : "Unavailable (hidden from customers)"}
              </button>

              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                >
                  {error}
                </div>
              )}

              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-600 disabled:bg-gray-300"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {mode === "edit" ? "Save changes" : "Add product"}
                </button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}