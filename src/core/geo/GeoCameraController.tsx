/**
 * ─── GeoCameraController ─────────────────────────────────────────────
 * R3F component that drives cinematic flyTo + orbit when Google 3D Tiles active.
 * Connects the existing geoCamera system to the R3F render loop.
 */

import { useRef, useEffect, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { updateFlyTo, flyTo, cancelFlyTo, isFlyingTo, type FlyToTarget } from '@/core/camera/geoCamera';
import { useSceneStore } from '@/store/useSceneStore';

// ── Orbit State ──
interface OrbitState {
  active: boolean;
  center: THREE.Vector3;
  radius: number;
  speed: number;      // rad/s
  height: number;
  angle: number;
}

// Singleton for external access
let _flyToFn: ((target: FlyToTarget) => void) | null = null;
let _orbitFn: ((center: [number, number, number], radius: number, speed?: number, height?: number) => void) | null = null;
let _stopOrbitFn: (() => void) | null = null;

export function triggerFlyTo(target: FlyToTarget) { _flyToFn?.(target); }
export function triggerOrbit(center: [number, number, number], radius: number, speed?: number, height?: number) {
  _orbitFn?.(center, radius, speed, height);
}
export function stopOrbit() { _stopOrbitFn?.(); }

export default function GeoCameraController() {
  const { camera } = useThree();
  const controlsRef = useRef<{ enabled: boolean; target: THREE.Vector3 } | null>(null);
  const orbitState = useRef<OrbitState>({
    active: false,
    center: new THREE.Vector3(),
    radius: 300,
    speed: 0.15,
    height: 200,
    angle: 0,
  });

  const settings = useSceneStore((s) => s.settings);

  // Find OrbitControls from scene
  useEffect(() => {
    // OrbitControls are attached by R3F — we access them through a global event
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.controls) controlsRef.current = detail.controls;
    };
    window.addEventListener('r3f-controls-ready', handler);
    return () => window.removeEventListener('r3f-controls-ready', handler);
  }, []);

  // Expose flyTo
  const doFlyTo = useCallback((target: FlyToTarget) => {
    orbitState.current.active = false;
    flyTo(target, camera, controlsRef.current, {
      lat: settings.geoAnchorLat,
      lon: settings.geoAnchorLon,
      alt: settings.geoAnchorAlt,
    });
  }, [camera, settings.geoAnchorLat, settings.geoAnchorLon, settings.geoAnchorAlt]);

  const doOrbit = useCallback((center: [number, number, number], radius: number, speed = 0.15, height = 200) => {
    cancelFlyTo(controlsRef.current ?? undefined);
    const os = orbitState.current;
    os.active = true;
    os.center.set(center[0], center[1], center[2]);
    os.radius = radius;
    os.speed = speed;
    os.height = height;
    os.angle = Math.atan2(camera.position.x - center[0], camera.position.z - center[2]);
    if (controlsRef.current) controlsRef.current.enabled = false;
  }, [camera]);

  const doStopOrbit = useCallback(() => {
    orbitState.current.active = false;
    if (controlsRef.current) controlsRef.current.enabled = true;
  }, []);

  useEffect(() => {
    _flyToFn = doFlyTo;
    _orbitFn = doOrbit;
    _stopOrbitFn = doStopOrbit;
    return () => { _flyToFn = null; _orbitFn = null; _stopOrbitFn = null; };
  }, [doFlyTo, doOrbit, doStopOrbit]);

  useFrame((_, delta) => {
    // Update flyTo animation
    if (isFlyingTo()) {
      updateFlyTo(camera, controlsRef.current);
      // Suppress CameraController lerp by keeping controls.enabled false
      return;
    }

    // Orbit mode
    const os = orbitState.current;
    if (os.active) {
      os.angle += os.speed * delta;
      const orbitY = Math.max(5, os.height);
      camera.position.set(
        os.center.x + Math.sin(os.angle) * os.radius,
        orbitY,
        os.center.z + Math.cos(os.angle) * os.radius,
      );
      camera.lookAt(os.center);
      if (controlsRef.current) controlsRef.current.enabled = false;
    }
  });

  return null;
}
