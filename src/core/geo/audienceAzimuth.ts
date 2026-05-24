/**
 * Audience azimuth helpers — Haversine-based bearing math used by Joi
 * to orient pyro/drone positions so they face the audience.
 *
 * Conventions:
 *   - Geographic azimuth: degrees clockwise from true North, 0..360.
 *   - Three.js heading (this scene): rotation about +Y where 0° points along
 *     the local +X axis (East) and increases counter-clockwise. North is +90°.
 *     A position should "face" the audience, so the heading is offset by 180°.
 */

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

/** Initial bearing (azimuth) from A to B, in degrees clockwise from North. */
export function azimuthDeg(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): number {
  const φ1 = fromLat * DEG;
  const φ2 = toLat * DEG;
  const Δλ = (toLng - fromLng) * DEG;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (Math.atan2(y, x) * RAD + 360) % 360;
}

/**
 * Heading (deg) that orients a position to face an audience point.
 * Returns a value in [0, 360). Three.js Y-rotation convention (see header).
 */
export function audienceHeadingDeg(
  fromLat: number,
  fromLng: number,
  audienceLat: number,
  audienceLng: number,
): number {
  const az = azimuthDeg(fromLat, fromLng, audienceLat, audienceLng);
  // Convert geographic azimuth -> Three.js Y rotation where North=+90°, East=0°
  // facing audience -> add 180°
  const heading = (90 - az + 180 + 360) % 360;
  return heading;
}

/** Great-circle distance in meters (Haversine). */
export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371008.8;
  const φ1 = lat1 * DEG;
  const φ2 = lat2 * DEG;
  const Δφ = (lat2 - lat1) * DEG;
  const Δλ = (lng2 - lng1) * DEG;
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}
