/**
 * Training v2.1 — Cinematic shot library.
 *
 * Each shot defines a relative camera position + look target offset
 * around a focus point. The CinematicCameraDirector lerps between
 * the active shot and the player's free-orbit camera.
 *
 * Pure data — zero THREE dependency.
 */

import type { CinematicShot } from '../missions/types';

export interface ShotDef {
  /** Camera position offset from focus point (world units). */
  offset: [number, number, number];
  /** Look target offset from focus (usually 0,0,0 for "look at focus"). */
  lookOffset: [number, number, number];
  /** Field of view (degrees). */
  fov: number;
  /** Default duration in ms. */
  durationMs: number;
  /** Lerp tightness 0..1 (higher = snappier transition). */
  ease: number;
}

export const SHOT_LIBRARY: Record<CinematicShot, ShotDef> = {
  'wide-establishing':  { offset: [40, 25, 40],   lookOffset: [0, 4, 0],  fov: 50, durationMs: 3500, ease: 0.04 },
  'medium-2shot':       { offset: [6, 2.2, 7],    lookOffset: [0, 1.6, 0], fov: 45, durationMs: 2800, ease: 0.06 },
  'over-the-shoulder':  { offset: [-1.5, 2.0, -1.8], lookOffset: [1, 1.6, 1.5], fov: 42, durationMs: 2400, ease: 0.07 },
  'close-up-reaction':  { offset: [1.5, 1.9, 1.6], lookOffset: [0, 1.7, 0], fov: 38, durationMs: 2200, ease: 0.09 },
  'crane-down':         { offset: [0, 22, 8],     lookOffset: [0, 1.5, 0], fov: 55, durationMs: 3200, ease: 0.04 },
  'dolly-in':           { offset: [0, 3, 9],      lookOffset: [0, 1.6, 0], fov: 48, durationMs: 2800, ease: 0.05 },
  'low-angle-hero':     { offset: [3, 0.8, 4],    lookOffset: [0, 2.2, 0], fov: 52, durationMs: 2600, ease: 0.06 },
  'orbit-slow':         { offset: [12, 4, 12],    lookOffset: [0, 2, 0],   fov: 50, durationMs: 4000, ease: 0.03 },
};
