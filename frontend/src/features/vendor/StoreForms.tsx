"use client";

import { useId, useRef, useState } from "react";
import { Crosshair, MapPin } from "lucide-react";
import {
  updateVendorProfile,
  type VendorProfile,
} from "@/lib/api/vendorProfile";
import { reverseGeocode } from "@/lib/geocode";
import { locationLog } from "@/lib/locationDebug";
import {
  accuracyIsReliable,
  isValidLatitude,
  isValidLongitude,
  parseCoordinate,
  validateVendorCoordinates,
  type VendorLocationSource,
} from "@/lib/locationValidation";

/**
 * Accessible inline "?" help. A normal user may not know Latitude, Longitude,
 * or Delivery radius, so each gets a small popover; the description is the
 * exact requested wording. Kept touch-friendly (click, not hover).
 */
function FieldHelp({
  label,
  description,
}: {
  label: string;
  description: string;
}) {
  const [open, setOpen] = useState(false);
  const popoverId = useId();
  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        aria-label={`${label} help`}
        aria-expanded={open}
        aria-controls={popoverId}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-gray-200 text-[11px] font-bold leading-none text-gray-600 transition hover:bg-orange-200 hover:text-orange-700"
      >
        ?
      </button>
      {open && (
        <span
          id={popoverId}
          role="tooltip"
          className="absolute left-0 top-full z-10 mt-1 w-60 rounded-lg border border-gray-200 bg-white p-2 text-xs leading-relaxed text-gray-600 shadow-lg"
        >
          {description}
          <span className="mt-1 block">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-orange-600 underline"
            >
              Got it
            </button>
          </span>
        </span>
      )}
    </span>
  );
}

const STOP_SIGNIFICANT_TOKENS = new Set([
  "nigeria",
  "street",
  "road",
  "avenue",
  "close",
  "lane",
  "drive",
  "state",
  "local",
  "government",
  "district",
  "north",
  "south",
  "east",
  "west",
]);

function significantTokens(value: string): Set<string> {
  const tokens = value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 4);
  return new Set(tokens);
}

/**
 * Heuristic for "are these two addresses clearly inconsistent?". Used only to
 * warn a vendor whose manually-typed address does not match the coordinates
 * they entered. Sharing at least one significant place token is treated as
 * consistent; the coordinates remain the geographic source of truth.
 */
function addressesClearlyDiffer(typedAddress: string, derivedAddress: string): boolean {
  const typed = significantTokens(typedAddress);
  const derived = significantTokens(derivedAddress);
  for (const token of typed) {
    if (token.length >= 4 && !STOP_SIGNIFICANT_TOKENS.has(token) && derived.has(token)) {
      return false;
    }
  }
  return true;
}

/**
 * Reusable business-information form (PATCH /vendors/profile).
 * Shared by the onboarding flow and the dashboard Store section so the
 * business-info fields and save behavior live in exactly one place.
 * State hydrates from `profile` on mount (parents remount via a key when they
 * want a fresh form); saving only ever writes through the backend.
 */
export function BusinessInfoForm({
  profile,
  onSaved,
}: {
  profile: VendorProfile;
  onSaved: (updated: VendorProfile) => void;
}) {
  const [business, setBusiness] = useState({
    name: profile.name,
    description: profile.description ?? "",
    phone: profile.phone,
    email: profile.email ?? "",
    address: profile.address ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const save = async () => {
    const name = business.name.trim();
    const description = business.description.trim();
    const phone = business.phone.trim();

    if (!name || !description) {
      setError(
        "Business name and description are required to finish this step.",
      );
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const updated = await updateVendorProfile({
        name,
        description,
        phone,
        email: business.email.trim() || undefined,
        address: business.address.trim() || undefined,
      });
      onSaved(updated);
      setNotice("Business information saved.");
      window.setTimeout(() => setNotice(null), 4000);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save your business information.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-gray-700">
          Business name
        </span>
        <input
          type="text"
          value={business.name}
          onChange={(event) =>
            setBusiness((prev) => ({ ...prev, name: event.target.value }))
          }
          className="w-full rounded-xl border border-gray-300 px-3 py-3 text-sm outline-none focus:border-orange-500"
          placeholder="Buka & Flame"
        />
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-gray-700">
          Description
        </span>
        <textarea
          value={business.description}
          onChange={(event) =>
            setBusiness((prev) => ({
              ...prev,
              description: event.target.value,
            }))
          }
          rows={3}
          className="w-full resize-none rounded-xl border border-gray-300 px-3 py-3 text-sm outline-none focus:border-orange-500"
          placeholder="What do you make? E.g. smoky suya, fresh jollof rice and grilled chicken."
        />
      </label>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-gray-700">
            Business phone
          </span>
          <input
            type="tel"
            inputMode="tel"
            value={business.phone}
            onChange={(event) =>
              setBusiness((prev) => ({ ...prev, phone: event.target.value }))
            }
            className="w-full rounded-xl border border-gray-300 px-3 py-3 text-sm outline-none focus:border-orange-500"
            placeholder="+2348123456789"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-gray-700">
            Email
          </span>
          <input
            type="email"
            inputMode="email"
            value={business.email}
            onChange={(event) =>
              setBusiness((prev) => ({ ...prev, email: event.target.value }))
            }
            className="w-full rounded-xl border border-gray-300 px-3 py-3 text-sm outline-none focus:border-orange-500"
            placeholder="store@business.com"
          />
        </label>
      </div>
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-gray-700">
          Store address
        </span>
        <input
          type="text"
          value={business.address}
          onChange={(event) =>
            setBusiness((prev) => ({ ...prev, address: event.target.value }))
          }
          className="w-full rounded-xl border border-gray-300 px-3 py-3 text-sm outline-none focus:border-orange-500"
          placeholder="Street, neighbourhood (optional)"
        />
      </label>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </div>
      )}
      {notice && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
        >
          {notice}
        </div>
      )}

      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-bold text-white disabled:bg-gray-300"
      >
        {saving ? "Saving..." : "Save business information"}
      </button>
    </div>
  );
}

/**
 * Reusable store-location form. "Use my current location" reads the browser's
 * GPS fix at runtime, validates its accuracy, reverse-geocodes THOSE exact
 * coordinates, and fills the address accordingly — no coordinates are ever
 * hardcoded, defaulted, or substituted. When detection fails or is too
 * inaccurate, nothing is shown as the location: the vendor retries or uses the
 * manual-coordinates flow. Manual entry requires matching coordinates +
 * address; mismatched address/coordinates are blocked. Save persists the
 * coordinates; the backend derives the LGA server-side and is authoritative.
 */
export function StoreLocationForm({
  profile,
  onSaved,
}: {
  profile: VendorProfile;
  onSaved: (updated: VendorProfile) => void;
}) {
  const [location, setLocation] = useState({
    latitude:
      profile.latitude !== null ? String(profile.latitude) : "",
    longitude:
      profile.longitude !== null ? String(profile.longitude) : "",
    serviceRadius: String(profile.serviceRadius ?? 5),
    address: profile.address ?? "",
  });
  // Source tracking (Part 4): used for diagnostics/auditing and to know when a
  // form address was derived from the current coordinates. Not persisted — no
  // schema field is required for this decision (see final report).
  const [locationSource, setLocationSource] =
    useState<VendorLocationSource | null>(null);
  // True only while the address text was generated from the CURRENT
  // coordinates by this form (then no address/coordinate mismatch is possible).
  const [addressDerived, setAddressDerived] = useState(false);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // True only while a geolocation attempt has failed/rejected and the notice
  // should offer recovery actions (Try again / Enter location manually).
  const [showRecovery, setShowRecovery] = useState(false);
  const manualLocationRef = useRef<HTMLDivElement>(null);
  const latitudeInputRef = useRef<HTMLInputElement>(null);

  const useCurrentLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setNotice(
        "Location detection isn't supported here, so your location couldn't be detected accurately. Enter your store's coordinates manually below.",
      );
      return;
    }
    setLocating(true);
    setError(null);
    setNotice(null);
    setShowRecovery(false);

    // On any detection failure or unusable fix, the form fields are cleared so
    // stale/old values can never be mistaken for a freshly detected location.
    const showDetectionProblem = (message: string) => {
      setLocation((prev) => ({
        ...prev,
        latitude: "",
        longitude: "",
        address: "",
      }));
      setLocationSource(null);
      setAddressDerived(false);
      setLocating(false);
      setShowRecovery(true);
      setNotice(message);
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        // Stage 1 diagnostic: the exact raw browser fix. If this value IS the
        // Obalende coordinates, the origin is the device's location provider
        // (typically WiFi/IP based — no SabiGet code produced them).
        locationLog(
          "browser raw",
          "lat",
          position.coords.latitude,
          "lng",
          position.coords.longitude,
          "accuracy",
          position.coords.accuracy,
          "timestamp",
          position.timestamp,
        );

        if (!accuracyIsReliable(position.coords.accuracy)) {
          locationLog(
            "accuracy rejected",
            "accuracy",
            position.coords.accuracy,
          );
          // The device fix itself may be real but too uncertain to present as
          // the store location. Lead with plain language; accuracy is only a
          // secondary detail, not the headline.
          showDetectionProblem(
            `Your device location is too uncertain to use as your store's location. Try again, or enter your location manually below. It was only accurate to about ${Math.round(
              position.coords.accuracy,
            )} m.`,
          );
          return;
        }

        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) {
          locationLog("out-of-range fix rejected", "lat", latitude, "lng", longitude);
          showDetectionProblem(
            "Your device returned an invalid location. Try again, or enter the location manually below.",
          );
          return;
        }

        // Freshness (Part 2): enableHighAccuracy + maximumAge 0 already ensure
        // a current fix; the timestamp above is part of the diagnostic chain.
        // Precision is preserved — values are not rounded to a coarse default.
        setLocation((prev) => ({
          ...prev,
          latitude: String(latitude),
          longitude: String(longitude),
          address: "",
        }));
        // Stage 2 diagnostic: exactly what the form now holds.
        locationLog(
          "form after geolocation",
          "lat",
          String(latitude),
          "lng",
          String(longitude),
        );
        setLocationSource("BROWSER_GEOLOCATION");
        setAddressDerived(false);

        const loadReverseGeocodedAddress = async () => {
          const geoAddress = await reverseGeocode(latitude, longitude);
          setLocating(false);
          if (geoAddress) {
            setLocation((prev) => ({ ...prev, address: geoAddress }));
            setAddressDerived(true);
            setNotice(
              "Location found. Review the address and coordinates, then save your store location.",
            );
          } else {
            setLocation((prev) => ({ ...prev, address: "" }));
            setAddressDerived(false);
            setNotice(
              "We couldn't auto-fill an address for these coordinates. Review them and enter the address manually.",
            );
          }
        };
        void loadReverseGeocodedAddress();
      },
      (geoError) => {
        const permissionDenied = geoError.code === geoError.PERMISSION_DENIED;
        locationLog(
          "geolocation failed",
          permissionDenied ? "denied" : "unavailable",
        );
        showDetectionProblem(
          permissionDenied
            ? "Your location couldn't be detected because access was denied. Allow location access and try again, or enter the coordinates manually."
            : "Your location couldn't be detected accurately. Try again, or enter the coordinates manually below.",
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  const focusManualLocationFields = () => {
    manualLocationRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
    // Focus after the scroll settles so the caret lands on the right field.
    window.setTimeout(() => {
      latitudeInputRef.current?.focus({ preventScroll: true });
    }, 350);
  };

  const save = async () => {
    // Coordinates are inseparable and range-checked client-side (the backend
    // re-validates and is the security boundary). An address on its own is
    // never enough, and an address that contradicts the coordinates blocks the
    // save — coordinates remain the geographic source of truth.
    const latitudeRaw = location.latitude.trim();
    const longitudeRaw = location.longitude.trim();

    const validation = validateVendorCoordinates(latitudeRaw, longitudeRaw);
    if (!validation.ok) {
      setError(validation.message);
      return;
    }

    // Precision is preserved: the raw numeric value is sent, never a coarse
    // rounded/truncated default.
    const latitude = parseCoordinate(latitudeRaw) as number;
    const longitude = parseCoordinate(longitudeRaw) as number;
    const typedAddress = location.address.trim();

    setSaving(true);
    setError(null);
    setShowRecovery(false);

    try {
      let address = typedAddress;
      if (!address) {
        // Coordinates without a matching address: derive it from these exact
        // coordinates. If the geocoder is unavailable, reject rather than
        // presenting coordinates alone as a complete store location.
        const geoAddress = await reverseGeocode(latitude, longitude);
        if (!geoAddress) {
          setError(
            "We couldn't auto-derive an address for these coordinates. Enter the store address manually, then save.",
          );
          return;
        }
        address = geoAddress;
        setLocation((prev) => ({ ...prev, address: geoAddress }));
        setAddressDerived(true);
      } else if (!addressDerived) {
        // Manually typed address next to manually entered coordinates: verify
        // the pair agrees before persisting.
        const geoAddress = await reverseGeocode(latitude, longitude);
        if (!geoAddress) {
          setError(
            "We couldn't verify this address against the coordinates. Check your connection and try again, or use \u201CUse my current location\u201D and review the result.",
          );
          return;
        }
        if (addressesClearlyDiffer(address, geoAddress)) {
          locationLog(
            "address/coordinates mismatch blocked",
            "typed",
            address,
            "derived",
            geoAddress,
          );
          setError(
            "This address doesn't match the coordinates you've entered. Correct one of them so customers can actually find your store.",
          );
          return;
        }
        address = geoAddress;
      }

      const payload: {
        latitude: number;
        longitude: number;
        serviceRadius?: number;
        address?: string;
      } = { latitude, longitude };
      const radius = Number(location.serviceRadius);
      if (
        location.serviceRadius.trim() &&
        Number.isFinite(radius) &&
        radius > 0 &&
        radius <= 50 &&
        radius !== profile.serviceRadius
      ) {
        payload.serviceRadius = radius;
      }
      if (address && address !== (profile.address ?? "")) {
        payload.address = address;
      }

      // Stage 5 diagnostic: exactly what leaves the form.
      locationLog(
        "save payload",
        "source",
        locationSource,
        "lat",
        latitudeRaw,
        "lng",
        longitudeRaw,
        "address",
        address,
        "serviceRadius",
        location.serviceRadius.trim(),
      );

      const updated = await updateVendorProfile(payload);
      // Stage 6 diagnostic: the authoritative backend-accepted coordinates.
      locationLog(
        "backend response",
        "lat",
        typeof updated.latitude === "number" ? updated.latitude : null,
        "lng",
        typeof updated.longitude === "number" ? updated.longitude : null,
        "lga",
        updated.lga ?? null,
      );
      onSaved(updated);
      const lga = updated.lga ? ` • ${updated.lga}` : "";
      setNotice(`Store location saved${lga}.`);
      window.setTimeout(() => setNotice(null), 4000);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save your store location.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={useCurrentLocation}
        disabled={locating}
        className="inline-flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-700 disabled:bg-gray-100"
      >
        <Crosshair className="h-4 w-4" />
        {locating ? "Locating..." : "Use my current location"}
      </button>

      <div className="grid gap-4 md:grid-cols-2" ref={manualLocationRef}>
        <div className="block">
          <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-gray-700">
            <label htmlFor="vendor-latitude">Latitude</label>
            <FieldHelp
              label="Latitude"
              description="A number that identifies how far north or south your store is."
            />
          </span>
          <input
            id="vendor-latitude"
            ref={latitudeInputRef}
            type="number"
            step="any"
            inputMode="decimal"
            value={location.latitude}
            onChange={(event) => {
              setLocation((prev) => ({
                ...prev,
                latitude: event.target.value,
              }));
              setLocationSource("MANUAL_COORDINATES");
              setAddressDerived(false);
              setShowRecovery(false);
            }}
            className="w-full rounded-xl border border-gray-300 px-3 py-3 text-sm outline-none focus:border-orange-500"
            placeholder="Latitude of your store"
          />
        </div>
        <div className="block">
          <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-gray-700">
            <label htmlFor="vendor-longitude">Longitude</label>
            <FieldHelp
              label="Longitude"
              description="A number that identifies how far east or west your store is."
            />
          </span>
          <input
            id="vendor-longitude"
            type="number"
            step="any"
            inputMode="decimal"
            value={location.longitude}
            onChange={(event) => {
              setLocation((prev) => ({
                ...prev,
                longitude: event.target.value,
              }));
              setLocationSource("MANUAL_COORDINATES");
              setAddressDerived(false);
              setShowRecovery(false);
            }}
            className="w-full rounded-xl border border-gray-300 px-3 py-3 text-sm outline-none focus:border-orange-500"
            placeholder="Longitude of your store"
          />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="block">
          <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-gray-700">
            <label htmlFor="vendor-service-radius">Delivery radius (km)</label>
            <FieldHelp
              label="Delivery radius"
              description="How far from your store you're willing to deliver. For example, 5 km means customers roughly within 5 km can order from you."
            />
          </span>
          <input
            id="vendor-service-radius"
            type="number"
            inputMode="decimal"
            min={1}
            max={50}
            value={location.serviceRadius}
            onChange={(event) =>
              setLocation((prev) => ({
                ...prev,
                serviceRadius: event.target.value,
              }))
            }
            className="w-full rounded-xl border border-gray-300 px-3 py-3 text-sm outline-none focus:border-orange-500"
            placeholder="5"
          />
        </div>
        <div className="block">
          <span className="mb-1.5 block text-sm font-medium text-gray-700">
            <label htmlFor="vendor-address">Address</label>
          </span>
          <input
            id="vendor-address"
            type="text"
            value={location.address}
            onChange={(event) => {
              setLocation((prev) => ({
                ...prev,
                address: event.target.value,
              }));
              setAddressDerived(false);
              setShowRecovery(false);
            }}
            className="w-full rounded-xl border border-gray-300 px-3 py-3 text-sm outline-none focus:border-orange-500"
            placeholder="Street, neighbourhood (optional)"
          />
        </div>
      <div className="block">
          <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-gray-700">
            Local government area (LGA)
            <FieldHelp
              label="LGA"
              description="Your local government area, when available. This may show UNKNOWN for locations outside Nigeria."
            />
          </span>
          <p className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-600">
            {profile.lga ?? "\u2014"}
          </p>
        </div>
      </div>

      {notice && (
        <div
          role="status"
          className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800"
        >
          <MapPin className="mr-1 inline h-4 w-4" />
          {notice}
          {showRecovery && (
            <span className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={useCurrentLocation}
                disabled={locating}
                className="rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 disabled:bg-blue-100"
              >
                {locating ? "Locating..." : "Try again"}
              </button>
              <button
                type="button"
                onClick={focusManualLocationFields}
                className="rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700"
              >
                Enter location manually
              </button>
            </span>
          )}
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-bold text-white disabled:bg-gray-300"
      >
        {saving ? "Saving..." : "Save store location"}
      </button>
    </div>
  );
}