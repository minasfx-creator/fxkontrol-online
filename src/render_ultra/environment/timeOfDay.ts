/**
 * FX KONTROL · Time-of-Day System
 * UE5.7-inspired dynamic lighting transitions.
 * Drives sun/moon position, sky colors, fog density, and ambient lighting
 * based on a normalized time value (0-24 hours).
 */

import * as THREE from 'three';

export interface TimeOfDayState {
  hour: number;              // 0-24
  sunDirection: THREE.Vector3;
  moonDirection: THREE.Vector3;
  sunIntensity: number;
  sunColor: THREE.Color;
  ambientIntensity: number;
  ambientColor: THREE.Color;
  fogDensity: number;
  fogColor: THREE.Color;
  skyZenith: THREE.Color;
  skyHorizon: THREE.Color;
  skyNight: THREE.Color;
  starBrightness: number;
  shadowIntensity: number;
  exposureBias: number;
  phase: 'night' | 'dawn' | 'golden-hour' | 'day' | 'sunset' | 'twilight' | 'blue-hour';
}

interface TODKeyframe {
  hour: number;
  sunElevation: number;     // degrees
  sunAzimuth: number;       // degrees
  sunIntensity: number;
  sunColor: [number, number, number];
  ambientIntensity: number;
  ambientColor: [number, number, number];
  fogDensity: number;
  fogColor: [number, number, number];
  zenith: [number, number, number];
  horizon: [number, number, number];
  night: [number, number, number];
  starBrightness: number;
  shadowIntensity: number;
  exposureBias: number;
  phase: TimeOfDayState['phase'];
}

// ─── Keyframe table (interpolated between) ───
const KEYFRAMES: TODKeyframe[] = [
  { // 0h — Midnight
    hour: 0, sunElevation: -45, sunAzimuth: 0,
    sunIntensity: 0, sunColor: [0.1, 0.1, 0.2],
    ambientIntensity: 0.03, ambientColor: [0.1, 0.12, 0.2],
    fogDensity: 0.3, fogColor: [0.02, 0.02, 0.04],
    zenith: [0.005, 0.008, 0.025], horizon: [0.02, 0.025, 0.06], night: [0.003, 0.005, 0.015],
    starBrightness: 2.0, shadowIntensity: 0.1, exposureBias: 1.5, phase: 'night',
  },
  { // 5h — Pre-dawn
    hour: 5, sunElevation: -10, sunAzimuth: 80,
    sunIntensity: 0.05, sunColor: [0.4, 0.2, 0.15],
    ambientIntensity: 0.05, ambientColor: [0.15, 0.1, 0.15],
    fogDensity: 0.5, fogColor: [0.05, 0.04, 0.06],
    zenith: [0.01, 0.015, 0.06], horizon: [0.12, 0.06, 0.05], night: [0.005, 0.006, 0.02],
    starBrightness: 0.8, shadowIntensity: 0.15, exposureBias: 1.3, phase: 'dawn',
  },
  { // 6.5h — Golden Hour
    hour: 6.5, sunElevation: 8, sunAzimuth: 90,
    sunIntensity: 1.2, sunColor: [1.0, 0.6, 0.2],
    ambientIntensity: 0.15, ambientColor: [0.3, 0.2, 0.1],
    fogDensity: 0.4, fogColor: [0.15, 0.1, 0.05],
    zenith: [0.08, 0.12, 0.35], horizon: [0.5, 0.25, 0.1], night: [0.02, 0.02, 0.04],
    starBrightness: 0, shadowIntensity: 0.6, exposureBias: 1.0, phase: 'golden-hour',
  },
  { // 12h — Noon
    hour: 12, sunElevation: 70, sunAzimuth: 180,
    sunIntensity: 2.0, sunColor: [1.0, 0.97, 0.9],
    ambientIntensity: 0.3, ambientColor: [0.4, 0.45, 0.5],
    fogDensity: 0.15, fogColor: [0.3, 0.35, 0.4],
    zenith: [0.15, 0.3, 0.7], horizon: [0.5, 0.55, 0.65], night: [0.05, 0.05, 0.1],
    starBrightness: 0, shadowIntensity: 1.0, exposureBias: 0.7, phase: 'day',
  },
  { // 18h — Sunset
    hour: 18, sunElevation: 5, sunAzimuth: 270,
    sunIntensity: 1.0, sunColor: [1.0, 0.45, 0.1],
    ambientIntensity: 0.12, ambientColor: [0.25, 0.15, 0.1],
    fogDensity: 0.45, fogColor: [0.15, 0.08, 0.04],
    zenith: [0.06, 0.08, 0.25], horizon: [0.6, 0.2, 0.08], night: [0.015, 0.015, 0.04],
    starBrightness: 0, shadowIntensity: 0.5, exposureBias: 1.0, phase: 'sunset',
  },
  { // 19.5h — Twilight
    hour: 19.5, sunElevation: -8, sunAzimuth: 280,
    sunIntensity: 0.15, sunColor: [0.6, 0.3, 0.15],
    ambientIntensity: 0.06, ambientColor: [0.12, 0.08, 0.12],
    fogDensity: 0.4, fogColor: [0.04, 0.03, 0.06],
    zenith: [0.02, 0.03, 0.1], horizon: [0.15, 0.08, 0.1], night: [0.008, 0.008, 0.025],
    starBrightness: 0.5, shadowIntensity: 0.2, exposureBias: 1.2, phase: 'twilight',
  },
  { // 20.5h — Blue Hour
    hour: 20.5, sunElevation: -15, sunAzimuth: 290,
    sunIntensity: 0.03, sunColor: [0.3, 0.2, 0.15],
    ambientIntensity: 0.04, ambientColor: [0.1, 0.1, 0.18],
    fogDensity: 0.35, fogColor: [0.03, 0.03, 0.06],
    zenith: [0.012, 0.018, 0.07], horizon: [0.05, 0.04, 0.1], night: [0.005, 0.006, 0.02],
    starBrightness: 1.2, shadowIntensity: 0.12, exposureBias: 1.4, phase: 'blue-hour',
  },
  { // 24h — Back to midnight (wrap)
    hour: 24, sunElevation: -45, sunAzimuth: 360,
    sunIntensity: 0, sunColor: [0.1, 0.1, 0.2],
    ambientIntensity: 0.03, ambientColor: [0.1, 0.12, 0.2],
    fogDensity: 0.3, fogColor: [0.02, 0.02, 0.04],
    zenith: [0.005, 0.008, 0.025], horizon: [0.02, 0.025, 0.06], night: [0.003, 0.005, 0.015],
    starBrightness: 2.0, shadowIntensity: 0.1, exposureBias: 1.5, phase: 'night',
  },
];

function lerpColor(a: [number, number, number], b: [number, number, number], t: number): THREE.Color {
  return new THREE.Color(
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  );
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function degToRad(deg: number): number {
  return deg * Math.PI / 180;
}

/**
 * Evaluate the time-of-day state at a given hour (0-24).
 */
export function evaluateTimeOfDay(hour: number): TimeOfDayState {
  hour = ((hour % 24) + 24) % 24; // normalize

  // Find surrounding keyframes
  let a = KEYFRAMES[0];
  let b = KEYFRAMES[1];
  for (let i = 0; i < KEYFRAMES.length - 1; i++) {
    if (hour >= KEYFRAMES[i].hour && hour <= KEYFRAMES[i + 1].hour) {
      a = KEYFRAMES[i];
      b = KEYFRAMES[i + 1];
      break;
    }
  }

  const t = (hour - a.hour) / (b.hour - a.hour || 1);
  const st = t * t * (3 - 2 * t); // smoothstep interpolation

  // Sun direction from elevation + azimuth
  const elev = degToRad(lerp(a.sunElevation, b.sunElevation, st));
  const azim = degToRad(lerp(a.sunAzimuth, b.sunAzimuth, st));
  const sunDir = new THREE.Vector3(
    Math.cos(elev) * Math.sin(azim),
    Math.sin(elev),
    Math.cos(elev) * Math.cos(azim),
  ).normalize();

  // Moon is roughly opposite sun
  const moonDir = new THREE.Vector3(-sunDir.x, Math.max(sunDir.y * -0.8, 0.1), -sunDir.z).normalize();

  return {
    hour,
    sunDirection: sunDir,
    moonDirection: moonDir,
    sunIntensity: lerp(a.sunIntensity, b.sunIntensity, st),
    sunColor: lerpColor(a.sunColor, b.sunColor, st),
    ambientIntensity: lerp(a.ambientIntensity, b.ambientIntensity, st),
    ambientColor: lerpColor(a.ambientColor, b.ambientColor, st),
    fogDensity: lerp(a.fogDensity, b.fogDensity, st),
    fogColor: lerpColor(a.fogColor, b.fogColor, st),
    skyZenith: lerpColor(a.zenith, b.zenith, st),
    skyHorizon: lerpColor(a.horizon, b.horizon, st),
    skyNight: lerpColor(a.night, b.night, st),
    starBrightness: lerp(a.starBrightness, b.starBrightness, st),
    shadowIntensity: lerp(a.shadowIntensity, b.shadowIntensity, st),
    exposureBias: lerp(a.exposureBias, b.exposureBias, st),
    phase: st < 0.5 ? a.phase : b.phase,
  };
}

/** Get the ideal show time (21:30 — deep blue hour, best for fireworks) */
export function getShowTimeHour(): number {
  return 21.5;
}

/** Quick presets for common show scenarios */
export const TOD_PRESETS = {
  'firework-show': 21.5,    // Deep blue hour — ideal
  'drone-show': 21.0,       // Early night
  'golden-hour': 6.5,       // Morning golden
  'sunset-show': 18.0,      // Sunset spectacular
  'midnight': 0,
  'noon': 12,
} as const;
