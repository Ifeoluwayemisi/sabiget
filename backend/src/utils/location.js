// ============================================
// Geolocation & Location Utilities
// ============================================

/**
 * Haversine formula to calculate distance between two coordinates
 * Returns distance in kilometers
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} - Distance in kilometers
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
};

/**
 * Filter vendors within a specific radius
 * @param {Array} vendors - Array of vendor objects with latitude/longitude
 * @param {number} userLat - User's latitude
 * @param {number} userLon - User's longitude
 * @param {number} radiusKm - Search radius in kilometers (default 5km)
 * @returns {Array} - Filtered vendors within radius, sorted by distance
 */
const findNearbyVendors = (vendors, userLat, userLon, radiusKm = 5) => {
  if (!vendors || vendors.length === 0) {
    return [];
  }

  // Filter vendors within radius
  const nearby = vendors
    .map((vendor) => ({
      ...vendor,
      distance: calculateDistance(
        userLat,
        userLon,
        vendor.latitude,
        vendor.longitude,
      ),
    }))
    .filter((vendor) => vendor.distance <= radiusKm)
    .sort((a, b) => a.distance - b.distance); // Sort by distance (closest first)

  return nearby;
};

/**
 * Convert decimal coordinates to degrees, minutes, seconds format
 * @param {number} decimal - Decimal coordinate
 * @returns {string} - DMS format (e.g., "6°35'32.4\"")
 */
const decimalToDMS = (decimal) => {
  const absolute = Math.abs(decimal);
  const degrees = Math.floor(absolute);
  const minutesDecimal = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesDecimal);
  const seconds = ((minutesDecimal - minutes) * 60).toFixed(1);

  return `${degrees}°${minutes}'${seconds}"`;
};

/**
 * Get approximate LGA from latitude/longitude (simplified)
 * Note: For production, use a proper reverse geocoding service
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {string} - Approximate LGA or "Unknown"
 */
const getLGAFromCoordinates = (lat, lon) => {
  // This is a simplified mapping. In production, use a reverse geocoding API
  const locations = {
    ikoyi: { latRange: [6.42, 6.48], lonRange: [3.41, 3.46] },
    lekki: { latRange: [6.45, 6.55], lonRange: [3.48, 3.58] },
    vi: { latRange: [6.42, 6.46], lonRange: [3.42, 3.5] },
    surulere: { latRange: [6.48, 6.54], lonRange: [3.34, 3.4] },
    yaba: { latRange: [6.48, 6.54], lonRange: [3.34, 3.38] },
    agege: { latRange: [6.59, 6.62], lonRange: [3.32, 3.38] },
    ikeja: { latRange: [6.55, 6.6], lonRange: [3.33, 3.4] },
  };

  for (const [lga, coords] of Object.entries(locations)) {
    const [latMin, latMax] = coords.latRange;
    const [lonMin, lonMax] = coords.lonRange;

    if (lat >= latMin && lat <= latMax && lon >= lonMin && lon <= lonMax) {
      return lga.toUpperCase();
    }
  }

  return "UNKNOWN";
};

/**
 * Validate coordinates
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {boolean} - True if valid coordinates
 */
const isValidCoordinates = (lat, lon) => {
  return (
    typeof lat === "number" &&
    typeof lon === "number" &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180 &&
    !isNaN(lat) &&
    !isNaN(lon)
  );
};

export {
  calculateDistance,
  findNearbyVendors,
  decimalToDMS,
  getLGAFromCoordinates,
  isValidCoordinates,
};
