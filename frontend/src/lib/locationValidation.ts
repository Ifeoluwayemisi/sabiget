// Client-side vendor-location validation (UX layer). The backend is the
// security boundary and re-validates everything; these helpers keep the
// onboarding form honest and give actionable messages.

/** Beyond this radius (metres) a geolocation fix is too uncertain to present
 * as the vendor's store location. */
export const MAX_RELIABLE_ACCURACY_M = 1500;

export type VendorLocationSource =
  | "BROWSER_GEOLOCATION"
  | "MANUAL_COORDINATES";

export function isValidLatitude(value: number): boolean {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

export function isValidLongitude(value: number): boolean {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}

/** Parse a coordinate input. Whitespace/empty → null; anything non-finite → null. */
export function parseCoordinate(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

export function accuracyIsReliable(accuracyMetres: number): boolean {
  return Number.isFinite(accuracyMetres) && accuracyMetres <= MAX_RELIABLE_ACCURACY_M;
}

export interface CoordinateValidationResult {
  ok: boolean;
  /** Human-readable message for UX when `ok` is false. */
  message: string | null;
}

/**
 * Validate a coordinate pair as entered by a vendor. Latitude/longitude are
 * inseparable (both or neither) and ranges are enforced. Validation is
 * deliberately country-agnostic — no country/region bounds are applied.
 */
export function validateVendorCoordinates(
  latitudeRaw: string,
  longitudeRaw: string,
): CoordinateValidationResult {
  const latPresent = latitudeRaw.trim() !== "";
  const lonPresent = longitudeRaw.trim() !== "";

  if (!latPresent && !lonPresent) {
    return { ok: false, message: "Latitude and longitude are required." };
  }
  if (latPresent !== lonPresent) {
    return {
      ok: false,
      message: "Latitude and longitude must be provided together.",
    };
  }

  const lat = parseCoordinate(latitudeRaw);
  const lon = parseCoordinate(longitudeRaw);
  if (lat === null) {
    return { ok: false, message: "Latitude must be a valid number." };
  }
  if (lon === null) {
    return { ok: false, message: "Longitude must be a valid number." };
  }
  if (!isValidLatitude(lat)) {
    return { ok: false, message: "Latitude must be between -90 and 90." };
  }
  if (!isValidLongitude(lon)) {
    return { ok: false, message: "Longitude must be between -180 and 180." };
  }
  return { ok: true, message: null };
}