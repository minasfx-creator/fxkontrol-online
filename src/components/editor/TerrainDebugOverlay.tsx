/**
 * TerrainDebugOverlay — Visual debug for terrain height sync.
 *
 * For each PositionPin, draws a vertical line from the cached terrain Y
 * (`useTerrainHeightCache.getHeight`) to the *current* live raycast hit
 * against the Google 3D Tiles mesh, plus an HTML label showing both
 * values and the delta. When |Δ| > 0.5 m the segment turns amber/red so
 * stale LOD pockets are obvious at a glance.
 *
 * This is a debug-only component; it allocates ~3 small vectors total
 * and re-runs raycasts at ~5 Hz to stay cheap.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { useProjectStore } from '@/store/useProjectStore';
import { useSceneStore } from '@/store/useSceneStore';
import type { TerrainHeightCache } from '@/hooks/useTerrainHeightCache';

const _origin = new THREE.Vector3();
const _down = new THREE.Vector3(0, -1, 0);
const _ray = new THREE.Raycaster();
const SAMPLE_INTERVAL_S = 0.2; // ~5 Hz
const DRIFT_WARN = 0.5;        // m — matches HEIGHT_DRIFT_THRESHOLD in cache
const DRIFT_FAIL = 2.0;        // m — visible jump territory

interface PinSample {
  id: string;
  name: string;
  x: number;
  z: number;
  cachedY: number;
  liveY: number | null;
  drift: number; // |liveY - cachedY|, NaN if no live hit
}

export default function TerrainDebugOverlay({ cache }: { cache: TerrainHeightCache }) {
  const enabled = useSceneStore(s => s.environment.showTerrainDebug);
  const google3DTilesEnabled = useSceneStore(s => s.settings.google3DTilesEnabled);
  const positions = useProjectStore(s => s.positions);
  const { scene } = useThree();
  const accumRef = useRef(0);
  const [samples, setSamples] = useState<PinSample[]>([]);

  // Reset samples when the overlay or tiles get disabled
  useEffect(() => {
    if (!enabled || !google3DTilesEnabled) setSamples([]);
  }, [enabled, google3DTilesEnabled]);

  useFrame((_, dt) => {
    if (!enabled || !google3DTilesEnabled || positions.length === 0) return;
    accumRef.current += dt;
    if (accumRef.current < SAMPLE_INTERVAL_S) return;
    accumRef.current = 0;

    const tilesGroup = scene.getObjectByName('GoogleTilesGroup');
    if (!tilesGroup) return;

    const next: PinSample[] = positions.map((p) => {
      _origin.set(p.x, 2000, p.z);
      _ray.set(_origin, _down);
      _ray.far = 4000;
      const hits = _ray.intersectObject(tilesGroup, true);
      const liveY = hits.length > 0 ? hits[0].point.y : null;
      const cachedY = cache.getHeight(p.x, p.z);
      const drift = liveY === null ? NaN : Math.abs(liveY - cachedY);
      return { id: p.id, name: p.name ?? p.id.slice(0, 6), x: p.x, z: p.z, cachedY, liveY, drift };
    });
    setSamples(next);
  });

  if (!enabled || !google3DTilesEnabled || samples.length === 0) return null;

  return (
    <group renderOrder={9999}>
      {samples.map((s) => (
        <SampleVis key={s.id} sample={s} />
      ))}
      <LegendHud count={samples.length} />
    </group>
  );
}

function severityColor(drift: number): string {
  if (Number.isNaN(drift)) return '#888888';      // no live hit
  if (drift > DRIFT_FAIL) return '#ef4444';        // red — large jump
  if (drift > DRIFT_WARN) return '#f59e0b';        // amber — drift
  return '#10b981';                                 // green — in sync
}

function SampleVis({ sample }: { sample: PinSample }) {
  const { x, z, cachedY, liveY, drift } = sample;
  const color = severityColor(drift);

  // Line spans the larger envelope (top of stack to lowest sampled Y),
  // with two endpoint markers so cached & live points are individually visible.
  const yA = cachedY;
  const yB = liveY ?? cachedY;
  const labelY = Math.max(yA, yB) + 6;

  const linePts = useMemo<[number, number, number][]>(() => [
    [x, yA, z],
    [x, yB, z],
  ], [x, z, yA, yB]);

  return (
    <group>
      {/* Vertical comparison segment */}
      <Line points={linePts} color={color} lineWidth={2} dashed={false} transparent opacity={0.95} />

      {/* Cached height marker (cube) */}
      <mesh position={[x, cachedY, z]}>
        <boxGeometry args={[0.6, 0.6, 0.6]} />
        <meshBasicMaterial color="#3b82f6" />
      </mesh>

      {/* Live raycast marker (sphere) — only when we have a hit */}
      {liveY !== null && (
        <mesh position={[x, liveY, z]}>
          <sphereGeometry args={[0.4, 10, 10]} />
          <meshBasicMaterial color={color} />
        </mesh>
      )}

      {/* HTML label */}
      <Html position={[x, labelY, z]} center distanceFactor={40} zIndexRange={[100, 0]}>
        <div
          className="pointer-events-none select-none rounded-md border px-2 py-1 font-mono text-[10px] leading-tight backdrop-blur-md"
          style={{
            background: 'hsla(220, 20%, 8%, 0.85)',
            borderColor: color,
            color: 'hsl(0 0% 90%)',
            minWidth: '110px',
          }}
        >
          <div style={{ color, fontWeight: 700, fontSize: '9px', letterSpacing: '0.08em' }}>
            {sample.name.toUpperCase()}
          </div>
          <Row label="cache" value={`${cachedY.toFixed(2)}m`} color="#3b82f6" />
          <Row
            label="live"
            value={liveY === null ? '—' : `${liveY.toFixed(2)}m`}
            color={color}
          />
          <Row
            label="Δ"
            value={Number.isNaN(drift) ? 'no hit' : `${drift.toFixed(2)}m`}
            color={color}
            bold
          />
        </div>
      </Html>
    </group>
  );
}

function Row({ label, value, color, bold }: { label: string; value: string; color: string; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
      <span style={{ color: 'hsla(0, 0%, 60%, 0.85)' }}>{label}</span>
      <span style={{ color, fontWeight: bold ? 700 : 500 }}>{value}</span>
    </div>
  );
}

/** Small in-scene HUD describing legend + counts. */
function LegendHud({ count }: { count: number }) {
  return (
    <Html
      position={[0, 0, 0]}
      wrapperClass="terrain-debug-legend"
      style={{ position: 'fixed', top: 56, right: 12, pointerEvents: 'none' }}
      transform={false}
      prepend
    >
      <div
        className="rounded-md border px-2.5 py-2 font-mono text-[10px] backdrop-blur-md"
        style={{
          background: 'hsla(220, 20%, 8%, 0.88)',
          borderColor: 'hsla(220, 20%, 30%, 0.5)',
          color: 'hsl(0 0% 85%)',
          minWidth: '160px',
        }}
      >
        <div style={{ fontSize: '8px', fontWeight: 700, letterSpacing: '0.12em', color: 'hsl(207 80% 65%)', marginBottom: '4px' }}>
          TERRAIN DEBUG · {count} pins
        </div>
        <LegendRow color="#3b82f6" label="cached Y (cube)" />
        <LegendRow color="#10b981" label="live raycast (sync)" />
        <LegendRow color="#f59e0b" label={`drift > ${DRIFT_WARN}m`} />
        <LegendRow color="#ef4444" label={`drift > ${DRIFT_FAIL}m`} />
        <LegendRow color="#888888" label="no tile hit" />
      </div>
    </Html>
  );
}

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', lineHeight: 1.5 }}>
      <span style={{ width: 8, height: 8, borderRadius: 2, background: color, display: 'inline-block' }} />
      <span style={{ color: 'hsla(0, 0%, 80%, 0.9)' }}>{label}</span>
    </div>
  );
}
