/**
 * ─── Skybrush Environment Bridge ────────────────────────────────────
 * Bridges Flockwave protocol environment data into the scene store
 * for real-time pyro rendering adjustments.
 * 
 * Based on Skybrush Server environment messages:
 *   ENV-WIND  → windSpeed, windDirection
 *   ENV-VIS   → visibility, fogDensity
 *   ENV-TEMP  → temperature, humidity
 * 
 * This allows the rendering engine to react to live weather data
 * from Skybrush Server or manual adjustments via the Scene Editor.
 */

import type { SceneSettings } from '@/store/useSceneStore';

// ── Flockwave ENV message types ─────────────────────────────────────

export interface FlockwaveWindData {
  speed: number;        // m/s
  direction: number;    // 0-360, 0=North, CW
  gustSpeed?: number;   // m/s peak gusts
  gustInterval?: number; // seconds between gusts
}

export interface FlockwaveVisibilityData {
  range: number;        // meters
  fog: boolean;
  haze: boolean;
}

export interface FlockwaveTemperatureData {
  celsius: number;
  humidity: number;     // 0-1
  dewpoint?: number;
}

export interface SkybrushEnvironment {
  wind?: FlockwaveWindData;
  visibility?: FlockwaveVisibilityData;
  temperature?: FlockwaveTemperatureData;
  timestamp?: number;
}

// ── Bridge: convert Flockwave ENV → SceneSettings partial ───────────

export function flockwaveEnvToSceneSettings(env: SkybrushEnvironment): Partial<SceneSettings> {
  const updates: Partial<SceneSettings> = {};

  if (env.wind) {
    updates.windSpeed = env.wind.speed;
    updates.windDirection = env.wind.direction;
    // Map wind to visual windEffect (0-1 normalized)
    updates.windEffect = Math.min(1, env.wind.speed / 5);
  }

  if (env.visibility) {
    // Map visibility range to fogDensity and scene visibility
    updates.visibility = Math.min(1, env.visibility.range / 10000);
    if (env.visibility.fog) {
      updates.fogDensity = Math.max(0.5, 1 - env.visibility.range / 2000);
      updates.weather = 'fog';
    }
    if (env.visibility.haze) {
      updates.weather = 'haze';
      updates.humidity = Math.max(0.7, updates.humidity || 0);
    }
  }

  if (env.temperature) {
    updates.temperature = env.temperature.celsius;
    updates.humidity = env.temperature.humidity;
    // Cold temperatures make smoke linger longer (denser air)
    if (env.temperature.celsius < 5) {
      updates.smokeOpacity = Math.min(1, 0.7 + (5 - env.temperature.celsius) * 0.03);
    }
  }

  return updates;
}

/**
 * Parse raw Flockwave JSON-RPC envelope for ENV messages
 * and return scene-compatible settings update.
 */
export function parseFlockwaveEnvMessage(raw: Record<string, unknown>): Partial<SceneSettings> | null {
  const body = raw.body as Record<string, unknown> | undefined;
  if (!body || typeof body.type !== 'string') return null;

  const env: SkybrushEnvironment = {};

  switch (body.type) {
    case 'ENV-WIND':
      env.wind = {
        speed: (body.speed as number) || 0,
        direction: (body.direction as number) || 0,
        gustSpeed: body.gustSpeed as number | undefined,
        gustInterval: body.gustInterval as number | undefined,
      };
      break;

    case 'ENV-VIS':
      env.visibility = {
        range: (body.range as number) || 10000,
        fog: !!(body.fog),
        haze: !!(body.haze),
      };
      break;

    case 'ENV-TEMP':
      env.temperature = {
        celsius: (body.celsius as number) || 20,
        humidity: (body.humidity as number) || 0.5,
        dewpoint: body.dewpoint as number | undefined,
      };
      break;

    default:
      return null;
  }

  return flockwaveEnvToSceneSettings(env);
}

/**
 * Wind vector computation matching Skybrush NEU coordinate convention.
 * Used by ShellBurstRenderer and particle physics.
 * 0° = North (negative Z), 90° = East (positive X)
 */
export function windDirToVec3(speedMs: number, dirDeg: number): [number, number, number] {
  const rad = (dirDeg * Math.PI) / 180;
  return [
    Math.sin(rad) * speedMs,
    0,
    -Math.cos(rad) * speedMs,
  ];
}

/**
 * Beaufort scale approximation for UI display.
 */
export function windSpeedToBeaufort(speedMs: number): { scale: number; label: string } {
  if (speedMs < 0.3) return { scale: 0, label: 'Calm' };
  if (speedMs < 1.6) return { scale: 1, label: 'Light Air' };
  if (speedMs < 3.4) return { scale: 2, label: 'Light Breeze' };
  if (speedMs < 5.5) return { scale: 3, label: 'Gentle Breeze' };
  if (speedMs < 8.0) return { scale: 4, label: 'Moderate Breeze' };
  if (speedMs < 10.8) return { scale: 5, label: 'Fresh Breeze' };
  return { scale: 6, label: 'Strong Wind' };
}
