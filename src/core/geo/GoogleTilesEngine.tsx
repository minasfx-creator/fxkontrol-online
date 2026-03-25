/**
 * ─── Google Photorealistic 3D Tiles Engine ──────────────────────────
 * R3F component that loads Google's Photorealistic 3D Tiles and
 * aligns them with FXK's local ENU coordinate system via ECEF.
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useSceneStore } from '@/store/useSceneStore';
import { updateGeoHUD } from '@/components/editor/GeoHUD';
import { geoToECEF } from '@/lib/floatingOriginEngine';
import { supabase } from '@/integrations/supabase/client';

import { TilesRenderer } from '3d-tiles-renderer';
import {
  GoogleCloudAuthPlugin,
  TilesFadePlugin,
  UpdateOnChangePlugin,
  UnloadTilesPlugin,
} from '3d-tiles-renderer/plugins';

// ── ECEF→ENU rotation matrix for a given lat/lon anchor ─────────────
function buildECEFtoENUMatrix(lat: number, lon: number): THREE.Matrix4 {
  const DEG2RAD = Math.PI / 180;
  const latRad = lat * DEG2RAD;
  const lonRad = lon * DEG2RAD;

  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const sinLon = Math.sin(lonRad);
  const cosLon = Math.cos(lonRad);

  const m = new THREE.Matrix4();
  m.set(
    -sinLon,           cosLon,            0,       0,
    -sinLat * cosLon, -sinLat * sinLon,   cosLat,  0,
     cosLat * cosLon,  cosLat * sinLon,   sinLat,  0,
     0,                0,                 0,       1,
  );

  const e = m.elements;
  const r1 = [e[1], e[5], e[9], e[13]];
  const r2 = [e[2], e[6], e[10], e[14]];
  e[1] = r2[0]; e[5] = r2[1]; e[9] = r2[2]; e[13] = r2[3];
  e[2] = -r1[0]; e[6] = -r1[1]; e[10] = -r1[2]; e[14] = -r1[3];

  return m;
}

// ── SSE quality tiers ───────────────────────────────────────────────

// ── SSE quality tiers ───────────────────────────────────────────────
const SSE_TIERS = {
  ultra: 4,
  high: 8,
  medium: 16,
  low: 32,
} as const;

const GOOGLE_TILE_QUALITY_TO_SSE = {
  low: SSE_TIERS.low,
  medium: SSE_TIERS.medium,
  high: SSE_TIERS.high,
} as const;

// 2 km² ≈ circle radius ~800m
const TILE_RADIUS_METERS = 800;

// Reuse vectors/matrices to avoid per-frame allocations
const ORIGIN = new THREE.Vector3(0, 0, 0);
const TMP_WORLD = new THREE.Vector3();

// ── Main Component ──────────────────────────────────────────────────
// ── Loading state broadcast for HUD overlay ─────────────────────────
export type TilesLoadingState = 'idle' | 'fetching-key' | 'loading-tiles' | 'ready' | 'error';

export interface TilesDebugInfo {
  state: TilesLoadingState;
  count: number;
  sse: number;
  errorMsg: string | null;
  anchorLat: number;
  anchorLon: number;
  anchorAlt: number;
  groupVisible: boolean;
  rendererActive: boolean;
}

let _tilesDebug: TilesDebugInfo = {
  state: 'idle', count: 0, sse: 0, errorMsg: null,
  anchorLat: 0, anchorLon: 0, anchorAlt: 0,
  groupVisible: false, rendererActive: false,
};
const _listeners = new Set<() => void>();

export function getTilesLoadingState() { return _tilesDebug.state; }
export function getTilesLoadedCount() { return _tilesDebug.count; }
export function getTilesDebugInfo() { return _tilesDebug; }
export function subscribeTilesLoading(cb: () => void) {
  _listeners.add(cb);
  return () => { _listeners.delete(cb); };
}
function setLoadingState(s: TilesLoadingState, count = _tilesDebug.count, extra?: Partial<TilesDebugInfo>) {
  _tilesDebug = { ..._tilesDebug, state: s, count, ...extra };
  _listeners.forEach(cb => cb());
}

export default function GoogleTilesLayer() {
  const { scene, camera, gl } = useThree();
  const tilesRef = useRef<TilesRenderer | null>(null);
  const groupRef = useRef<THREE.Group>(new THREE.Group());
  const [apiKey, setApiKey] = useState<string | null>(null);

  const anchorLat = useSceneStore((s) => s.settings.geoAnchorLat);
  const anchorLon = useSceneStore((s) => s.settings.geoAnchorLon);
  const anchorAlt = useSceneStore((s) => s.settings.geoAnchorAlt);
  const enabled = useSceneStore((s) => s.settings.google3DTilesEnabled);
  const sceneImportRadius = useSceneStore((s) => s.settings.sceneImportRadius);
  const googleTilesQuality = useSceneStore((s) => s.settings.googleTilesQuality);
  const lastDebugPublishRef = useRef(0);
  const lastDebugSignatureRef = useRef('');

  const applyAnchorTransform = useCallback(() => {
    if (!tilesRef.current) return;

    const anchorECEF = geoToECEF({ lat: anchorLat, lon: anchorLon, alt: anchorAlt });
    const enuMatrix = buildECEFtoENUMatrix(anchorLat, anchorLon);

    const translationMatrix = new THREE.Matrix4().makeTranslation(
      -anchorECEF.x, -anchorECEF.y, -anchorECEF.z,
    );

    const finalMatrix = new THREE.Matrix4().multiplyMatrices(enuMatrix, translationMatrix);

    groupRef.current.matrix.copy(finalMatrix);
    groupRef.current.matrixAutoUpdate = false;
    groupRef.current.matrixWorldNeedsUpdate = true;
  }, [anchorLat, anchorLon, anchorAlt]);

  // Fetch API key on mount
  useEffect(() => {
    if (apiKey) return;
    setLoadingState('fetching-key', 0, { errorMsg: null });
    (async () => {
      try {
        console.log('[GoogleTiles] Fetching API key...');
        const { data, error } = await supabase.functions.invoke('get-maps-key');
        if (error || !data?.key) {
          const msg = error?.message || 'No key returned';
          console.warn('[GoogleTiles] Failed to fetch API key:', msg);
          setLoadingState('error', 0, { errorMsg: `API key: ${msg}` });
          return;
        }
        console.log('[GoogleTiles] API key acquired');
        setApiKey(data.key);
        setLoadingState('loading-tiles', 0, { errorMsg: null });
      } catch (err) {
        console.warn('[GoogleTiles] API key fetch error:', err);
        setLoadingState('error', 0, { errorMsg: `Fetch error: ${(err as Error).message}` });
      }
    })();
  }, [apiKey]);

  // Initialize TilesRenderer when enabled and API key is ready
  useEffect(() => {
    if (!enabled || !apiKey) return;
    if (tilesRef.current) return;

    console.log('[GoogleTiles] Initializing TilesRenderer...');

    const tiles = new TilesRenderer();

    tiles.registerPlugin(new GoogleCloudAuthPlugin({ apiToken: apiKey }));
    tiles.registerPlugin(new TilesFadePlugin());
    tiles.registerPlugin(new UnloadTilesPlugin());

    // Initial quality from user settings (low/medium/high)
    tiles.errorTarget = GOOGLE_TILE_QUALITY_TO_SSE[googleTilesQuality];

    const group = groupRef.current;
    group.name = 'GoogleTilesGroup';
    tiles.setCamera(camera);
    tiles.setResolutionFromRenderer(camera, gl);

    group.add(tiles.group);
    scene.add(group);

    tilesRef.current = tiles;

    // Critical: apply anchor transform immediately after renderer init.
    // Without this, tiles may stay in ECEF space until anchor changes.
    applyAnchorTransform();

    console.log('[GoogleTiles] Initialized successfully');

    return () => {
      console.log('[GoogleTiles] Disposing...');
      tiles.dispose();
      scene.remove(group);
      tilesRef.current = null;
    };
    // NOTE: googleTilesQuality intentionally excluded — handled by separate useEffect
    // to avoid destroying/recreating the entire TilesRenderer on quality change
  }, [enabled, apiKey, scene, camera, gl, applyAnchorTransform]);

  // Runtime quality change from settings
  useEffect(() => {
    if (!tilesRef.current || !enabled) return;
    tilesRef.current.errorTarget = GOOGLE_TILE_QUALITY_TO_SSE[googleTilesQuality];
  }, [googleTilesQuality, enabled]);

  // Update anchor position
  useEffect(() => {
    applyAnchorTransform();
  }, [applyAnchorTransform]);

  // Per-frame update with 5 km radius culling
  useFrame(() => {
    const tiles = tilesRef.current;
    if (!tiles || !enabled) return;

    try {
      tiles.setCamera(camera);
      tiles.setResolutionFromRenderer(camera, gl);
      tiles.update();

      // Cull tiles outside user-selected scene radius (with safe floor)
      let visibleCount = 0;
      let debuggedFirst = false;

      tiles.group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.visible = true;
          visibleCount++;

          // Log first tile position once for debugging
          if (!debuggedFirst) {
            debuggedFirst = true;
            child.getWorldPosition(TMP_WORLD);
            console.log('[GoogleTiles] First tile world pos:', TMP_WORLD.x.toFixed(1), TMP_WORLD.y.toFixed(1), TMP_WORLD.z.toFixed(1),
              '| camera:', camera.position.x.toFixed(1), camera.position.y.toFixed(1), camera.position.z.toFixed(1));
          }
        }
      });

      const root = tiles.root;
      if (root) {
        updateGeoHUD({ tilesLoaded: visibleCount });

        // Throttle debug-state broadcast to reduce UI churn / potential stutter.
        const now = performance.now();
        if (now - lastDebugPublishRef.current > 250) {
          lastDebugPublishRef.current = now;

          const nextState: TilesLoadingState = visibleCount > 2 ? 'ready' : 'loading-tiles';
          const signature = [
            nextState,
            visibleCount,
            Math.round(tiles.errorTarget),
            groupRef.current.visible ? 1 : 0,
            anchorLat.toFixed(6),
            anchorLon.toFixed(6),
            anchorAlt.toFixed(1),
          ].join('|');

          if (signature !== lastDebugSignatureRef.current) {
            lastDebugSignatureRef.current = signature;
            setLoadingState(nextState, visibleCount, {
              sse: tiles.errorTarget,
              anchorLat, anchorLon, anchorAlt,
              groupVisible: groupRef.current.visible,
              rendererActive: true,
            });
          }
        }
      }
    } catch (err) {
      console.warn('[Terrain] update error caught:', err);
    }
  });

  // Visibility
  useEffect(() => {
    groupRef.current.visible = enabled;
  }, [enabled]);

  return null;
}
