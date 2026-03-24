/**
 * ─── Cinematic Sequencer ─────────────────────────────────────────────
 * Auto-generates 4-phase camera keyframes for client presentation mode.
 * Uses GPS anchor to create a Google Earth-style cinematic flight path.
 */

import type { CameraKeyframe } from '@/store/useProjectStore';
import { geoToLocalSync } from '@/core/geo/useGeo';

export interface CinematicConfig {
  lat: number;
  lng: number;
  alt: number;
  duration: number;     // total show duration in seconds
  orbitRadius?: number; // meters (default 300)
  maxAltitude?: number; // meters for establishing shot (default 800)
  showAltitude?: number; // meters for action orbit (default 200)
}

/**
 * Generate a 4-phase cinematic camera path:
 * Phase 1 (0-15%):  High orbit establishing shot
 * Phase 2 (15-25%): Swoop descent to venue
 * Phase 3 (25-85%): Slow orbit at show altitude
 * Phase 4 (85-100%): Pull back to wide shot for finale
 */
export function generateCinematicKeyframes(
  config: CinematicConfig,
  anchorLat: number,
  anchorLon: number,
  anchorAlt: number,
): CameraKeyframe[] {
  const {
    duration,
    orbitRadius = 300,
    maxAltitude = 800,
    showAltitude = 200,
  } = config;

  const center = geoToLocalSync(config.lat, config.lng, config.alt, anchorLat, anchorLon, anchorAlt);
  const lookAt: [number, number, number] = [center.x, 0, center.z];

  const keyframes: CameraKeyframe[] = [];
  let id = 0;

  const addKF = (timeFraction: number, pos: [number, number, number], look: [number, number, number], fov: number) => {
    keyframes.push({
      id: `cinematic-${id++}`,
      time: timeFraction * duration,
      position: pos,
      lookAt: look,
      fov,
    });
  };

  // Helper: orbit position at angle
  const orbitPos = (angle: number, radius: number, height: number): [number, number, number] => [
    center.x + Math.sin(angle) * radius,
    height,
    center.z + Math.cos(angle) * radius,
  ];

  // ── Phase 1: High establishing orbit (0-15%) ──
  addKF(0.0,  orbitPos(0, orbitRadius * 2, maxAltitude), lookAt, 40);
  addKF(0.08, orbitPos(Math.PI * 0.4, orbitRadius * 2, maxAltitude * 0.9), lookAt, 42);
  addKF(0.15, orbitPos(Math.PI * 0.8, orbitRadius * 1.5, maxAltitude * 0.7), lookAt, 45);

  // ── Phase 2: Swoop descent (15-25%) ──
  addKF(0.20, orbitPos(Math.PI * 1.0, orbitRadius * 0.8, showAltitude * 1.5), lookAt, 50);
  addKF(0.25, orbitPos(Math.PI * 1.2, orbitRadius, showAltitude), lookAt, 55);

  // ── Phase 3: Slow action orbit (25-85%) ──
  const actionSteps = 6;
  for (let i = 0; i <= actionSteps; i++) {
    const t = 0.25 + (0.60 * i / actionSteps);
    const angle = Math.PI * 1.2 + (Math.PI * 1.5 * i / actionSteps);
    const heightVar = showAltitude + Math.sin(i * 0.8) * 30;
    const radiusVar = orbitRadius + Math.sin(i * 1.2) * 50;
    addKF(t, orbitPos(angle, radiusVar, heightVar), lookAt, 50 + Math.sin(i) * 5);
  }

  // ── Phase 4: Finale pull-back (85-100%) ──
  addKF(0.90, orbitPos(Math.PI * 3.5, orbitRadius * 1.3, showAltitude * 1.8), lookAt, 45);
  addKF(0.95, orbitPos(Math.PI * 3.8, orbitRadius * 1.8, maxAltitude * 0.6), lookAt, 40);
  addKF(1.0,  orbitPos(Math.PI * 4.0, orbitRadius * 2.5, maxAltitude), lookAt, 35);

  return keyframes;
}
