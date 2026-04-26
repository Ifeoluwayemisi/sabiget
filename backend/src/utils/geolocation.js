// Utils for geolocation calculations
/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - User latitude
 * @param {number} lng1 - User longitude
 * @param {number} lat2 - Vendor latitude
 * @param {number} lng2 - Vendor longitude
 * @returns {number} Distance in kilometers
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

/**
 * Filter vendors within a given radius
 * @param {Array} vendors - Array of vendor objects with lat/lng
 * @param {number} userLat - User latitude
 * @param {number} userLng - User longitude
 * @param {number} radiusKm - Search radius in kilometers
 * @returns {Array} Filtered vendors
 */
function filterVendorsByRadius(vendors, userLat, userLng, radiusKm) {
  return vendors
    .map((vendor) => ({
      ...vendor,
      distance: calculateDistance(
        userLat,
        userLng,
        vendor.latitude,
        vendor.longitude,
      ),
    }))
    .filter((vendor) => vendor.distance <= radiusKm)
    .sort((a, b) => a.distance - b.distance);
}

/**
 * Format distance for display
 * @param {number} km - Distance in kilometers
 * @returns {string} Formatted distance
 */
function formatDistance(km) {
  if (km < 1) {
    return `${Math.round(km * 1000)}m`;
  }
  return `${km.toFixed(1)}km`;
}

module.exports = {
  calculateDistance,
  filterVendorsByRadius,
  formatDistance,
};
