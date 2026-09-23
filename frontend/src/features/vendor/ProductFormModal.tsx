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
  ImagePlus,
} from "lucide-react";
import {
  uploadProductImage,
  type Product,
  type ProductPayload,
} from "@/lib/api/products";

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
  "w-full rounded-xl border border-[var(--color-line-strong)] bg-[var(--color-surface)] px-3.5 py-2.5 text-sm text-[var(--color-ink)] outline-none transition-colors focus:border-[var(--color-brand)] focus:ring-4 focus:ring-[rgba(255,69,0,0.12)]";

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
  const [stockQuantity, setStockQuantity] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageRemoved, setImageRemoved] = useState(false);
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
      setSelectedImage(null);
      setPreviewUrl(null);
      setImageRemoved(false);
      if (mode === "edit" && product) {
        setName(product.name);
        setDescription(product.description ?? "");
        setPrice(String(product.price));
        setCategory(product.category ?? "");
        setStockQuantity(
          product.stockQuantity == null ? "" : String(product.stockQuantity),
        );
        setImageUrl(product.imageUrl ?? "");
        setIsAvailable(product.isAvailable);
      } else {
        setName("");
        setDescription("");
        setPrice("");
        setCategory("");
        setStockQuantity("");
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

  useEffect(() => {
    if (!previewUrl?.startsWith("blob:")) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const handleImageChange = (file: File | undefined) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Product images must be 5 MB or smaller.");
      return;
    }
    setError(null);
    setSelectedImage(file);
    setPreviewUrl(URL.createObjectURL(file));
    setImageUrl("");
    setImageRemoved(false);
  };

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

    const parsedStock =
      stockQuantity.trim() === "" ? null : Number(stockQuantity);
    if (
      parsedStock !== null &&
      (!Number.isInteger(parsedStock) ||
        parsedStock < 0 ||
        parsedStock > 1000000)
    ) {
      setError("Stock quantity must be a whole number from 0 to 1,000,000.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      let savedImageUrl: string | null | undefined = imageRemoved
        ? null
        : trimmedImage || undefined;
      if (selectedImage) {
        savedImageUrl = await uploadProductImage(selectedImage);
      }
      await onSubmit({
        name: trimmedName,
        price: Number(numericPrice.toFixed(2)),
        description: description.trim() || undefined,
        category: category.trim() || undefined,
        imageUrl: savedImageUrl,
        stockQuantity: parsedStock,
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
            className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-strong)] p-5 shadow-[var(--shadow-soft)] sm:p-6"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="sabiget-badge sabiget-badge-brand">
                  Menu management
                </p>
                <h2
                  id="product-form-title"
                  className="mt-2 text-2xl font-bold text-[var(--color-ink)]"
                >
                  {mode === "edit" ? "Edit product" : "Add a product"}
                </h2>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                disabled={submitting}
                className="rounded-full p-2 text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-muted)] disabled:opacity-50"
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
                  className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-[var(--color-ink)]"
                >
                  <UtensilsCrossed className="h-4 w-4 text-[var(--color-brand)]" />
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
                  htmlFor="product-stock-quantity"
                  className="mb-1.5 block text-sm font-semibold text-[var(--color-ink)]"
                >
                  Stock quantity (optional)
                </label>
                <input
                  id="product-stock-quantity"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  value={stockQuantity}
                  onChange={(event) => setStockQuantity(event.target.value)}
                  placeholder="Leave blank for unlimited stock"
                  disabled={submitting}
                  className={inputClasses}
                />
              </div>

              <div>
                <label
                  htmlFor="product-description"
                  className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-[var(--color-ink)]"
                >
                  <AlignLeft className="h-4 w-4 text-[var(--color-brand)]" />
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
                  className="mb-1.5 block text-sm font-semibold text-[var(--color-ink)]"
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
                  className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-[var(--color-ink)]"
                >
                  <Tags className="h-4 w-4 text-[var(--color-brand)]" />
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
                  htmlFor="product-image-file"
                  className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-[var(--color-ink)]"
                >
                  <ImagePlus className="h-4 w-4 text-[var(--color-brand)]" />
                  Product image
                </label>
                {previewUrl || imageUrl ? (
                  <div className="mb-3 overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-brand-soft)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrl || imageUrl}
                      alt="Product preview"
                      className="h-36 w-full object-cover"
                    />
                  </div>
                ) : null}
                <input
                  id="product-image-file"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) =>
                    handleImageChange(event.target.files?.[0])
                  }
                  disabled={submitting}
                  className="block w-full cursor-pointer rounded-xl border border-dashed border-[var(--color-line-strong)] bg-[var(--color-surface-muted)] px-3 py-3 text-sm text-[var(--color-ink-muted)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--color-brand-soft)] file:px-3 file:py-2 file:text-xs file:font-bold file:text-[var(--color-brand-deep)]"
                />
                <p className="mt-1.5 text-xs text-[var(--color-ink-muted)]">
                  JPEG, PNG, or WebP up to 5 MB. Uploads are stored securely.
                </p>
                {(previewUrl || imageUrl) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedImage(null);
                      setPreviewUrl(null);
                      setImageUrl("");
                      setImageRemoved(true);
                    }}
                    disabled={submitting}
                    className="mt-2 text-xs font-bold text-red-600 hover:text-red-700 disabled:opacity-50"
                  >
                    Remove image
                  </button>
                )}
              </div>

              <div>
                <label
                  htmlFor="product-image-url"
                  className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-[var(--color-ink)]"
                >
                  <Link2 className="h-4 w-4 text-[var(--color-brand)]" />
                  Legacy image URL (optional)
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
                    ? "border-[rgba(46,125,50,0.2)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                    : "border-[var(--color-line)] bg-[var(--color-surface-muted)] text-[var(--color-ink-muted)]"
                }`}
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full ${
                    isAvailable
                      ? "bg-[var(--color-accent)] text-white"
                      : "bg-[#b7aaa2] text-white"
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
                  className="sabiget-outline rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="sabiget-punch flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold disabled:bg-[var(--color-line)] disabled:text-[var(--color-ink-muted)]"
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
