/**
 * ─── Google Photorealistic 3D Tiles Engine ──────────────────────────
 * R3F component that loads Google's Photorealistic 3D Tiles and
 * aligns them with FXK's local ENU coordinate system via ECEF.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
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
  UnloadTilesPlugin,
  GLTFExtensionsPlugin,
} from '3d-tiles-renderer/plugins';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

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

// Reuse vectors to avoid per-frame allocations
const ORIGIN = new THREE.Vector3(0, 0, 0);
const TMP_WORLD = new THREE.Vector3();

// Throttle traverse to ~10fps (every 6th frame at 60fps)
const TRAVERSE_INTERVAL = 6;

// Hysteresis: require N consecutive zero-tile cycles before reverting to loading
const HYSTERESIS_THRESHOLD = 15;

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

// ── Main Component ──────────────────────────────────────────────────
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
  const frameCountRef = useRef(0);
  const zeroTileCountRef = useRef(0);
  const wasReadyRef = useRef(false);

  // Store applyAnchorTransform in a ref to avoid re-creating the init useEffect
  const applyAnchorTransformRef = useRef<() => void>(() => {});

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

  // Keep ref in sync
  applyAnchorTransformRef.current = applyAnchorTransform;

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

    // Register DRACOLoader for compressed Google 3D Tiles meshes
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    tiles.registerPlugin(new GLTFExtensionsPlugin({
      dracoLoader,
    }));

    tiles.errorTarget = GOOGLE_TILE_QUALITY_TO_SSE[googleTilesQuality];

    const group = groupRef.current;
    group.name = 'GoogleTilesGroup';
    group.renderOrder = -100;
    tiles.setCamera(camera);
    tiles.setResolutionFromRenderer(camera, gl);

    group.add(tiles.group);
    scene.add(group);

    tilesRef.current = tiles;
    wasReadyRef.current = false;
    zeroTileCountRef.current = 0;

    // Apply anchor transform via ref (avoids dep on applyAnchorTransform)
    applyAnchorTransformRef.current();

    console.log('[GoogleTiles] Initialized successfully');

    return () => {
      console.log('[GoogleTiles] Disposing...');
      tiles.dispose();
      scene.remove(group);
      tilesRef.current = null;
    };
  }, [enabled, apiKey, scene, camera, gl]);

  // Runtime quality change
  useEffect(() => {
    if (!tilesRef.current || !enabled) return;
    tilesRef.current.errorTarget = GOOGLE_TILE_QUALITY_TO_SSE[googleTilesQuality];
  }, [googleTilesQuality, enabled]);

  // Update anchor position
  useEffect(() => {
    applyAnchorTransform();
  }, [applyAnchorTransform]);

  // Per-frame update with radius culling + hysteresis
  useFrame(() => {
    const tiles = tilesRef.current;
    if (!tiles || !enabled) return;

    try {
      tiles.setCamera(camera);
      tiles.setResolutionFromRenderer(camera, gl);
      tiles.update();

      frameCountRef.current++;
      let visibleCount = 0;

      if (frameCountRef.current % TRAVERSE_INTERVAL === 0) {
        const cullRadius = Math.max(TILE_RADIUS_METERS, sceneImportRadius);

        tiles.group.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            if (!child.geometry?.boundingSphere) {
              child.geometry?.computeBoundingSphere();
            }
            child.getWorldPosition(TMP_WORLD);
            const dist = TMP_WORLD.distanceTo(ORIGIN);
            const isVisible = dist < cullRadius;
            child.visible = isVisible;
            if (isVisible) visibleCount++;
          }
        });
      }

      const root = tiles.root;
      if (root) {
        updateGeoHUD({ tilesLoaded: visibleCount });

        const now = performance.now();
        if (now - lastDebugPublishRef.current > 250) {
          lastDebugPublishRef.current = now;

          // Hysteresis logic: once ready, stay ready unless zero tiles for N cycles
          let nextState: TilesLoadingState;
          if (visibleCount > 2) {
            wasReadyRef.current = true;
            zeroTileCountRef.current = 0;
            nextState = 'ready';
          } else if (wasReadyRef.current) {
            if (visibleCount === 0) {
              zeroTileCountRef.current++;
            } else {
              zeroTileCountRef.current = 0;
            }
            nextState = zeroTileCountRef.current >= HYSTERESIS_THRESHOLD ? 'loading-tiles' : 'ready';
            if (nextState === 'loading-tiles') {
              wasReadyRef.current = false;
            }
          } else {
            nextState = 'loading-tiles';
          }

          const signature = [
            nextState, visibleCount, Math.round(tiles.errorTarget),
            groupRef.current.visible ? 1 : 0,
            anchorLat.toFixed(6), anchorLon.toFixed(6), anchorAlt.toFixed(1),
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
