/**
 * Types for the vendor menu endpoint (GET /customers/vendors/:vendorId/menu)
 * plus a defensive mapper from the raw backend JSON into typed shapes.
 * Product prices are display-only here: the backend is authoritative for
 * order totals and stock checks.
 */

export interface ProductItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  preparationTime: number | null;
  /** null means unlimited; 0 means sold out. Backend validated. */
  stockQuantity: number | null;
  tags: string[] | null;
}

export interface MenuCategory {
  category: string;
  products: ProductItem[];
}

export interface VendorMenuInfo {
  id: string;
  name: string;
  description: string | null;
  logo: string | null;
  bannerImage: string | null;
  averageRating: number | null;
  totalReviews: number | null;
  lga: string | null;
  estimatedDeliveryMinutes: number | null;
  categories: MenuCategory[];
}

type RawProduct = Record<string, unknown>;
type RawCategory = Record<string, unknown>;
type RawMenuResponse = Record<string, unknown>;

function toNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toStringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function mapProduct(raw: RawProduct): ProductItem | null {
  if (typeof raw.id !== "string" || typeof raw.name !== "string") return null;
  return {
    id: raw.id,
    name: raw.name,
    description: toStringOrNull(raw.description),
    price: toNumber(raw.price) ?? 0,
    imageUrl: toStringOrNull(raw.imageUrl),
    preparationTime: toNumber(raw.preparationTime),
    stockQuantity: toNumber(raw.stockQuantity),
    tags: Array.isArray(raw.tags)
      ? raw.tags.filter((tag): tag is string => typeof tag === "string")
      : null,
  };
}

function mapCategory(raw: RawCategory): MenuCategory | null {
  const category = typeof raw.category === "string" ? raw.category : null;
  const products = Array.isArray(raw.products) ? raw.products : [];
  const mapped = products
    .map((product) => mapProduct(product as RawProduct))
    .filter((product): product is ProductItem => product !== null);
  if (!category && mapped.length === 0) return null;
  return {
    category: category ?? "Uncategorized",
    products: mapped,
  };
}

/** Map the raw `/menu` response into typed data, discarding malformed rows. */
export function mapVendorMenu(raw: RawMenuResponse): VendorMenuInfo | null {
  const vendor = raw.vendor as RawMenuResponse | undefined;
  if (!vendor || typeof vendor !== "object") return null;

  const categories = Array.isArray(vendor.categories)
    ? vendor.categories
        .map((category) => mapCategory(category as RawCategory))
        .filter((category): category is MenuCategory => category !== null)
    : [];

  return {
    id: typeof vendor.id === "string" ? vendor.id : "unknown",
    name: typeof vendor.name === "string" ? vendor.name : "Vendor",
    description: toStringOrNull(vendor.description),
    logo: toStringOrNull(vendor.logo),
    bannerImage: toStringOrNull(vendor.bannerImage),
    averageRating: toNumber(vendor.averageRating),
    totalReviews: toNumber(vendor.totalReviews),
    lga: toStringOrNull(vendor.lga),
    estimatedDeliveryMinutes: toNumber(vendor.estimatedDeliveryMinutes),
    categories,
  };
}