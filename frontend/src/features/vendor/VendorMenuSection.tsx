"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  AlertTriangle,
  Check,
  X,
  Store,
} from "lucide-react";
import {
  createProduct,
  deleteProduct,
  fetchVendorProducts,
  updateProduct,
  type Product,
  type ProductPayload,
} from "@/lib/api/products";
import ProductFormModal from "@/features/vendor/ProductFormModal";

function formatPrice(value: number): string {
  return Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
}

export default function VendorMenuSection() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    try {
      const list = await fetchVendorProducts();
      setProducts(list);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load your menu.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      await loadProducts();
    };
    void load();
  }, [loadProducts]);

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 4000);
  };

  const openCreate = () => {
    setEditingProduct(null);
    setShowForm(true);
  };

  const openEdit = (product: Product) => {
    setEditingProduct(product);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingProduct(null);
  };

  const reload = () => {
    setError(null);
    setLoading(true);
    return loadProducts();
  };

  // Mutation succeeds before reconciliation: createProduct/updateProduct throw
  // on API failure, so a thrown error here means the operation did NOT happen.
  // loadProducts never throws (it surfaces its own error state).
  const handleSubmit = async (payload: ProductPayload) => {
    if (editingProduct) {
      await updateProduct(editingProduct.id, payload);
    } else {
      await createProduct(payload);
    }
    await reload();
    showNotice(
      editingProduct ? "Product updated." : "Product added to your menu.",
    );
  };

  const handleToggleAvailability = async (product: Product) => {
    setBusyId(product.id);
    try {
      await updateProduct(product.id, {
        isAvailable: !product.isAvailable,
      });
      await reload();
    } catch (toggleError) {
      setError(
        toggleError instanceof Error
          ? toggleError.message
          : "Could not update product availability.",
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (product: Product) => {
    const confirmed = window.confirm(
      `Delete "${product.name}"?\n\nIt will be removed from your menu. This can't be undone.`,
    );
    if (!confirmed) return;
    setBusyId(product.id);
    try {
      await deleteProduct(product.id);
      await reload();
      showNotice("Product deleted.");
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Could not delete the product.",
      );
    } finally {
      setBusyId(null);
    }
  };

  const categorySuggestions = useMemo(
    () =>
      Array.from(
        new Set(
          products
            .map((product) => product.category)
            .filter((category): category is string => Boolean(category)),
        ),
      ).sort(),
    [products],
  );

  return (
    <section aria-label="Menu management" className="sabiget-card p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="sabiget-badge sabiget-badge-brand">Menu</p>
          <h2 className="mt-2 text-2xl font-black text-[var(--color-ink)]">
            Products
          </h2>
          <p className="mt-0.5 text-sm text-[var(--color-ink-muted)]">
            {loading
              ? "Loading your menu..."
              : `${products.length} ${products.length === 1 ? "item" : "items"} on your menu`}
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="sabiget-punch inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-brand)]"
        >
          <Plus className="h-4 w-4" />
          Add product
        </button>
      </div>

      <AnimatePresence>
        {notice && (
          <motion.div
            key="notice"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            role="status"
            className="mt-4 flex items-center gap-2 rounded-xl border border-[rgba(46,125,50,0.2)] bg-[var(--color-accent-soft)] px-3 py-2 text-sm font-semibold text-[var(--color-accent)]"
          >
            <Check className="h-4 w-4" />
            {notice}
          </motion.div>
        )}
      </AnimatePresence>

      {loading && (
        <div className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-[var(--color-surface-muted)] px-4 py-10 text-sm text-[var(--color-ink-muted)]">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--color-brand)]" />
          Loading your menu...
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mt-5 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-red-700">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
          <button
            type="button"
            onClick={() => void reload()}
            className="inline-flex min-h-[40px] w-fit items-center rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && products.length === 0 && (
        <div className="mt-5 flex flex-col items-center rounded-xl border border-dashed border-[var(--color-line-strong)] bg-[var(--color-surface-muted)] px-4 py-12 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-brand-soft)] text-[var(--color-brand)]">
            <Store className="h-7 w-7" />
          </span>
          <h3 className="mt-4 text-base font-bold text-[var(--color-ink)]">
            Your menu is empty
          </h3>
          <p className="mt-1 max-w-xs text-sm text-[var(--color-ink-muted)]">
            Add your first food item so customers can start ordering from your
            store.
          </p>
          <button
            type="button"
            onClick={openCreate}
            className="sabiget-punch mt-4 inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold"
          >
            <Plus className="h-4 w-4" />
            Add product
          </button>
        </div>
      )}

      {!loading && !error && products.length > 0 && (
        <ul className="mt-5 space-y-3">
          {products.map((product) => {
            const busy = busyId === product.id;
            return (
              <li
                key={product.id}
                className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4 transition-transform hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)]"
              >
                <div className="flex items-start gap-3">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[var(--color-brand-soft)]">
                    {product.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={product.imageUrl}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <Store className="mx-auto mt-5 h-6 w-6 text-[var(--color-brand)]" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-base font-bold text-[var(--color-ink)]">
                        {product.name}
                      </h3>
                      {product.category && (
                        <span className="rounded-full bg-[var(--color-brand-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--color-brand-deep)]">
                          {product.category}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-lg font-black text-[var(--color-ink)]">
                      ₦{formatPrice(product.price)}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-[var(--color-ink-muted)]">
                      {product.stockQuantity == null
                        ? "Unlimited stock"
                        : `${product.stockQuantity} in stock`}
                    </p>
                  </div>
                  <div className="ml-auto shrink-0">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={product.isAvailable}
                    aria-label={`${product.isAvailable ? "Hide" : "Show"} ${product.name} to customers`}
                    onClick={() => handleToggleAvailability(product)}
                    disabled={busy !== null}
                    className={`inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                      product.isAvailable
                        ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)] hover:bg-[#dcefdc]"
                        : "bg-[var(--color-surface-muted)] text-[var(--color-ink-muted)] hover:bg-[#f4e5d8]"
                    }`}
                  >
                    {busy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : product.isAvailable ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <X className="h-3.5 w-3.5" />
                    )}
                    {product.isAvailable ? "Available" : "Unavailable"}
                  </button>
                  </div>
                </div>

                {product.description && (
                  <p className="mt-2 line-clamp-2 text-sm text-[var(--color-ink-muted)]">
                    {product.description}
                  </p>
                )}

                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(product)}
                    disabled={busy !== null}
                    className="sabiget-outline inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-colors hover:border-[var(--color-brand)] disabled:opacity-50"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(product)}
                    disabled={busy !== null}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {busy ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ProductFormModal
        isOpen={showForm}
        mode={editingProduct ? "edit" : "create"}
        product={editingProduct}
        categories={categorySuggestions}
        onClose={closeForm}
        onSubmit={handleSubmit}
      />
    </section>
  );
}
