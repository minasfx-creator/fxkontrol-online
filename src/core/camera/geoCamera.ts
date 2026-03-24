/**
 * ─── GeoCamera · Fly-To System ──────────────────────────────────────
 * Smooth geographic interpolation camera transitions.
 * Supports great-circle arcs and easeInOutCubic for cinematic movement.
 */

import * as THREE from 'three';
import { geoToLocalSync } from '@/core/geo/useGeo';

// ── Easing Functions ───────────────────────────────────────────────

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

// ── Types ──────────────────────────────────────────────────────────

export interface FlyToTarget {
  lat: number;
  lng: number;
  alt: number;         // Camera altitude above ground
  duration?: number;   // seconds (default 2.5)
  heading?: number;    // degrees (default 0 = north)
  pitch?: number;      // degrees below horizon (default 30)
  arcHeight?: number;  // meters above midpoint (default auto)
}

export interface FlyToAnimation {
  active: boolean;
  startTime: number;
  duration: number;
  // Start state
  startPos: THREE.Vector3;
  startTarget: THREE.Vector3;
  // End state
  endPos: THREE.Vector3;
  endTarget: THREE.Vector3;
  // Arc
  midPos: THREE.Vector3;
}

// ── Pre-allocated ──────────────────────────────────────────────────
const _tmpVec = new THREE.Vector3();
const _startPos = new THREE.Vector3();
const _endPos = new THREE.Vector3();
const _midPos = new THREE.Vector3();

// ── State ──────────────────────────────────────────────────────────
let _currentAnim: FlyToAnimation | null = null;

/**
 * Initiate a smooth fly-to animation to a geographic target.
 * 
 * @param target - Geographic destination
 * @param camera - Three.js camera to animate
 * @param controls - OrbitControls (will be disabled during flight)
 * @param anchor - Current scene geo anchor (lat, lon, alt)
 */
export function flyTo(
  target: FlyToTarget,
  camera: THREE.Camera,
  controls: { enabled: boolean; target: THREE.Vector3 } | null,
  anchor: { lat: number; lon: number; alt: number },
): void {
  const duration = target.duration ?? 2.5;
  const heading = (target.heading ?? 0) * (Math.PI / 180);
  const pitch = (target.pitch ?? 30) * (Math.PI / 180);

  // Compute end position in local space
  const localTarget = geoToLocalSync(
    target.lat, target.lng, 0,
    anchor.lat, anchor.lon, anchor.alt,
  );

  // Camera offset from heading and pitch
  const dist = target.alt / Math.sin(pitch);
  const camOffX = Math.sin(heading) * Math.cos(pitch) * dist;
  const camOffY = target.alt;
  const camOffZ = Math.cos(heading) * Math.cos(pitch) * dist;

  const endTarget = new THREE.Vector3(localTarget.x, 0, localTarget.z);
  const endPos = new THREE.Vector3(
    localTarget.x + camOffX,
    camOffY,
    localTarget.z + camOffZ,
  );

  const startPos = camera.position.clone();
  const startTarget = controls?.target.clone() ?? new THREE.Vector3(0, 0, 0);

  // Compute arc midpoint (Google Earth-style swoop)
  const midPos = startPos.clone().lerp(endPos, 0.5);
  const groundDist = startPos.distanceTo(endPos);
  const autoArc = Math.min(groundDist * 0.3, 500);
  midPos.y = Math.max(startPos.y, endPos.y) + (target.arcHeight ?? autoArc);

  // Disable controls during flight
  if (controls) controls.enabled = false;

  _currentAnim = {
    active: true,
    startTime: performance.now() / 1000,
    duration,
    startPos,
    startTarget,
    endPos,
    endTarget,
    midPos,
  };
}

/**
 * Update the fly-to animation. Call from useFrame.
 * 
 * @returns true if animation is active
 */
export function updateFlyTo(
  camera: THREE.Camera,
  controls: { enabled: boolean; target: THREE.Vector3 } | null,
): boolean {
  if (!_currentAnim?.active) return false;

  const now = performance.now() / 1000;
  const elapsed = now - _currentAnim.startTime;
  const rawT = Math.min(elapsed / _currentAnim.duration, 1);
  const t = easeInOutCubic(rawT);

  // Quadratic Bezier for position (arc)
  const oneMinusT = 1 - t;
  camera.position.set(
    oneMinusT * oneMinusT * _currentAnim.startPos.x + 2 * oneMinusT * t * _currentAnim.midPos.x + t * t * _currentAnim.endPos.x,
    oneMinusT * oneMinusT * _currentAnim.startPos.y + 2 * oneMinusT * t * _currentAnim.midPos.y + t * t * _currentAnim.endPos.y,
    oneMinusT * oneMinusT * _currentAnim.startPos.z + 2 * oneMinusT * t * _currentAnim.midPos.z + t * t * _currentAnim.endPos.z,
  );

  // Linear interpolation for look target
  if (controls) {
    controls.target.lerpVectors(_currentAnim.startTarget, _currentAnim.endTarget, easeOutQuart(rawT));
  }

  // Animation complete
  if (rawT >= 1) {
    _currentAnim.active = false;
    _currentAnim = null;
    if (controls) controls.enabled = true;
    return false;
  }

  return true;
}

/** Cancel any active fly-to animation. */
export function cancelFlyTo(controls?: { enabled: boolean }): void {
  if (_currentAnim) {
    _currentAnim.active = false;
    _currentAnim = null;
    if (controls) controls.enabled = true;
  }
}

/** Check if a fly-to is currently active. */
export function isFlyingTo(): boolean {
  return _currentAnim?.active ?? false;
}
