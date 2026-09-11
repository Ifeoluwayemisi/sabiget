// Reverse geocoding helper: GPS coordinates → human-readable address.
//
// Uses the OpenStreetMap Nominatim reverse endpoint (no API key, no Google
// Maps). The browser's own Referer identifies the request, which satisfies
// Nominatim's usage policy. The service is treated as unreliable: failures
// return null so callers degrade to a manual-address state instead of
// inventing addresses. LGA derivation stays with the SabiGet backend.

import { locationLog } from "@/lib/locationDebug";

interface NominatimAddress {
  road?: string;
  pedestrian?: string;
  footway?: string;
  path?: string;
  suburb?: string;
  neighbourhood?: string;
  city_district?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  state?: string;
}

interface NominatimReverseResponse {
  address?: NominatimAddress;
  display_name?: string;
}

function pickAddressParts(address: NominatimAddress): string[] {
  const parts = [
    address.road ?? address.pedestrian ?? address.footway ?? address.path,
    address.neighbourhood ??
      address.suburb ??
      address.city_district ??
      address.town ??
      address.village ??
      address.city ??
      address.municipality,
    address.state,
  ];
  return parts.filter((part): part is string => typeof part === "string" && part.trim() !== "");
}

/**
 * Resolve an address string for the given coordinates, or null when the
 * reverse-geocoding service is unavailable. The returned address always
 * corresponds to `latitude`/`longitude` — never to previously entered form
 * values.
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<string | null> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("zoom", "18");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));

  locationLog("reverse geocode input", "lat", latitude, "lng", longitude);

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) {
      locationLog("reverse geocode result", null);
      return null;
    }

    const data = (await response.json()) as NominatimReverseResponse;
    if (!data || typeof data !== "object") {
      locationLog("reverse geocode result", null);
      return null;
    }

    const parts = pickAddressParts(data.address ?? {});
    const address = parts.length > 0 ? parts.join(", ") : null;
    locationLog(
      "reverse geocode result",
      address ??
        (data.display_name?.trim() ? data.display_name.trim() : null),
    );
    if (parts.length > 0) return parts.join(", ");

    const displayName = data.display_name?.trim();
    return displayName ? displayName : null;
  } catch {
    locationLog("reverse geocode result", null);
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}