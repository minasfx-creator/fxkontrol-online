/**
 * Sound delay by distance — models the speed of sound (343 m/s at sea level, 20°C).
 * 
 * In real firework shows, explosions at 200-3000m distance have audible delay:
 *   200m → 0.58s, 500m → 1.46s, 1000m → 2.92s, 3000m → 8.75s
 * 
 * Temperature correction: speed = 331.3 + 0.606 * T(°C)
 */

const SPEED_OF_SOUND_BASE = 331.3; // m/s at 0°C

/**
 * Get speed of sound adjusted for temperature.
 * @param tempCelsius Air temperature in °C (default 20)
 */
export function getSpeedOfSound(tempCelsius = 20): number {
  return SPEED_OF_SOUND_BASE + 0.606 * tempCelsius;
}

/**
 * Calculate sound delay in seconds between camera and burst position.
 * @param cameraPos [x, y, z] camera world position
 * @param burstPos [x, y, z] burst world position  
 * @param tempCelsius Air temperature (default 20°C)
 * @returns delay in seconds
 */
export function getSoundDelay(
  cameraPos: [number, number, number],
  burstPos: [number, number, number],
  tempCelsius = 20,
): number {
  const dx = cameraPos[0] - burstPos[0];
  const dy = cameraPos[1] - burstPos[1];
  const dz = cameraPos[2] - burstPos[2];
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
  return distance / getSpeedOfSound(tempCelsius);
}

/**
 * Get distance in meters between two 3D points.
 */
export function getDistance3D(
  a: [number, number, number],
  b: [number, number, number],
): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
