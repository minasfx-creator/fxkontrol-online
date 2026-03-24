/**
 * ─── Google Photorealistic 3D Tiles Engine ──────────────────────────
 * R3F component that loads Google's Photorealistic 3D Tiles and
 * aligns them with FXK's local ENU coordinate system via ECEF.
 *
 * Uses the existing FloatingOrigin + GeoEngine pipeline for precision.
 * Manages VRAM, LOD, and tile lifecycle automatically.
 */

import { useEffect, useRef, useMemo, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useSceneStore } from '@/store/useSceneStore';
import { updateGeoHUD } from '@/components/editor/GeoHUD';
import { geoToECEF } from '@/lib/floatingOriginEngine';
import { supabase } from '@/integrations/supabase/client';

// 3d-tiles-renderer imports
import {
  TilesRenderer,
  GoogleCloudAuthPlugin,
  TileCompressionPlugin,
  TilesFadePlugin,
  UpdateOnChangePlugin,
  UnloadTilesPlugin,
} from '3d-tiles-renderer';

// ── ECEF→ENU rotation matrix for a given lat/lon anchor ─────────────
function buildECEFtoENUMatrix(lat: number, lon: number): THREE.Matrix4 {
  const DEG2RAD = Math.PI / 180;
  const latRad = lat * DEG2RAD;
  const lonRad = lon * DEG2RAD;

  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const sinLon = Math.sin(lonRad);
  const cosLon = Math.cos(lonRad);

  // ENU rotation: columns are East, North, Up in ECEF
  // Then we remap to Three.js: X=East, Y=Up, Z=-North
  const m = new THREE.Matrix4();
  m.set(
    -sinLon,           cosLon,            0,       0,  // X = East
    -sinLat * cosLon, -sinLat * sinLon,   cosLat,  0,  // temp North → will become -Z
     cosLat * cosLon,  cosLat * sinLon,   sinLat,  0,  // temp Up → will become Y
     0,                0,                 0,       1,
  );

  // Swap rows: Y↔Z and negate new Z to get Three.js convention
  // Row 0 = East (X) ✓
  // Row 1 = Up (Y) — currently row 2
  // Row 2 = -North (-Z) — currently -row 1
  const e = m.elements;
  // Swap row 1 (North) and row 2 (Up), then negate row 2
  const r1 = [e[1], e[5], e[9], e[13]];
  const r2 = [e[2], e[6], e[10], e[14]];
  // Y = Up (was row 2)
  e[1] = r2[0]; e[5] = r2[1]; e[9] = r2[2]; e[13] = r2[3];
  // Z = -North (negate was row 1)
  e[2] = -r1[0]; e[6] = -r1[1]; e[10] = -r1[2]; e[14] = -r1[3];

  return m;
}

// ── SSE quality tiers mapped to Adaptive Quality ────────────────────
const SSE_TIERS: Record<string, number> = {
  ultra: 4,
  high: 8,
  medium: 16,
  low: 32,
};

// ── Main Component ──────────────────────────────────────────────────

export default function GoogleTilesLayer() {
  const { scene, camera } = useThree();
  const tilesRef = useRef<TilesRenderer | null>(null);
  const groupRef = useRef<THREE.Group>(new THREE.Group());
  const apiKeyRef = useRef<string | null>(null);
  const initRef = useRef(false);

  const anchorLat = useSceneStore((s) => s.settings.geoAnchorLat);
  const anchorLon = useSceneStore((s) => s.settings.geoAnchorLon);
  const anchorAlt = useSceneStore((s) => s.settings.geoAnchorAlt);
  const enabled = useSceneStore((s) => s.settings.google3DTilesEnabled);

  // Fetch API key on mount
  useEffect(() => {
    if (apiKeyRef.current) return;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-maps-key');
        if (error || !data?.key) {
          console.warn('[GoogleTiles] Failed to fetch API key:', error);
          return;
        }
        apiKeyRef.current = data.key;
      } catch (err) {
        console.warn('[GoogleTiles] API key fetch error:', err);
      }
    })();
  }, []);

  // Initialize TilesRenderer when enabled and API key is ready
  useEffect(() => {
    if (!enabled || !apiKeyRef.current || initRef.current) return;
    if (tilesRef.current) return;

    const tiles = new TilesRenderer();

    // Register plugins
    tiles.registerPlugin(new GoogleCloudAuthPlugin({ apiToken: apiKeyRef.current }));
    tiles.registerPlugin(new TileCompressionPlugin());
    tiles.registerPlugin(new TilesFadePlugin());
    tiles.registerPlugin(new UpdateOnChangePlugin());
    tiles.registerPlugin(new UnloadTilesPlugin());

    // VRAM limits
    tiles.errorTarget = SSE_TIERS.high;
    tiles.errorThreshold = 40;

    // Add tiles group to scene
    const group = groupRef.current;
    group.name = 'GoogleTilesGroup';
    tiles.setCamera(camera);
    tiles.setResolutionFromRenderer(camera, (camera as any).__r3f?.root?.getState?.()?.gl);

    group.add(tiles.group);
    scene.add(group);

    tilesRef.current = tiles;
    initRef.current = true;

    console.log('[GoogleTiles] Initialized');

    return () => {
      tiles.dispose();
      scene.remove(group);
      tilesRef.current = null;
      initRef.current = false;
    };
  }, [enabled, scene, camera]);

  // Update anchor position — recompute the ECEF→ENU transform matrix
  useEffect(() => {
    if (!tilesRef.current) return;

    const anchorECEF = geoToECEF({ lat: anchorLat, lon: anchorLon, alt: anchorAlt });
    const enuMatrix = buildECEFtoENUMatrix(anchorLat, anchorLon);

    // Translation: move ECEF origin to anchor, then apply ENU rotation
    // The tiles are in ECEF, so we need to:
    // 1. Translate by -anchorECEF (center at anchor)
    // 2. Rotate ECEF→ENU (Three.js local)
    const translationMatrix = new THREE.Matrix4().makeTranslation(
      -anchorECEF.x, -anchorECEF.y, -anchorECEF.z,
    );

    const finalMatrix = new THREE.Matrix4().multiplyMatrices(enuMatrix, translationMatrix);

    groupRef.current.matrix.copy(finalMatrix);
    groupRef.current.matrixAutoUpdate = false;
    groupRef.current.matrixWorldNeedsUpdate = true;

  }, [anchorLat, anchorLon, anchorAlt]);

  // Per-frame update
  useFrame(() => {
    const tiles = tilesRef.current;
    if (!tiles || !enabled) return;

    tiles.setCamera(camera);
    tiles.update();

    // Feed stats to GeoHUD
    const stats = tiles.stats;
    if (stats) {
      updateGeoHUD({
        tilesLoaded: stats.visibleTiles || 0,
        vramPressure: stats.usedGPUMemory
          ? stats.usedGPUMemory / (512 * 1024 * 1024)
          : 0,
      });
    }
  });

  // Visibility
  useEffect(() => {
    groupRef.current.visible = enabled;
  }, [enabled]);

  return null;
}
