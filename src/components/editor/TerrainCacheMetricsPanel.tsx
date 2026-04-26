/**
 * TerrainCacheMetricsPanel — DOM HUD that subscribes to terrainMetrics and
 * displays useTerrainHeightCache counters in real time. Use to diagnose
 * Google 3D Tiles sync issues (LOD churn, drift events, raycast budget).
 */
import { useEffect, useState } from 'react';
import { terrainMetrics, type TerrainCacheMetrics } from '@/hooks/terrainCacheMetrics';
import { useSceneStore } from '@/store/useSceneStore';
import { RotateCcw, X } from 'lucide-react';

export default function TerrainCacheMetricsPanel() {
  const show = useSceneStore(s => s.environment.showTerrainMetrics);
  const overlayActive = useSceneStore(s => s.environment.showTerrainDebug);
  const updateEnvironment = useSceneStore(s => s.updateEnvironment);
  const [m, setM] = useState<TerrainCacheMetrics>(() => terrainMetrics.snapshot());

  useEffect(() => {
    if (!show) return;
    return terrainMetrics.subscribe(setM);
  }, [show]);

  if (!show) return null;

  const total = m.hits + m.misses;
  const hitRate = total > 0 ? (m.hits / total) * 100 : 0;
  const hitColor = hitRate > 90 ? 'hsl(142, 76%, 50%)' : hitRate > 70 ? 'hsl(45, 95%, 55%)' : 'hsl(0, 80%, 55%)';
  const frameColor = m.avgFrameMs < 1 ? 'hsl(142, 76%, 50%)' : m.avgFrameMs < 3 ? 'hsl(45, 95%, 55%)' : 'hsl(0, 80%, 55%)';

  return (
    <div
      className="absolute z-30 pointer-events-auto select-none rounded-md border backdrop-blur-md"
      style={{
        top: overlayActive ? 220 : 56,
        right: 12,
        background: 'hsla(220, 20%, 8%, 0.9)',
        borderColor: 'hsla(220, 20%, 28%, 0.55)',
        padding: '8px 10px',
        fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
        fontSize: '10px',
        lineHeight: '1.7',
        color: 'hsla(0, 0%, 88%, 0.95)',
        minWidth: '210px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: '8px', fontWeight: 700, letterSpacing: '0.12em', color: 'hsla(207, 80%, 65%, 0.9)' }}>
          TERRAIN CACHE
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => terrainMetrics.reset()}
            title="Reset counters"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: 3, background: 'transparent', color: 'hsla(0,0%,70%,0.8)' }}
          >
            <RotateCcw size={10} />
          </button>
          <button
            onClick={() => updateEnvironment({ showTerrainMetrics: false })}
            title="Close"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: 3, background: 'transparent', color: 'hsla(0,0%,70%,0.8)' }}
          >
            <X size={10} />
          </button>
        </div>
      </div>

      <Row label="Tiles Group" value={m.tilesGroupFound ? 'FOUND' : 'MISSING'} color={m.tilesGroupFound ? 'hsl(142, 76%, 50%)' : 'hsl(0, 80%, 55%)'} />
      <Row label="Tracked Pins" value={`${m.trackedPositions}`} />
      <Row label="Cache Size" value={`${m.cacheSize}`} />

      <Sep />

      <Row label="getHeight()" value={`${total}`} />
      <Row label="Hits" value={`${m.hits}`} color="hsl(142, 76%, 55%)" />
      <Row label="Misses" value={`${m.misses}`} color={m.misses > 0 ? 'hsl(45, 95%, 55%)' : 'inherit'} />
      <Row label="Hit Rate" value={`${hitRate.toFixed(1)}%`} color={hitColor} />

      <Sep />

      <Row label="Unresolved Rays" value={`${m.unresolvedSamples}`} />
      <Row label="One-Shot Resolves" value={`${m.oneShotResolves}`} color={m.oneShotResolves > 0 ? 'hsl(207, 80%, 65%)' : 'inherit'} />
      <Row label="Revalidations" value={`${m.revalidations}`} />
      <Row label="Drift Events" value={`${m.driftEvents}`} color={m.driftEvents > 0 ? 'hsl(45, 95%, 55%)' : 'inherit'} />
      <Row label="LOD Changes" value={`${m.lodChanges}`} color={m.lodChanges > 0 ? 'hsl(207, 80%, 65%)' : 'inherit'} />

      <Sep />

      <Row label="Last Frame" value={`${m.lastFrameMs.toFixed(2)}ms`} color={frameColor} />
      <Row label="Avg (60f)" value={`${m.avgFrameMs.toFixed(2)}ms`} color={frameColor} />
      <Row label="Peak (60f)" value={`${m.peakFrameMs.toFixed(2)}ms`} />
      <Row label="Frame #" value={`${m.frame}`} />
    </div>
  );
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
      <span style={{ color: 'hsla(0, 0%, 60%, 0.85)' }}>{label}</span>
      <span style={{ color: color || 'hsla(0, 0%, 92%, 0.95)', fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function Sep() {
  return <div style={{ height: 1, background: 'hsla(220, 20%, 25%, 0.45)', margin: '3px 0' }} />;
}
