import { useEffect, useRef, useState } from 'react';
import { useSceneStore } from '@/store/useSceneStore';
import { Bug } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * RenderDebugOverlay — DOM-based debug HUD for the 3D viewport.
 * Shows real-time: adaptive exposure, HDR multiplier, bloom, LOD,
 * tone mapping pipeline and scene quality info.
 */

// Module-level state updated from SkyCanvas's AdaptiveExposureController
let _debugExposure = 1.2;
let _debugLodTier = 'high';
let _debugLodDist = 0;
let _debugFps = 0;
let _debugDrawCalls = 0;
let _debugTriangles = 0;

export function setDebugExposure(v: number) { _debugExposure = v; }
export function setDebugLOD(tier: string, dist: number) { _debugLodTier = tier; _debugLodDist = dist; }
export function setDebugRendererInfo(fps: number, draws: number, tris: number) {
  _debugFps = fps; _debugDrawCalls = draws; _debugTriangles = tris;
}

export function RenderDebugToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "w-7 h-7 rounded-md flex items-center justify-center transition-all border",
        show
          ? "bg-primary/20 border-primary/40 text-primary"
          : "bg-surface-1/80 border-border/30 text-muted-foreground hover:text-foreground hover:border-border/60"
      )}
      title="Render Debug"
    >
      <Bug className="h-3.5 w-3.5" />
    </button>
  );
}

export function RenderDebugPanel() {
  const s = useSceneStore(st => st.settings);
  const [tick, setTick] = useState(0);

  // Force re-render at ~4Hz to update stats
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 250);
    return () => clearInterval(id);
  }, []);

  const tierColor: Record<string, string> = {
    ultra: 'hsl(142, 76%, 50%)',
    high: 'hsl(207, 90%, 60%)',
    medium: 'hsl(45, 95%, 55%)',
    low: 'hsl(0, 80%, 55%)',
  };

  const fpsColor = _debugFps >= 50 ? 'hsl(142, 76%, 50%)' : _debugFps >= 30 ? 'hsl(45, 95%, 55%)' : 'hsl(0, 80%, 55%)';
  const expColor = _debugExposure < 0.7 ? 'hsl(0, 80%, 55%)' : _debugExposure > 1.5 ? 'hsl(45, 95%, 55%)' : 'hsl(142, 76%, 50%)';

  return (
    <div className="absolute top-2 left-2 z-30 pointer-events-none select-none">
      <div
        className="rounded-md border backdrop-blur-md"
        style={{
          background: 'hsla(220, 20%, 8%, 0.88)',
          borderColor: 'hsla(220, 20%, 25%, 0.5)',
          padding: '8px 10px',
          fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
          fontSize: '10px',
          lineHeight: '1.7',
          color: 'hsla(0, 0%, 85%, 0.9)',
          minWidth: '180px',
        }}
      >
        <div style={{ fontSize: '8px', fontWeight: 700, letterSpacing: '0.12em', color: 'hsla(207, 80%, 65%, 0.8)', marginBottom: '4px' }}>
          RENDER DEBUG
        </div>

        <Row label="FPS" value={`${_debugFps}`} color={fpsColor} />
        <Row label="Draw Calls" value={`${_debugDrawCalls}`} />
        <Row label="Triangles" value={_debugTriangles > 1000 ? `${(_debugTriangles / 1000).toFixed(1)}K` : `${_debugTriangles}`} />

        <Sep />

        <Row label="LOD Tier" value={_debugLodTier.toUpperCase()} color={tierColor[_debugLodTier] || 'inherit'} />
        <Row label="Cam Dist" value={`${_debugLodDist}m`} />

        <Sep />

        <Row label="Exposure" value={_debugExposure.toFixed(2)} color={expColor} />
        <Row label="HDR Mult" value={`${s.hdrMultiplier.toFixed(1)}×`} color="hsl(45, 95%, 60%)" />
        <Row label="Brightness" value={`${s.effectBrightness.toFixed(1)}×`} />
        <Row label="Bloom" value={`${s.bloomStrength.toFixed(1)}×`} />
        <Row label="Particles" value={`${s.particleDensity.toFixed(1)}×`} />

        <Sep />

        <Row label="Tone Map" value="ACES (Effect)" color="hsl(120, 60%, 65%)" />
        <Row label="Renderer" value="Exposure→ACES" color="hsl(120, 60%, 65%)" />
      </div>
    </div>
  );
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
      <span style={{ color: 'hsla(0, 0%, 60%, 0.8)' }}>{label}</span>
      <span style={{ color: color || 'hsla(0, 0%, 90%, 0.9)', fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function Sep() {
  return <div style={{ height: '1px', background: 'hsla(220, 20%, 25%, 0.4)', margin: '3px 0' }} />;
}
