export type VendorCardData = {
  id: string;
  name: string;
  image: string | null;
  rating: number | null;
  reviews: number;
  distanceKm: number;
  deliveryMinutes: number | null;
  category: string;
};

function asNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

export function mapNearbyVendor(record: Record<string, unknown>): VendorCardData | null {
  const id = asNonEmptyString(record.id);
  const name = asNonEmptyString(record.name);
  if (!id || !name) return null;

  const rawRating = asNumber(record.averageRating);
  const rawMinutes = asNumber(record.estimatedDeliveryMinutes);

  return {
    id,
    name,
    image: asNonEmptyString(record.bannerImage) ?? asNonEmptyString(record.logo),
    rating: rawRating !== null && rawRating > 0 ? rawRating : null,
    reviews: Math.max(0, Math.floor(asNumber(record.totalReviews) ?? 0)),
    distanceKm: Math.max(0, asNumber(record.distanceKm) ?? 0),
    deliveryMinutes:
      rawMinutes !== null && rawMinutes > 0 ? Math.round(rawMinutes) : null,
    category: asNonEmptyString(record.lga) ?? "Local",
  };
}
