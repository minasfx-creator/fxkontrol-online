/**
 * TerrainCacheMetricsPanel — DOM HUD that subscribes to terrainMetrics and
 * displays useTerrainHeightCache counters in real time. Use to diagnose
 * Google 3D Tiles sync issues (LOD churn, drift events, raycast budget).
 */
import { useEffect, useState } from 'react';
import { terrainMetrics, type TerrainCacheMetrics } from '@/hooks/terrainCacheMetrics';
import { useTerrainCacheConfig, TERRAIN_CACHE_DEFAULTS } from '@/hooks/useTerrainCacheConfig';
import { terrainCacheControl } from '@/hooks/terrainCacheControl';
import { useTerrainPersistenceMode, TERRAIN_MODE_DESCRIPTIONS } from '@/hooks/useTerrainPersistenceMode';
import type { LocalCacheMode } from '@/hooks/terrainCacheLocalStorage';
import { useSceneStore } from '@/store/useSceneStore';
import { RotateCcw, X, Sliders, Eraser, RefreshCw, Cloud, HardDrive, Zap, Database } from 'lucide-react';

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

      <PersistenceModeSection />
      <ActionsSection />
      <TuningSection />
    </div>
  );
}

/** ── Cache invalidation actions (clear / force re-validate) ── */
function ActionsSection() {
  const [active, setActive] = useState(() => terrainCacheControl.isActive());
  const [busy, setBusy] = useState<null | 'mem' | 'force' | 'local' | 'cloud' | 'hard'>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  useEffect(() => terrainCacheControl.subscribe(setActive), []);

  useEffect(() => {
    if (!lastResult) return;
    const t = setTimeout(() => setLastResult(null), 3000);
    return () => clearTimeout(t);
  }, [lastResult]);

  const wrap = (kind: typeof busy, fn: () => Promise<void> | void, msg: string) => async () => {
    if (busy) return;
    setBusy(kind);
    try {
      await fn();
      setLastResult(msg);
    } catch (e) {
      setLastResult(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Sep />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, marginBottom: 4 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '8px', fontWeight: 700, letterSpacing: '0.12em', color: 'hsla(15, 80%, 65%, 0.9)' }}>
          <Eraser size={9} /> ACTIONS
        </span>
        {!active && <span style={{ fontSize: '8px', color: 'hsla(0,0%,55%,0.85)' }}>idle</span>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
        <ActionBtn
          icon={<RefreshCw size={9} />} label="Force Revalidate"
          color="hsl(207, 80%, 60%)" disabled={!active || !!busy} loading={busy === 'force'}
          onClick={wrap('force', () => terrainCacheControl.forceRevalidate(), 'Revalidation queued')}
        />
        <ActionBtn
          icon={<Zap size={9} />} label="Clear Memory"
          color="hsl(45, 95%, 55%)" disabled={!active || !!busy} loading={busy === 'mem'}
          onClick={wrap('mem', () => terrainCacheControl.clearMemory(), 'Memory cache cleared')}
        />
        <ActionBtn
          icon={<HardDrive size={9} />} label="Clear Local"
          color="hsl(280, 70%, 65%)" disabled={!active || !!busy} loading={busy === 'local'}
          onClick={wrap('local', () => terrainCacheControl.clearLocal(), 'Local browser cache cleared')}
        />
        <ActionBtn
          icon={<Cloud size={9} />} label="Clear Cloud"
          color="hsl(0, 80%, 60%)" disabled={!active || !!busy} loading={busy === 'cloud'}
          onClick={wrap('cloud', async () => {
            const n = await terrainCacheControl.clearCloud();
            setLastResult(`Cloud: ${n} rows deleted`);
          }, 'Cloud cache cleared')}
        />
      </div>

      <button
        onClick={wrap('hard', () => terrainCacheControl.hardReset(), 'Hard reset complete')}
        disabled={!active || !!busy}
        style={{
          marginTop: 4, width: '100%', padding: '4px 6px', borderRadius: 3,
          border: '1px solid hsla(0, 80%, 50%, 0.6)',
          background: busy === 'hard' ? 'hsla(0, 80%, 25%, 0.45)' : 'hsla(0, 80%, 18%, 0.35)',
          color: 'hsla(0, 80%, 80%, 0.95)',
          fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em',
          cursor: !active || busy ? 'not-allowed' : 'pointer',
          opacity: !active ? 0.45 : 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
        }}
        title="Drop in-memory + local + cloud caches and queue a full revalidation"
      >
        <Eraser size={10} /> HARD RESET (ALL TIERS)
      </button>

      {lastResult && (
        <div style={{
          marginTop: 4, padding: '3px 6px', borderRadius: 3,
          background: 'hsla(207, 60%, 18%, 0.6)',
          color: 'hsla(207, 80%, 85%, 0.95)',
          fontSize: '9px', textAlign: 'center',
        }}>
          {lastResult}
        </div>
      )}
    </>
  );
}

function ActionBtn({
  icon, label, color, disabled, loading, onClick,
}: {
  icon: React.ReactNode; label: string; color: string;
  disabled?: boolean; loading?: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick} disabled={disabled} title={label}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
        padding: '4px 6px', borderRadius: 3,
        border: `1px solid ${color}40`,
        background: loading ? `${color}30` : `${color}18`,
        color: color, fontSize: '9px', fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1, whiteSpace: 'nowrap',
      }}
    >
      {icon} {label}
    </button>
  );
}

/** ── Operator-tunable cache parameters (live sliders) ── */
function TuningSection() {
  const cfg = useTerrainCacheConfig();
  const intervalMs = (cfg.revalidateInterval / 60) * 1000;

  return (
    <>
      <Sep />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, marginBottom: 4 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '8px', fontWeight: 700, letterSpacing: '0.12em', color: 'hsla(280, 70%, 70%, 0.9)' }}>
          <Sliders size={9} /> TUNING
        </span>
        <button
          onClick={() => cfg.reset()}
          title="Reset to defaults"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: 3, background: 'transparent', color: 'hsla(0,0%,70%,0.8)' }}
        >
          <RotateCcw size={10} />
        </button>
      </div>

      <Slider
        label="Revalidate Interval"
        value={cfg.revalidateInterval}
        min={1} max={300} step={1}
        display={`${cfg.revalidateInterval}f · ${intervalMs.toFixed(0)}ms`}
        defaultValue={TERRAIN_CACHE_DEFAULTS.revalidateInterval}
        onChange={cfg.setRevalidateInterval}
      />
      <Slider
        label="Revalidate Batch"
        value={cfg.revalidateBatch}
        min={1} max={64} step={1}
        display={`${cfg.revalidateBatch} rays`}
        defaultValue={TERRAIN_CACHE_DEFAULTS.revalidateBatch}
        onChange={cfg.setRevalidateBatch}
      />
      <Slider
        label="Unresolved/Frame"
        value={cfg.unresolvedBatchPerFrame}
        min={1} max={128} step={1}
        display={`${cfg.unresolvedBatchPerFrame} rays`}
        defaultValue={TERRAIN_CACHE_DEFAULTS.unresolvedBatchPerFrame}
        onChange={cfg.setUnresolvedBatchPerFrame}
      />
      <Slider
        label="Drift Threshold"
        value={cfg.heightDriftThreshold}
        min={0.05} max={5} step={0.05}
        display={`${cfg.heightDriftThreshold.toFixed(2)}m`}
        defaultValue={TERRAIN_CACHE_DEFAULTS.heightDriftThreshold}
        onChange={cfg.setHeightDriftThreshold}
      />
    </>
  );
}

function Slider({
  label, value, min, max, step, display, defaultValue, onChange,
}: {
  label: string; value: number; min: number; max: number; step: number;
  display: string; defaultValue: number; onChange: (n: number) => void;
}) {
  const isDefault = value === defaultValue;
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}>
        <span style={{ color: 'hsla(0, 0%, 60%, 0.85)', fontSize: '9px' }}>{label}</span>
        <span style={{ color: isDefault ? 'hsla(0,0%,80%,0.85)' : 'hsl(280, 70%, 70%)', fontWeight: 600, fontSize: '9px' }}>
          {display}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{
          width: '100%',
          height: 4,
          accentColor: isDefault ? 'hsl(207, 80%, 60%)' : 'hsl(280, 70%, 60%)',
          cursor: 'pointer',
        }}
      />
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
