/**
 * ─── useGeo Hook ────────────────────────────────────────────────────
 * React hook for geo-spatial operations via the GeoEngine Worker.
 * Provides Float64-precise coordinate transforms off the main thread.
 */

import { useRef, useCallback, useEffect, useState } from 'react';
import { useSceneStore } from '@/store/useSceneStore';

export interface GeoLocalPosition {
  x: number; // East
  y: number; // Up
  z: number; // -North (Three.js)
}

let _workerInstance: Worker | null = null;
let _msgId = 0;
const _pendingCallbacks = new Map<number, (result: any) => void>();

function getWorker(): Worker {
  if (!_workerInstance) {
    _workerInstance = new Worker(
      new URL('./geoEngine.worker.ts', import.meta.url),
      { type: 'module' }
    );
    _workerInstance.onmessage = (e) => {
      const { id, result } = e.data;
      if (id !== undefined && _pendingCallbacks.has(id)) {
        _pendingCallbacks.get(id)!(result);
        _pendingCallbacks.delete(id);
      }
    };
  }
  return _workerInstance;
}

function postWorkerMessage(type: string, payload: any): Promise<any> {
  return new Promise((resolve) => {
    const id = _msgId++;
    _pendingCallbacks.set(id, resolve);
    getWorker().postMessage({ type, id, payload });
  });
}

export function useGeo() {
  const anchorLat = useSceneStore((s) => s.settings.geoAnchorLat);
  const anchorLon = useSceneStore((s) => s.settings.geoAnchorLon);
  const anchorAlt = useSceneStore((s) => s.settings.geoAnchorAlt);
  const [ready, setReady] = useState(false);

  // Sync anchor to worker whenever it changes
  useEffect(() => {
    postWorkerMessage('setAnchor', { lat: anchorLat, lng: anchorLon, alt: anchorAlt })
      .then(() => setReady(true));
  }, [anchorLat, anchorLon, anchorAlt]);

  const geoToLocal = useCallback(
    (lat: number, lng: number, alt: number): Promise<GeoLocalPosition> =>
      postWorkerMessage('geoToLocal', { lat, lng, alt }).then((r) => ({
        x: r[0], y: r[1], z: r[2],
      })),
    [],
  );

  const batchGeoToLocal = useCallback(
    (positions: { lat: number; lng: number; alt: number }[]): Promise<Float32Array> =>
      postWorkerMessage('batchTransform', { positions }),
    [],
  );

  const recenter = useCallback(
    (lat: number, lng: number, alt: number) =>
      postWorkerMessage('recenter', { newAnchor: { lat, lng, alt } }),
    [],
  );

  return {
    ready,
    geoToLocal,
    batchGeoToLocal,
    recenter,
    anchor: { lat: anchorLat, lon: anchorLon, alt: anchorAlt },
  };
}

/**
 * Synchronous geo-to-local for use in useFrame (no Worker round-trip).
 * Uses flat-earth approximation — accurate within ~10km of anchor.
 */
export function geoToLocalSync(
  lat: number, lng: number, alt: number,
  anchorLat: number, anchorLon: number, anchorAlt: number,
): GeoLocalPosition {
  const DEG2RAD = Math.PI / 180;
  const latRad = anchorLat * DEG2RAD;
  const mLat = 111132.92 - 559.82 * Math.cos(2 * latRad) + 1.175 * Math.cos(4 * latRad);
  const mLon = 111412.84 * Math.cos(latRad) - 93.5 * Math.cos(3 * latRad);

  return {
    x: (lng - anchorLon) * mLon,
    y: alt - anchorAlt,
    z: -(lat - anchorLat) * mLat,
  };
}
