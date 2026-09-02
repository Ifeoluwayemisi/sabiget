"use client";

import { useState } from "react";
import {
  ChefHat,
  Clock3,
  MapPin,
  Minus,
  Plus,
  ShoppingCart,
  Star,
} from "lucide-react";
import type { ProductItem, VendorMenuInfo } from "@/lib/menu";
import type { UseCartReturn } from "@/hooks/useCart";
import { formatNaira } from "@/lib/format";
import { estimateTotal } from "@/lib/pricing";

interface StorefrontViewProps {
  menu: VendorMenuInfo;
  cart: UseCartReturn;
  onOpenCart: () => void;
}

function MenuImage({
  src,
  alt,
}: {
  src: string | null;
  alt: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-[#ffefe8] to-[#ffd9c7]">
        <ChefHat className="h-8 w-8 text-[#ff4500]" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-full w-full object-cover"
    />
  );
}

function VendorOverview({ menu }: { menu: VendorMenuInfo }) {
  return (
    <div className="border-b border-[var(--color-line)]">
      <div className="h-28 w-full overflow-hidden">
        {menu.bannerImage ? (
          <MenuImage src={menu.bannerImage} alt="" />
        ) : (
          <div className="h-full w-full bg-linear-to-br from-[#ff4500] to-[#ff6a00]" />
        )}
      </div>

      <div className="px-5 pb-4 pt-3">
        <div className="flex items-center gap-3">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border-2 border-white bg-[var(--color-brand-soft)] shadow-[var(--shadow-card)]">
            {menu.logo ? (
              <MenuImage src={menu.logo} alt={`${menu.name} logo`} />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-[#ff4500] to-[#ff6a00] text-xl font-bold text-white">
                {menu.name.slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-xl font-bold text-[#111111]">
                {menu.name}
              </h2>
              <span className="rounded-full bg-[var(--color-brand-soft)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#a82b00]">
                Open
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[#5f5a57]">
              {menu.averageRating != null && (
                <span className="inline-flex items-center gap-1 font-semibold text-[#111111]">
                  <Star className="h-3.5 w-3.5 fill-[#ff4500] text-[#ff4500]" />
                  {menu.averageRating.toFixed(1)}
                  {menu.totalReviews != null && (
                    <span className="font-normal text-[#8a8a8a]">
                      ({menu.totalReviews})
                    </span>
                  )}
                </span>
              )}
              {menu.lga && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-[#ff4500]" />
                  {menu.lga}
                </span>
              )}
              {menu.estimatedDeliveryMinutes != null && (
                <span className="inline-flex items-center gap-1">
                  <Clock3 className="h-3.5 w-3.5 text-[#ff4500]" />
                  ~{menu.estimatedDeliveryMinutes} min
                </span>
              )}
            </div>
          </div>
        </div>

        {menu.description && (
          <p className="mt-3 text-sm text-[var(--color-ink-muted)] line-clamp-2">
            {menu.description}
          </p>
        )}
      </div>
    </div>
  );
}

function scrollToCategory(index: number) {
  document
    .getElementById(`menu-category-${index}`)
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function CategoryScroller({ menu }: { menu: VendorMenuInfo }) {
  return (
    <nav className="sticky top-16 z-10 border-b border-[var(--color-line)] bg-[var(--color-surface-strong)] px-5 py-2">
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {menu.categories.map((category, index) => (
          <button
            key={category.category}
            onClick={() => scrollToCategory(index)}
            className="shrink-0 rounded-full border border-[var(--color-line-strong)] bg-[var(--color-surface-strong)] px-3.5 py-1.5 text-xs font-semibold text-[#111111] transition-colors hover:border-[#ff4500] hover:text-[#e63d00]"
          >
            {category.category}
          </button>
        ))}
      </div>
    </nav>
  );
}

function ProductCard({
  product,
  cart,
}: {
  product: ProductItem;
  cart: UseCartReturn;
}) {
  const line = cart.lines.find((entry) => entry.product.id === product.id);
  const quantity = line?.quantity ?? 0;
  const soldOut = product.stockQuantity === 0;
  const atMax =
    product.stockQuantity != null && quantity >= product.stockQuantity;
  const nearlySoldOut =
    product.stockQuantity != null &&
    product.stockQuantity > 0 &&
    product.stockQuantity <= 5 &&
    !atMax;

  return (
    <div
      className={`rounded-2xl border p-3 ${
        soldOut
          ? "border-[var(--color-line)] bg-[#faf7f5]"
          : "border-[var(--color-line)] bg-[var(--color-surface-strong)] shadow-[var(--shadow-card)]"
      }`}
    >
      <div className="flex gap-3">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-[var(--color-brand-soft)]">
          <MenuImage src={product.imageUrl} alt={product.name} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h4 className="font-bold text-[#111111]">{product.name}</h4>
              {product.description && (
                <p className="mt-1 line-clamp-2 text-sm text-[var(--color-ink-muted)]">
                  {product.description}
                </p>
              )}
            </div>

            {soldOut ? (
              <span className="shrink-0 rounded-full bg-[#f1edea] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#8a8a8a]">
                Sold out
              </span>
            ) : quantity === 0 ? (
              <button
                onClick={() => cart.addItem(product)}
                aria-label={`Add ${product.name} to cart`}
                className="touch-target flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ff4500] text-white hover:bg-[#e63d00]"
              >
                <Plus className="h-4 w-4" />
              </button>
            ) : (
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() =>
                    quantity === 1
                      ? cart.removeLine(product.id)
                      : cart.setQuantity(product.id, quantity - 1)
                  }
                  aria-label={`Remove one ${product.name}`}
                  className="touch-target flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-line-strong)] text-[#111111] hover:bg-[#fff2ea]"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-6 text-center text-sm font-bold text-[#111111]">
                  {quantity}
                </span>
                <button
                  onClick={() => cart.addItem(product)}
                  disabled={atMax}
                  aria-label={`Add one more ${product.name}`}
                  className="touch-target flex h-10 w-10 items-center justify-center rounded-full bg-[#ff4500] text-white hover:bg-[#e63d00] disabled:cursor-not-allowed disabled:bg-[#ffb38f]"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
            <span className="font-bold text-[#111111]">
              {formatNaira(product.price)}
            </span>
            {!soldOut && product.preparationTime != null && (
              <span className="inline-flex items-center gap-1 text-xs text-[#8a8a8a]">
                <Clock3 className="h-3.5 w-3.5" />
                {product.preparationTime} min
              </span>
            )}
            {soldOut ? (
              <span className="text-xs font-semibold text-[#a82b00]">
                Available soon
              </span>
            ) : nearlySoldOut ? (
              <span className="text-xs font-semibold text-[#a82b00]">
                Only {product.stockQuantity} left
              </span>
            ) : null}
          </div>

          {product.tags && product.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {product.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-[var(--color-brand-soft)] px-2 py-1 text-[10px] font-semibold text-[#a82b00]"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function StorefrontView({
  menu,
  cart,
  onOpenCart,
}: StorefrontViewProps) {
  return (
    <div className="pb-36">
      <VendorOverview menu={menu} />
      <CategoryScroller menu={menu} />

      <div className="px-5 py-5">
        <div className="space-y-10">
          {menu.categories.map((category, index) => (
            <section
              key={category.category}
              id={`menu-category-${index}`}
              className="scroll-mt-36"
            >
              <h3 className="mb-4 text-lg font-bold text-[#111111]">
                {category.category}
              </h3>
              <div className="space-y-4">
                {category.products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    cart={cart}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      {cart.cartCount > 0 && (
        <div className="fixed bottom-0 right-0 z-50 w-full max-w-xl border-t border-[var(--color-line)] bg-[var(--color-surface-strong)] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-10px_30px_rgba(0,0,0,0.08)]">
          <button
            onClick={onOpenCart}
            className="sabiget-punch flex w-full items-center justify-between rounded-2xl px-4 py-3.5 text-white"
          >
            <span className="inline-flex items-center gap-2 text-sm font-bold">
              <ShoppingCart className="h-4 w-4" />
              {cart.cartCount} {cart.cartCount === 1 ? "item" : "items"} · View
              cart
            </span>
            <span className="text-sm font-bold">
              {formatNaira(estimateTotal(cart.subtotal))}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}