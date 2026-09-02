import { API_BASE_URL } from "@/lib/api/client";
import { mapVendorMenu, type VendorMenuInfo } from "@/lib/menu";
import { mapNearbyVendor, type VendorCardData } from "@/features/home/data/vendors";

export class NearbyVendorsError extends Error {}

export class VendorMenuError extends Error {}

type NearbyVendorsResponse = {
  success?: boolean;
  count?: number;
  vendors?: unknown;
};

export async function fetchNearbyVendors(options: {
  latitude: number;
  longitude: number;
  radiusKm?: number;
  signal?: AbortSignal;
}): Promise<VendorCardData[]> {
  const { latitude, longitude, radiusKm = 5, signal } = options;

  const response = await fetch(
    `${API_BASE_URL}/vendors/nearby?lat=${latitude}&lng=${longitude}&radius=${radiusKm}`,
    { headers: { Accept: "application/json" }, signal },
  );

  if (!response.ok) {
    throw new NearbyVendorsError(
      response.status >= 500
        ? "Discovery service is unavailable right now."
        : "We couldn't search around that location.",
    );
  }

  const data = (await response.json()) as NearbyVendorsResponse;

  if (!data || !Array.isArray(data.vendors)) {
    throw new NearbyVendorsError("Unexpected response from vendor discovery.");
  }

  return data.vendors
    .map((vendor) => mapNearbyVendor(vendor as Record<string, unknown>))
    .filter((vendor): vendor is VendorCardData => vendor !== null);
}

/** Fetch one vendor's typed menu (GET /customers/vendors/:vendorId/menu). */
export async function fetchVendorMenu(
  vendorId: string,
  options?: { signal?: AbortSignal },
): Promise<VendorMenuInfo> {
  const response = await fetch(`${API_BASE_URL}/customers/vendors/${vendorId}/menu`, {
    headers: { Accept: "application/json" },
    signal: options?.signal,
  });

  if (!response.ok) {
    throw new VendorMenuError(
      response.status >= 500
        ? "This vendor's menu is unavailable right now."
        : "We couldn't load this vendor's menu.",
    );
  }

  const data = (await response.json()) as Record<string, unknown>;

  const menu = mapVendorMenu(data);
  if (!menu) {
    throw new VendorMenuError("Unexpected response from the menu service.");
  }

  return menu;
}
