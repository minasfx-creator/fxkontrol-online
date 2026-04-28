/**
 * ─── GPU / Renderer Diagnostics Panel (DEV ONLY) ─────────────────────
 * Surfaces low-level WebGL state that's normally hidden from the operator:
 *   • GPU vendor / renderer (via WEBGL_debug_renderer_info)
 *   • Live `renderer.info` — draw calls, triangles, geometries, textures, programs
 *   • FPS sampled at 250ms cadence
 *   • Cumulative context-loss / restored counters
 *   • Rolling event log (last 12 events)
 *
 * Strictly gated by `import.meta.env.DEV` AND a parent-controlled visibility
 * flag — never shown to operators in production.
 *
 * Read-only. No actions, no side effects on the renderer itself.
 */
import { useEffect, useState } from 'react';
import { Activity, Cpu, Trash2 } from 'lucide-react';
import { getActiveRenderer, subscribeActiveRenderer } from '@/lib/activeRendererRegistry';
import {
  getWebglEvents,
  getWebglEventCounters,
  subscribeWebglEvents,
  clearWebglEvents,
  type WebglEvent,
} from '@/lib/webglEventLog';
import { getCrashRecord } from '@/lib/hardening/runtimeSafety';

interface RendererSnapshot {
  vendor: string;
  renderer: string;
  glVersion: string;
  shadingLang: string;
  maxTextureSize: number;
  drawingBufferW: number;
  drawingBufferH: number;
  pixelRatio: number;
}

interface FrameStats {
  fps: number;
  calls: number;
  triangles: number;
  geometries: number;
  textures: number;
  programs: number;
  contextLost: boolean;
}

const EMPTY_STATS: FrameStats = {
  fps: 0, calls: 0, triangles: 0, geometries: 0, textures: 0, programs: 0, contextLost: false,
};

function readSnapshot(): RendererSnapshot | null {
  const gl = getActiveRenderer();
  if (!gl) return null;
  try {
    const ctx = gl.getContext();
    if (!ctx) return null;
    const dbg = ctx.getExtension('WEBGL_debug_renderer_info');
    const vendor = dbg ? String(ctx.getParameter(dbg.UNMASKED_VENDOR_WEBGL)) : String(ctx.getParameter(ctx.VENDOR));
    const renderer = dbg ? String(ctx.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : String(ctx.getParameter(ctx.RENDERER));
    return {
      vendor,
      renderer,
      glVersion: String(ctx.getParameter(ctx.VERSION)),
      shadingLang: String(ctx.getParameter(ctx.SHADING_LANGUAGE_VERSION)),
      maxTextureSize: Number(ctx.getParameter(ctx.MAX_TEXTURE_SIZE) ?? 0),
      drawingBufferW: ctx.drawingBufferWidth,
      drawingBufferH: ctx.drawingBufferHeight,
      pixelRatio: gl.getPixelRatio(),
    };
  } catch {
    return null;
  }
}

function fmtTime(ts: number) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}.${String(d.getMilliseconds()).padStart(3, '0')}`;
}

function eventColor(kind: WebglEvent['kind']): string {
  switch (kind) {
    case 'lost': return 'text-red-400';
    case 'restored': return 'text-green-400';
    case 'remount-attempt': return 'text-amber-300';
    case 'recovered': return 'text-cyan-300';
    default: return 'text-muted-foreground';
  }
}

export default function GpuRendererDiagnosticsPanel() {
  const [snapshot, setSnapshot] = useState<RendererSnapshot | null>(() => readSnapshot());
  const [stats, setStats] = useState<FrameStats>(EMPTY_STATS);
  const [events, setEvents] = useState<readonly WebglEvent[]>(() => getWebglEvents());
  const [counters, setCounters] = useState(() => getWebglEventCounters());

  // Re-snapshot whenever the active renderer instance changes (e.g. after a
  // post-context-loss remount).
  useEffect(() => {
    const refresh = () => setSnapshot(readSnapshot());
    refresh();
    return subscribeActiveRenderer(refresh);
  }, []);

  // Subscribe to context-loss event log.
  useEffect(() => {
    const refresh = () => {
      setEvents([...getWebglEvents()]);
      setCounters(getWebglEventCounters());
    };
    return subscribeWebglEvents(refresh);
  }, []);

  // Poll renderer.info @ 4Hz — cheap, no GPU work, just reads counters.
  useEffect(() => {
    let frames = 0;
    let lastFpsTs = performance.now();
    let raf = 0;
    const tick = () => {
      frames++;
      const now = performance.now();
      if (now - lastFpsTs >= 250) {
        const gl = getActiveRenderer();
        const info = gl?.info;
        const ctx = gl?.getContext();
        const fps = Math.round((frames * 1000) / (now - lastFpsTs));
        setStats({
          fps,
          calls: info?.render.calls ?? 0,
          triangles: info?.render.triangles ?? 0,
          geometries: info?.memory.geometries ?? 0,
          textures: info?.memory.textures ?? 0,
          programs: info?.programs?.length ?? 0,
          contextLost: !!ctx?.isContextLost?.(),
        });
        frames = 0;
        lastFpsTs = now;
      }
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, []);

  const crash = getCrashRecord();
  const recentEvents = events.slice(-12).reverse();

  return (
    <div
      className="pointer-events-auto fixed right-4 bottom-4 z-50 w-[340px] rounded-lg border border-border/40 bg-background/95 p-3 font-mono text-[10px] text-foreground shadow-2xl shadow-background/60 backdrop-blur-md"
      data-testid="gpu-renderer-diagnostics-panel"
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
          <Cpu className="h-3 w-3" />
          GPU · Renderer Diagnostics
        </div>
        <button
          type="button"
          onClick={clearWebglEvents}
          className="flex items-center gap-1 rounded border border-border/40 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="Clear event log (counters preserved)"
        >
          <Trash2 className="h-2.5 w-2.5" />
          Clear
        </button>
      </div>

      {/* ─── Renderer identity ─────────────────────── */}
      <div className="mb-2 space-y-0.5 border-b border-border/30 pb-2">
        {snapshot ? (
          <>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">GPU</span>
              <span className="truncate text-right" title={snapshot.renderer}>{snapshot.renderer}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Vendor</span>
              <span className="truncate text-right" title={snapshot.vendor}>{snapshot.vendor}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">GL</span>
              <span className="truncate text-right">{snapshot.glVersion}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Buffer</span>
              <span>
                {snapshot.drawingBufferW}×{snapshot.drawingBufferH} @ {snapshot.pixelRatio.toFixed(2)}x
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">MaxTex</span>
              <span>{snapshot.maxTextureSize}</span>
            </div>
          </>
        ) : (
          <div className="text-muted-foreground">No active renderer.</div>
        )}
      </div>

      {/* ─── Live frame stats ──────────────────────── */}
      <div className="mb-2 grid grid-cols-3 gap-1.5 border-b border-border/30 pb-2">
        <Stat label="FPS" value={stats.fps} accent={stats.fps >= 55 ? 'green' : stats.fps >= 30 ? 'amber' : 'red'} />
        <Stat label="Calls" value={stats.calls} />
        <Stat label="Tris" value={fmtThousands(stats.triangles)} />
        <Stat label="Geom" value={stats.geometries} />
        <Stat label="Tex" value={stats.textures} />
        <Stat label="Prog" value={stats.programs} />
      </div>

      {/* ─── Context-loss telemetry ────────────────── */}
      <div className="mb-2 space-y-0.5 border-b border-border/30 pb-2">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Activity className="h-3 w-3" />
          Context Events
        </div>
        <div className="grid grid-cols-4 gap-1 pt-1">
          <Stat label="Lost" value={counters.lost} accent={counters.lost > 0 ? 'red' : undefined} compact />
          <Stat label="Restd" value={counters.restored} accent={counters.restored > 0 ? 'green' : undefined} compact />
          <Stat label="Remnt" value={counters.remountAttempts} accent={counters.remountAttempts > 0 ? 'amber' : undefined} compact />
          <Stat label="Total" value={crash.totalCrashes} compact />
        </div>
        {stats.contextLost && (
          <div className="mt-1 rounded bg-red-500/15 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-red-300">
            ⚠ Context currently LOST
          </div>
        )}
        {crash.inCooldown && (
          <div className="mt-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-amber-300">
            Cooldown until {fmtTime(crash.cooldownUntil)}
          </div>
        )}
      </div>

      {/* ─── Event log ─────────────────────────────── */}
      <div>
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Event Log ({events.length})
        </div>
        <div className="max-h-[140px] overflow-auto rounded border border-border/30 bg-muted/30 p-1">
          {recentEvents.length === 0 ? (
            <div className="px-1 py-0.5 text-muted-foreground/70">&gt; No WebGL context events yet.</div>
          ) : (
            recentEvents.map(evt => (
              <div key={evt.id} className="flex gap-1.5 px-1 py-0.5">
                <span className="text-muted-foreground/60">{fmtTime(evt.ts)}</span>
                <span className={`font-semibold uppercase ${eventColor(evt.kind)}`}>
                  {evt.kind}
                </span>
                {evt.detail && <span className="truncate text-muted-foreground" title={evt.detail}>{evt.detail}</span>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  compact,
}: {
  label: string;
  value: number | string;
  accent?: 'green' | 'amber' | 'red';
  compact?: boolean;
}) {
  const tone =
    accent === 'green' ? 'text-green-400' :
    accent === 'amber' ? 'text-amber-300' :
    accent === 'red' ? 'text-red-400' : 'text-foreground';
  return (
    <div className="rounded border border-border/30 bg-muted/20 px-1.5 py-1">
      <div className="text-[8.5px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`${compact ? 'text-[11px]' : 'text-[12px]'} font-semibold ${tone}`}>{value}</div>
    </div>
  );
}

function fmtThousands(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}
