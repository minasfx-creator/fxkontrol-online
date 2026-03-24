/**
 * ─── Sun System (Geolocation-Aware) ─────────────────────────────────
 * Computes real sun position based on GPS coordinates and time.
 * Uses astronomical algorithms (no external dependencies).
 * 
 * Outputs directional light direction, color temperature, and
 * sky color for the atmospheric engine.
 */

import * as THREE from 'three';

// ── Pre-allocated ──────────────────────────────────────────────────
const _sunDir = new THREE.Vector3();
const _sunColor = new THREE.Color();
const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

export interface SunPosition {
  azimuth: number;    // degrees, 0 = North, CW
  elevation: number;  // degrees, 0 = horizon, 90 = zenith
  direction: THREE.Vector3;  // unit vector pointing toward sun
  color: THREE.Color;
  intensity: number;  // 0-1 based on elevation
  isDaytime: boolean;
}

/**
 * Calculate sun position using simplified solar position algorithm.
 * Accurate to ~1° for dates 2000-2100.
 * 
 * @param date - Date/time (UTC)
 * @param lat - Observer latitude (degrees)
 * @param lng - Observer longitude (degrees)
 */
export function calculateSunPosition(
  date: Date,
  lat: number,
  lng: number,
): SunPosition {
  // Julian Date
  const JD = date.getTime() / 86400000 + 2440587.5;
  const n = JD - 2451545.0; // days since J2000.0

  // Solar coordinates
  const L = (280.460 + 0.9856474 * n) % 360;  // mean longitude
  const g = ((357.528 + 0.9856003 * n) % 360) * DEG2RAD;  // mean anomaly
  const lambda = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * DEG2RAD; // ecliptic longitude
  const epsilon = (23.439 - 0.0000004 * n) * DEG2RAD; // obliquity

  // Declination and right ascension
  const sinDec = Math.sin(epsilon) * Math.sin(lambda);
  const dec = Math.asin(sinDec);
  const cosDec = Math.cos(dec);

  const RA = Math.atan2(Math.cos(epsilon) * Math.sin(lambda), Math.cos(lambda));

  // Greenwich Mean Sidereal Time
  const GMST = (280.46061837 + 360.98564736629 * n) * DEG2RAD;
  const LST = GMST + lng * DEG2RAD;
  const HA = LST - RA; // hour angle

  // Convert to horizontal coordinates
  const latRad = lat * DEG2RAD;
  const sinAlt = Math.sin(latRad) * Math.sin(dec) + Math.cos(latRad) * Math.cos(dec) * Math.cos(HA);
  const elevation = Math.asin(sinAlt) * RAD2DEG;

  const cosAz = (Math.sin(dec) - Math.sin(latRad) * sinAlt) / (Math.cos(latRad) * Math.cos(Math.asin(sinAlt)));
  let azimuth = Math.acos(Math.max(-1, Math.min(1, cosAz))) * RAD2DEG;
  if (Math.sin(HA) > 0) azimuth = 360 - azimuth;

  // Compute direction vector
  const elRad = elevation * DEG2RAD;
  const azRad = azimuth * DEG2RAD;
  _sunDir.set(
    -Math.sin(azRad) * Math.cos(elRad),
    Math.sin(elRad),
    -Math.cos(azRad) * Math.cos(elRad),
  );

  // Color temperature based on elevation
  const color = getSunColorFromElevation(elevation);
  const intensity = getSunIntensity(elevation);

  return {
    azimuth,
    elevation,
    direction: _sunDir.clone(),
    color,
    intensity,
    isDaytime: elevation > -6, // civil twilight
  };
}

/**
 * Compute sun color based on elevation angle.
 * Low angles = warm/orange, high angles = white/blue.
 */
function getSunColorFromElevation(elevation: number): THREE.Color {
  if (elevation < -6) {
    // Night
    return _sunColor.setHSL(0.63, 0.3, 0.1).clone();
  } else if (elevation < 0) {
    // Twilight
    const t = (elevation + 6) / 6;
    return _sunColor.setHSL(0.08 - t * 0.03, 0.8, 0.3 + t * 0.2).clone();
  } else if (elevation < 10) {
    // Golden hour
    const t = elevation / 10;
    return _sunColor.setHSL(0.08 + t * 0.05, 0.9 - t * 0.3, 0.5 + t * 0.2).clone();
  } else if (elevation < 30) {
    // Morning/evening
    const t = (elevation - 10) / 20;
    return _sunColor.setHSL(0.13 + t * 0.02, 0.6 - t * 0.3, 0.7 + t * 0.1).clone();
  } else {
    // Midday
    return _sunColor.setHSL(0.15, 0.15, 0.95).clone();
  }
}

/**
 * Compute sun intensity based on elevation angle.
 */
function getSunIntensity(elevation: number): number {
  if (elevation < -6) return 0;
  if (elevation < 0) return (elevation + 6) / 6 * 0.1;
  if (elevation < 10) return 0.1 + (elevation / 10) * 0.5;
  if (elevation < 30) return 0.6 + ((elevation - 10) / 20) * 0.3;
  return 0.9 + Math.min((elevation - 30) / 60, 1) * 0.1;
}

/**
 * Get sky color based on sun elevation.
 * Returns ambient sky tint for the environment.
 */
export function getSkyColorFromSun(elevation: number): THREE.Color {
  if (elevation < -12) {
    return new THREE.Color().setHSL(0.65, 0.15, 0.02);  // deep night
  } else if (elevation < -6) {
    const t = (elevation + 12) / 6;
    return new THREE.Color().setHSL(0.63, 0.2 + t * 0.2, 0.02 + t * 0.05);
  } else if (elevation < 0) {
    const t = (elevation + 6) / 6;
    return new THREE.Color().setHSL(0.6 - t * 0.1, 0.4 + t * 0.3, 0.07 + t * 0.15);
  } else if (elevation < 15) {
    const t = elevation / 15;
    return new THREE.Color().setHSL(0.55 + t * 0.05, 0.6, 0.22 + t * 0.3);
  } else {
    return new THREE.Color().setHSL(0.58, 0.65, 0.55);  // full daylight
  }
}
