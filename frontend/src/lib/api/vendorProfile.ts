import { apiRequest } from "@/lib/api/client";
import { locationLog } from "@/lib/locationDebug";

/**
 * Vendor store-setup profile API client.
 * Contracts (backend authoritative — vendorRoutes.js):
 *   GET   /vendors/profile    not a thing — profile comes from GET /vendors/me
 *   PATCH /vendors/profile    VENDOR auth; business info + location.
 * Location is only persisted as a unit: latitude and longitude must be sent
 * together and the LGA is computed server-side (never trusting client input).
 */

export interface VendorProfile {
  id: string;
  name: string;
  description: string | null;
  phone: string;
  email: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  lga: string | null;
  serviceRadius: number;
  isVerified: boolean;
  isActive: boolean;
  /** True when a Paystack subaccount already exists (backend-sourced). */
  paystackConfigured: boolean;
  totalProducts: number;
}

/** PATCH /vendors/profile accepts any subset of these keys. */
export interface VendorStoreSettingsPayload {
  name?: string;
  description?: string;
  phone?: string;
  email?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  serviceRadius?: number;
}

async function parseBackendError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as {
      error?: unknown;
      message?: unknown;
    };
    if (typeof data.error === "string" && data.error) return data.error;
    if (typeof data.message === "string" && data.message) return data.message;
  } catch {
    // fall through to the generic message when the body is not JSON
  }
  return "Store settings did not save. Please try again.";
}

function mapVendorProfile(raw: Record<string, unknown>): VendorProfile {
  return {
    id: String(raw.id || ""),
    name: String(raw.name || ""),
    description:
      typeof raw.description === "string" ? raw.description : null,
    phone: String(raw.phone || ""),
    email: typeof raw.email === "string" ? raw.email : null,
    address: typeof raw.address === "string" ? raw.address : null,
    latitude:
      typeof raw.latitude === "number" && Number.isFinite(raw.latitude)
        ? raw.latitude
        : null,
    longitude:
      typeof raw.longitude === "number" && Number.isFinite(raw.longitude)
        ? raw.longitude
        : null,
    lga: typeof raw.lga === "string" && raw.lga ? raw.lga : null,
    serviceRadius:
      typeof raw.serviceRadius === "number" ? raw.serviceRadius : 5,
    isVerified: Boolean(raw.isVerified),
    isActive: Boolean(raw.isActive),
    paystackConfigured: Boolean(raw.paystackSubcode),
    totalProducts:
      typeof raw.totalProducts === "number" ? raw.totalProducts : 0,
  };
}

/** Load the authenticated vendor's store-setup profile (GET /vendors/me). */
export async function fetchVendorProfile(): Promise<VendorProfile> {
  const response = await apiRequest("/vendors/me");
  if (!response.ok) {
    const message = await parseBackendError(response);
    const error = new Error(
      message === "Vendor profile not found"
        ? "Please sign in as a vendor to set up your store."
        : message,
    ) as Error & { status?: number };
    // Callers use `status` (e.g. 401) to decide between re-authentication and
    // a retryable error state.
    error.status = response.status;
    throw error;
  }
  const data = (await response.json()) as {
    success?: unknown;
    vendor?: Record<string, unknown> & { catalog?: unknown };
  };
  if (!data.vendor) {
    throw new Error("Unexpected response from the store setup service.");
  }
  const vendor = data.vendor;
  // Stage 7 diagnostic: log what the backend reports. This is a GET that
  // reflects persisted DB state; the store-location form holds its own local
  // state and is only remounted by parents via a key, so this value cannot
  // overwrite an in-progress manual/geolocated entry.
  locationLog(
    "/vendors/me hydration",
    "lat",
    typeof vendor.latitude === "number" ? vendor.latitude : null,
    "lng",
    typeof vendor.longitude === "number" ? vendor.longitude : null,
  );
  const catalog =
    typeof vendor.catalog === "object" && vendor.catalog !== null
      ? (vendor.catalog as { totalProducts?: unknown })
      : {};
  return mapVendorProfile({
    ...vendor,
    totalProducts:
      typeof catalog.totalProducts === "number" ? catalog.totalProducts : 0,
  });
}

/**
 * Update store details. The backend derives identity from the bearer token,
 * so a stale client `vendorId` is never relevant; only the current vendor's
 * row is updated.
 */
export async function updateVendorProfile(
  payload: VendorStoreSettingsPayload,
): Promise<VendorProfile> {
  const response = await apiRequest("/vendors/profile", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await parseBackendError(response));
  }
  const data = (await response.json()) as {
    success?: unknown;
    vendor?: Record<string, unknown>;
  };
  if (!data.vendor) {
    throw new Error("Unexpected response from the store setup service.");
  }
  return mapVendorProfile(data.vendor);
}