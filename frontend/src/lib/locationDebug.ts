// Dev-only diagnostics for the vendor location flow. The exact stage markers
// requested during the Obalende-coordinates investigation:
//   1. browser raw fix
//   2. form state after update
//   3. reverse geocode input
//   4. reverse geocode result
//   5. save payload
//   6. backend response
//   7. /vendors/me hydration
// Logs are compiled away in production builds (NODE_ENV=production), so no
// location data leaks in shipped code.

const DEBUG_LOCATION = process.env.NODE_ENV !== "production";

export function locationLog(...args: unknown[]): void {
  if (!DEBUG_LOCATION) return;
  console.log("%c[LOCATION]", "color:#FF4500;font-weight:bold", ...args);
}