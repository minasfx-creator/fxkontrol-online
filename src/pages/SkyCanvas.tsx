/**
 * /skycanvas — SkyCanvas v3 surface.
 *
 * Boot enxuto: NÃO importa Index.tsx, NÃO importa EngineProvider, NÃO depende
 * do shell pesado do Studio. Capability-driven: WebGL2 → SkyCanvas2;
 * sem WebGL/SwiftShader → SkyFallback2D.
 *
 * Plano: Show/Experience plane. Zero CommandBus / FieldBus / SafetyStateMachine
 * / workMode. Operação real continua via /command + uiCommandGateway.
 */
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  Play, Pause, Square, SkipBack, SkipForward,
  Camera, Sun, Activity, ChevronsLeft, ChevronsRight,
} from 'lucide-react';

import { lazyRetry } from '@/lib/lazyRetry';
import { EditorShell } from '@/components/ds/EditorShell';
import StudioErrorBoundary from '@/components/errors/StudioErrorBoundary';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';

import { useProjectStore } from '@/store/useProjectStore';
import { EFFECT_LIBRARY } from '@/data/effectLibrary';
import { detectSkyCapability, profileBudget, type SkyCapability } from '@/lib/skycanvasCapability';
import EffectLibrarySidebar, { FXK_EFFECT_DRAG_TYPE } from '@/components/editor/EffectLibrarySidebar';
import SkyFallback2D from '@/components/skycanvas/SkyFallback2D';

// SkyCanvas2 é nossa engine canônica para esta surface — modular, instanced,
// com WebGLContextRecovery + AdaptiveDPRController + SkyCanvas2ErrorBoundary.
const SkyCanvas2 = lazy(lazyRetry(() => import('@/components/show3d/v2/SkyCanvas2')));

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

function fmtTime(s: number) {
  const sign = s < 0 ? '-' : '';
  const a = Math.abs(s);
  const mm = Math.floor(a / 60).toString().padStart(2, '0');
  const ss = Math.floor(a % 60).toString().padStart(2, '0');
  const ff = Math.floor((a % 1) * 30).toString().padStart(2, '0');
  return `${sign}${mm}:${ss}:${ff}`;
}

// ─────────────────────────────────────────────────────────────────────────
// Topbar
// ─────────────────────────────────────────────────────────────────────────

function Topbar({
  cap, playing, onTogglePlay, onStop, onSeek, time, duration,
}: {
  cap: SkyCapability;
  playing: boolean;
  onTogglePlay: () => void;
  onStop: () => void;
  onSeek: (delta: number) => void;
  time: number;
  duration: number;
}) {
  return (
    <header className="flex h-full items-center gap-3 px-3">
      <div className="ds-mono text-[12px] tracking-wider text-cyan-300/90">
        FXKONTROL · SKYCANVAS
      </div>
      <Badge variant="outline" className="border-cyan-500/30 text-cyan-300 ds-mono text-[10px]">
        SIM · ADVISORY
      </Badge>
      <Badge
        variant="outline"
        className={cap.renderer === 'webgl2'
          ? 'border-emerald-500/40 text-emerald-300 ds-mono text-[10px]'
          : 'border-amber-500/40 text-amber-300 ds-mono text-[10px]'}
        title={cap.reasons.join(' · ') || 'webgl2 ok'}
      >
        {cap.renderer === 'webgl2' ? `WEBGL2 · ${cap.tier.toUpperCase()}` : '2D FALLBACK'}
      </Badge>
      <div className="flex-1" />

      <div className="flex items-center gap-1">
        <Button size="icon" variant="ghost" className="h-8 w-8 text-zinc-300 hover:text-cyan-200 hover:bg-cyan-500/10" onClick={() => onSeek(-5)} aria-label="Voltar 5 segundos">
          <SkipBack className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          className={`h-9 w-9 rounded-full border ${playing
            ? 'bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 border-amber-500/40'
            : 'bg-cyan-500/20 text-cyan-200 hover:bg-cyan-500/30 border-cyan-500/40'}`}
          onClick={onTogglePlay}
          aria-label={playing ? 'Pausar' : 'Tocar'}
          aria-keyshortcuts="Space"
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8 text-zinc-300 hover:text-rose-300 hover:bg-rose-500/10" onClick={onStop} aria-label="Parar">
          <Square className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8 text-zinc-300 hover:text-cyan-200 hover:bg-cyan-500/10" onClick={() => onSeek(5)} aria-label="Avançar 5 segundos">
          <SkipForward className="h-4 w-4" />
        </Button>
      </div>

      <div className="ds-mono text-[12px] text-cyan-300 tabular-nums w-[150px] text-center px-2 py-1 rounded border border-cyan-500/20 bg-[#0c1322]" aria-live="off">
        {fmtTime(time)} / {fmtTime(duration)}
      </div>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Inspector (right rail)
// ─────────────────────────────────────────────────────────────────────────

function Inspector({ cap }: { cap: SkyCapability }) {
  const [exposure, setExposure] = useState([60]);
  const [intensity, setIntensity] = useState([80]);
  const budget = profileBudget(cap);
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 h-12 flex items-center border-b border-cyan-500/10">
        <span className="ds-mono text-[11px] tracking-wider text-cyan-300/80">INSPECTOR</span>
      </div>
      <Tabs defaultValue="cue" className="flex-1 flex flex-col min-h-0">
        <TabsList className="mx-3 mt-3 grid grid-cols-3 bg-[#0c1322] border border-cyan-500/10">
          <TabsTrigger value="cue">Cue</TabsTrigger>
          <TabsTrigger value="scene">Scene</TabsTrigger>
          <TabsTrigger value="render">Render</TabsTrigger>
        </TabsList>
        <ScrollArea className="flex-1 px-4 py-4">
          <TabsContent value="cue" className="space-y-4 mt-0">
            <p className="text-[11px] text-muted-foreground">
              Selecione um cue na timeline ou arraste um efeito da biblioteca para editar.
            </p>
            <div>
              <div className="flex justify-between text-[11px] uppercase tracking-widest text-zinc-500">
                <span>Intensity</span><span className="text-cyan-300">{intensity[0]}%</span>
              </div>
              <Slider value={intensity} onValueChange={setIntensity} max={100} step={1} className="mt-2" />
            </div>
          </TabsContent>
          <TabsContent value="scene" className="space-y-4 mt-0">
            <div>
              <label className="text-[11px] uppercase tracking-widest text-zinc-500 flex items-center gap-1">
                <Sun className="h-3 w-3" /> Exposure
              </label>
              <Slider value={exposure} onValueChange={setExposure} max={100} step={1} className="mt-2" />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-widest text-zinc-500 flex items-center gap-1">
                <Camera className="h-3 w-3" /> FOV
              </label>
              <Slider defaultValue={[55]} min={20} max={120} step={1} className="mt-2" />
            </div>
          </TabsContent>
          <TabsContent value="render" className="space-y-3 mt-0 text-[12px] text-zinc-400">
            <Row k="Renderer" v={cap.renderer} />
            <Row k="Tier" v={cap.tier} />
            <Row k="WebGPU" v={cap.webgpu ? 'yes' : 'no'} />
            <Row k="WebGL2" v={cap.webgl2 ? 'yes' : 'no'} />
            <Row k="Software GPU" v={cap.software ? 'yes' : 'no'} />
            <Row k="DPR clamp" v={`${budget.dpr[0]}–${budget.dpr[1]}`} />
            <Row k="MSAA" v={budget.antialias ? 'on' : 'off'} />
            <Row k="Burst pool" v={String(budget.burstPoolCap)} />
            {cap.reasons.length > 0 && (
              <div className="pt-2 border-t border-cyan-500/10">
                <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Reasons</div>
                <ul className="space-y-0.5">
                  {cap.reasons.map((r) => <li key={r} className="ds-mono text-[10px] text-cyan-300/80">· {r}</li>)}
                </ul>
              </div>
            )}
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-b border-cyan-500/5 py-1 last:border-0">
      <span>{k}</span><span className="ds-mono text-cyan-300">{v}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Timeline strip (lite — Phase 2 will add waveform/Web Worker)
// ─────────────────────────────────────────────────────────────────────────

function TimelineStrip({
  time, duration, onSeekAbs, onDropEffect,
}: {
  time: number;
  duration: number;
  onSeekAbs: (t: number) => void;
  onDropEffect: (effectId: string, t: number) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const cueMarkers = useProjectStore((s) => s.cueMarkers);
  const removeCueMarker = useProjectStore((s) => s.removeCueMarker);

  const xToTime = (clientX: number) => {
    const el = ref.current; if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return Math.max(0, Math.min(duration, ((clientX - rect.left) / rect.width) * duration));
  };
  const onClick = (e: React.MouseEvent<HTMLDivElement>) => onSeekAbs(xToTime(e.clientX));
  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (e.dataTransfer.types.includes(FXK_EFFECT_DRAG_TYPE)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setDragOver(true);
    }
  };
  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    const id = e.dataTransfer.getData(FXK_EFFECT_DRAG_TYPE);
    if (!id) return;
    e.preventDefault();
    setDragOver(false);
    onDropEffect(id, xToTime(e.clientX));
  };

  const pct = duration > 0 ? (time / duration) * 100 : 0;
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-8 items-center justify-between px-3 border-b border-cyan-500/10">
        <span className="ds-mono text-[10px] tracking-wider text-cyan-300/80">TIMELINE · {cueMarkers.length} cue{cueMarkers.length === 1 ? '' : 's'}</span>
        <span className="ds-mono text-[10px] text-zinc-500">FPS 30 · SMPTE 29.97 · arraste efeitos aqui</span>
      </div>
      <div
        ref={ref}
        onClick={onClick}
        onDragOver={onDragOver}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`relative flex-1 cursor-crosshair bg-[#070b14] transition-colors ${dragOver ? 'bg-cyan-500/10 ring-1 ring-inset ring-cyan-400/40' : ''}`}
        role="slider"
        aria-label="Timeline"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(time)}
      >
        {/* Ruler */}
        <div className="absolute inset-x-0 top-0 h-5 border-b border-cyan-500/10 flex">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="flex-1 border-l border-cyan-500/10 ds-mono text-[9px] text-zinc-500 pl-1">
              {fmtTime((duration / 12) * i).slice(0, 5)}
            </div>
          ))}
        </div>
        {/* Cue markers */}
        {cueMarkers.map((c) => {
          const left = duration > 0 ? (c.time / duration) * 100 : 0;
          return (
            <button
              key={c.id}
              onClick={(e) => { e.stopPropagation(); onSeekAbs(c.time); }}
              onDoubleClick={(e) => { e.stopPropagation(); removeCueMarker(c.id); }}
              className="group absolute top-5 bottom-0 w-[3px] -translate-x-1/2 cursor-pointer hover:w-[4px]"
              style={{ left: `${left}%`, background: c.color }}
              title={`${c.label} @ ${fmtTime(c.time)} — duplo clique para remover`}
              aria-label={`Cue ${c.label} aos ${fmtTime(c.time)}`}
            >
              <span
                className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded px-1 py-px text-[9px] ds-mono opacity-0 group-hover:opacity-100 transition"
                style={{ background: c.color, color: '#050810' }}
              >
                {c.label}
              </span>
            </button>
          );
        })}
        {/* Playhead */}
        <div className="pointer-events-none absolute top-0 bottom-0 w-px bg-cyan-300" style={{ left: `${pct}%` }} />
        <div className="pointer-events-none absolute top-0 -translate-x-1/2 size-2 rotate-45 bg-cyan-300" style={{ left: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────

export default function SkyCanvasPage() {
  // SEO + splash dismiss on mount (defense layer 4 — runs as soon as the
  // route's first effect fires, regardless of HTML splash IIFE state).
  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'SkyCanvas — FX KONTROL';
    try { (window as Window & { __splashDone?: () => void }).__splashDone?.(); } catch { /* */ }
    const splash = document.getElementById('splash');
    if (splash) splash.remove();
    return () => { document.title = prevTitle; };
  }, []);

  // Capability detection — runs once, sync, ~5ms.
  const cap = useMemo(() => detectSkyCapability(), []);

  // Local-only transport (no EngineProvider on this surface).
  const playing = useProjectStore((s) => s.isPlaying);
  const time = useProjectStore((s) => s.currentTime);
  const duration = useProjectStore((s) => s.duration) || 60;
  const setPlaying = useProjectStore((s) => s.setPlaying);
  const setCurrentTime = useProjectStore((s) => s.setCurrentTime);

  // RAF loop for playback when transport is active. Self-contained — no
  // dependence on the heavy Studio EngineProvider.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      const next = useProjectStore.getState().currentTime + dt;
      if (next >= duration) {
        setCurrentTime(0);
        setPlaying(false);
        return;
      }
      setCurrentTime(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, duration, setCurrentTime, setPlaying]);

  // Spacebar play/pause (skip when typing in inputs).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.code === 'Space') { e.preventDefault(); setPlaying(!useProjectStore.getState().isPlaying); }
      else if (e.key === 'ArrowLeft') { setCurrentTime(Math.max(0, useProjectStore.getState().currentTime - (e.shiftKey ? 1 : 1 / 30))); }
      else if (e.key === 'ArrowRight') { setCurrentTime(Math.min(duration, useProjectStore.getState().currentTime + (e.shiftKey ? 1 : 1 / 30))); }
      else if (e.key === 'Home') { setCurrentTime(0); }
      else if (e.key === 'End') { setCurrentTime(duration); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [duration, setPlaying, setCurrentTime]);

  // Sidebar collapse state (landscape phone friendly).
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  useEffect(() => {
    if (cap.landscapePhone || cap.portraitPhone) {
      setLeftOpen(false); setRightOpen(false);
    }
  }, [cap.landscapePhone, cap.portraitPhone]);

  const togglePlay = () => setPlaying(!playing);
  const stop = () => { setPlaying(false); setCurrentTime(0); };
  const seek = (delta: number) => setCurrentTime(Math.max(0, Math.min(duration, time + delta)));
  const seekAbs = (t: number) => setCurrentTime(t);

  return (
    <div className="relative h-[100dvh] w-full bg-[#050810] text-zinc-200 overflow-hidden"
         style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {/* Sticky rail toggles for narrow viewports */}
      <button
        onClick={() => setLeftOpen((v) => !v)}
        className="absolute left-2 top-2 z-20 rounded-md border border-cyan-500/20 bg-[#0c1322]/80 p-1.5 text-cyan-300 hover:bg-cyan-500/10 lg:hidden"
        aria-label={leftOpen ? 'Esconder biblioteca' : 'Mostrar biblioteca'}
      >
        {leftOpen ? <ChevronsLeft className="h-4 w-4" /> : <ChevronsRight className="h-4 w-4" />}
      </button>
      <button
        onClick={() => setRightOpen((v) => !v)}
        className="absolute right-2 top-2 z-20 rounded-md border border-cyan-500/20 bg-[#0c1322]/80 p-1.5 text-cyan-300 hover:bg-cyan-500/10 lg:hidden"
        aria-label={rightOpen ? 'Esconder inspector' : 'Mostrar inspector'}
      >
        {rightOpen ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
      </button>

      <EditorShell
        layout={{
          leftWidth: leftOpen ? 280 : 0,
          rightWidth: rightOpen ? 320 : 0,
          timelineHeight: cap.landscapePhone ? 96 : 180,
        }}
        topbar={
          <Topbar cap={cap} playing={playing} onTogglePlay={togglePlay} onStop={stop} onSeek={seek} time={time} duration={duration} />
        }
        left={
          <StudioErrorBoundary area="SkyCanvas · Library">
            <EffectLibrarySidebar />
          </StudioErrorBoundary>
        }
        right={
          <StudioErrorBoundary area="SkyCanvas · Inspector">
            <Inspector cap={cap} />
          </StudioErrorBoundary>
        }
        timeline={
          <StudioErrorBoundary area="SkyCanvas · Timeline">
            <TimelineStrip time={time} duration={duration} onSeekAbs={seekAbs} />
          </StudioErrorBoundary>
        }
      >
        {/* Viewport — capability-driven renderer. */}
        <StudioErrorBoundary area="SkyCanvas · Viewport">
          <div className="relative h-full w-full" data-fxk-effect-drop="viewport">
            {cap.renderer === 'webgl2' ? (
              <Suspense fallback={<ViewportLoader />}>
                <SkyCanvas2
                  hideStage={!profileBudget(cap).showStage}
                  showFixtures={profileBudget(cap).showFixtures}
                  hideStars={!profileBudget(cap).showStars}
                  dpr={profileBudget(cap).dpr}
                />
              </Suspense>
            ) : (
              <SkyFallback2D reason={cap.reasons[0]} />
            )}
          </div>
        </StudioErrorBoundary>
      </EditorShell>
    </div>
  );
}

function ViewportLoader() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[#050810]">
      <div className="text-center">
        <div className="w-7 h-7 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="ds-mono text-[11px] text-cyan-300/80">Booting SkyCanvas viewport…</p>
      </div>
    </div>
  );
}
