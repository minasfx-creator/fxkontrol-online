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
const SSE_TIERS: Record<string, number> = {
  ultra: 4,
  high: 8,
  medium: 16,
  low: 32,
};

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

  // Fetch API key on mount
  useEffect(() => {
    if (apiKey) return;
    (async () => {
      try {
        console.log('[GoogleTiles] Fetching API key...');
        const { data, error } = await supabase.functions.invoke('get-maps-key');
        if (error || !data?.key) {
          console.warn('[GoogleTiles] Failed to fetch API key:', error);
          return;
        }
        console.log('[GoogleTiles] API key acquired');
        setApiKey(data.key);
      } catch (err) {
        console.warn('[GoogleTiles] API key fetch error:', err);
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
    // TileCompressionPlugin removed — crashes with 'content' undefined in v0.4
    tiles.registerPlugin(new TilesFadePlugin());
    tiles.registerPlugin(new UpdateOnChangePlugin());
    tiles.registerPlugin(new UnloadTilesPlugin());

    tiles.errorTarget = SSE_TIERS.high;
    // errorThreshold removed — deprecated in 3d-tiles-renderer v0.4

    const group = groupRef.current;
    group.name = 'GoogleTilesGroup';
    tiles.setCamera(camera);
    tiles.setResolutionFromRenderer(camera, gl);

    group.add(tiles.group);
    scene.add(group);

    tilesRef.current = tiles;

    console.log('[GoogleTiles] Initialized successfully');

    return () => {
      console.log('[GoogleTiles] Disposing...');
      tiles.dispose();
      scene.remove(group);
      tilesRef.current = null;
    };
  }, [enabled, apiKey, scene, camera, gl]);

  // Update anchor position
  useEffect(() => {
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

  // Per-frame update
  useFrame(() => {
    const tiles = tilesRef.current;
    if (!tiles || !enabled) return;

    tiles.setCamera(camera);
    tiles.setResolutionFromRenderer(camera, gl);
    tiles.update();

    const root = tiles.root;
    if (root) {
      let visibleCount = 0;
      tiles.group.traverse(() => { visibleCount++; });
      updateGeoHUD({ tilesLoaded: visibleCount });
    }
  });

  // Visibility
  useEffect(() => {
    groupRef.current.visible = enabled;
  }, [enabled]);

  return null;
}
