/**
 * ─── useCamera Hook ─────────────────────────────────────────────────
 * React hook wrapping the GeoCamera fly-to system.
 * Provides flyTo, cancel, and active-state for UI binding.
 */

import { useCallback, useRef, useState } from 'react';
import { useSceneStore } from '@/store/useSceneStore';
import {
  flyTo as geoFlyTo,
  updateFlyTo,
  cancelFlyTo,
  isFlyingTo,
  type FlyToTarget,
} from '@/core/camera/geoCamera';
import * as THREE from 'three';

export function useCamera() {
  const [flying, setFlying] = useState(false);
  const cameraRef = useRef<THREE.Camera | null>(null);
  const controlsRef = useRef<{ enabled: boolean; target: THREE.Vector3 } | null>(null);

  const settings = useSceneStore((s) => s.settings);

  const flyTo = useCallback((target: FlyToTarget) => {
    if (!cameraRef.current) return;
    geoFlyTo(target, cameraRef.current, controlsRef.current, {
      lat: settings.geoAnchorLat,
      lon: settings.geoAnchorLon,
      alt: settings.geoAnchorAlt,
    });
    setFlying(true);
  }, [settings.geoAnchorLat, settings.geoAnchorLon, settings.geoAnchorAlt]);

  const cancel = useCallback(() => {
    cancelFlyTo(controlsRef.current ?? undefined);
    setFlying(false);
  }, []);

  const update = useCallback(() => {
    if (!cameraRef.current) return false;
    const active = updateFlyTo(cameraRef.current, controlsRef.current);
    if (!active && flying) setFlying(false);
    return active;
  }, [flying]);

  return {
    flyTo,
    cancel,
    update,
    flying,
    isFlyingTo,
    cameraRef,
    controlsRef,
  };
}
