/**
 * /skycanvas — SkyCanvas v3 surface (Apple-glass · floating dock).
 *
 * Plane: Show / Experience (mem://arquitetura/v6-quatro-planos).
 * Zero CommandBus / FieldBus / SafetyStateMachine / workMode.
 * Real operation lives on /command via uiCommandGateway.
 *
 * Surface contract:
 *   - Edge-to-edge WebGL2 viewport (or 2D fallback)
 *   - 3 floating glass panels: Library · Inspector · Timeline
 *   - GlassTopbar with central Master Menu pill (⌘K / ⌘M)
 *   - SIM · ADVISORY badge always visible
 *   - E-STOP cosmetic — links to /command (no local dispatch)
 *
 * Persistence: layout in fxk.skycanvas.dock.v2 (silent v1 migration).
 * Guard test: src/__tests__/skycanvas.safetyImports.guard.spec.ts
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play, Pause, Square, SkipBack, SkipForward,
  Music, Command as CommandIcon, OctagonAlert,
} from 'lucide-react';
import { toast } from 'sonner';

import { lazyRetry } from '@/lib/lazyRetry';
import StudioErrorBoundary from '@/components/errors/StudioErrorBoundary';
import { Badge } from '@/components/ui/badge';

import { useProjectStore } from '@/store/useProjectStore';
import { EFFECT_LIBRARY } from '@/data/effectLibrary';
import { detectSkyCapability, profileBudget, type SkyCapability } from '@/lib/skycanvasCapability';
import { FXK_EFFECT_DRAG_TYPE } from '@/components/editor/EffectLibrarySidebar';
import SkyFallback2D from '@/components/skycanvas/SkyFallback2D';
import WaveformLayer from '@/components/skycanvas/WaveformLayer';
import { decodeAudioPeaks } from '@/lib/skycanvasAudioPeaks';
import { FloatingPanel } from '@/components/skycanvas/FloatingPanel';
import { dockStore, useFloatingDock } from '@/hooks/useFloatingDock';
import { useSmallViewport } from '@/hooks/useSmallViewport';
import { buildSkyActions } from '@/components/skycanvas/skyActions';
import TabbedDockPanel from '@/components/skycanvas/TabbedDockPanel';
import MobilePanelSwitcher from '@/components/skycanvas/MobilePanelSwitcher';
import { TimelineCuesProvider } from '@/components/skycanvas/tabs/TimelineCuesTab';
import { useActiveDemoSession } from '@/hooks/useActiveDemoSession';
import { ClaimBadge } from '@/components/strategy/ClaimBadge';
import { useWorkMode } from '@/core/safety/workMode';
import { useSkyCanvasShowPersistence, clearPersistedSkyCanvasShow } from '@/hooks/useSkyCanvasShowPersistence';
import { cn } from '@/lib/utils';

const SkyCanvas2 = lazy(lazyRetry(() => import('@/components/show3d/v2/SkyCanvas2')));
const SkyCanvasCommandPalette = lazy(() => import('@/components/skycanvas/SkyCanvasCommandPalette'));
const CatalogImportDialog = lazy(() => import('@/components/editor/CatalogImportDialog'));

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

function fmtTime(s: number) {
  const sign = s < 0 ? '-' : '';
  const a = Math.abs(s);
  const mm = Math.floor(a / 60).toString().padStart(2, '0');
  const ss = Math.floor(a % 60).toString().padStart(2, '0');
  const ff = Math.floor((a % 1) * 30).toString().padStart(2, '0');
  return `${sign}${mm}:${ss}:${ff}`;
}

function GlassIconButton({
  onClick, label, children, className, danger, title,
}: {
  onClick: () => void; label: string; children: React.ReactNode;
  className?: string; danger?: boolean; title?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title ?? label}
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center h-8 w-8 rounded-full',
        'text-zinc-300 hover:text-cyan-200 hover:bg-white/[0.06] transition-colors duration-200',
        'ds-focus',
        danger && 'hover:text-rose-300 hover:bg-rose-500/10',
        className,
      )}
    >
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Topbar (glass) + Master Menu pill + transport
// ─────────────────────────────────────────────────────────────────────

function GlassTopbar({
  cap, playing, onTogglePlay, onStop, onSeek, time, duration,
  onPickAudio, audioName, onOpenMaster, onEStop,
  workModeLabel, sessionMeta,
}: {
  cap: SkyCapability;
  playing: boolean;
  onTogglePlay: () => void;
  onStop: () => void;
  onSeek: (delta: number) => void;
  time: number;
  duration: number;
  onPickAudio: (file: File) => void;
  audioName: string | null;
  onOpenMaster: () => void;
  onEStop: () => void;
  workModeLabel: string;
  sessionMeta: { id: string; clientName?: string; claim?: 'validated' | 'pilot' | 'marketing_hypothesis' } | null;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Intent-based prefetch: hovering Master Menu warms the chunk.
  const prefetchMaster = useCallback(() => {
    void import('@/components/skycanvas/SkyCanvasCommandPalette');
  }, []);

  return (
    <header
      className={cn(
        'glass-pane glass-pane-strong absolute top-3 left-3 right-3 z-50',
        'h-14 rounded-2xl px-3 flex items-center gap-3',
      )}
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      {/* Brand + status */}
      <div className="ds-mono text-[12px] tracking-wider text-cyan-300/90 hidden sm:block">
        FXKONTROL · SKYCANVAS
      </div>
      <Badge variant="outline" className="border-cyan-500/30 text-cyan-300 ds-mono text-[10px]">
        SIM · ADVISORY
      </Badge>
      <Badge variant="outline" className="border-white/20 text-zinc-300 ds-mono text-[10px] hidden md:inline-flex"
             title="WorkMode atual (real_operation só via /command)">
        {workModeLabel}
      </Badge>
      {sessionMeta && (
        <Badge variant="outline" className="border-amber-500/30 text-amber-200 ds-mono text-[10px] hidden lg:inline-flex"
               title={`Strategic Hub · sessão ativa ${sessionMeta.id}`}>
          ★ {sessionMeta.clientName ?? sessionMeta.id.slice(0, 6)}
        </Badge>
      )}
      <Badge
        variant="outline"
        className={cn('ds-mono text-[10px] hidden md:inline-flex',
          cap.renderer === 'webgl2' ? 'border-emerald-500/40 text-emerald-300'
            : 'border-amber-500/40 text-amber-300')}
        title={cap.reasons.join(' · ') || 'webgl2 ok'}
      >
        {cap.renderer === 'webgl2' ? `WEBGL2 · ${cap.tier.toUpperCase()}` : '2D FALLBACK'}
      </Badge>

      <div className="flex-1" />

      {/* Master Menu pill — center */}
      <button
        type="button"
        onClick={onOpenMaster}
        onMouseEnter={prefetchMaster}
        onFocus={prefetchMaster}
        className={cn(
          'glass-pane glass-pill',
          'inline-flex items-center gap-2 h-9 px-4',
          'text-[12px] ds-mono uppercase tracking-wider text-cyan-200/90',
          'hover:text-cyan-100 transition-colors duration-200 ds-focus',
        )}
        title="Master Menu (⌘K / ⌘M)"
        aria-haspopup="dialog"
      >
        <CommandIcon className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Master Menu</span>
        <kbd className="ds-mono text-[10px] text-cyan-300/50 hidden md:inline">⌘K</kbd>
      </button>

      <div className="flex-1" />

      {/* Audio picker */}
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className={cn(
          'inline-flex items-center gap-1 h-8 px-3 rounded-full',
          'ds-mono text-[11px] text-zinc-300 hover:text-cyan-200',
          'hover:bg-white/[0.06] transition-colors duration-200 ds-focus',
        )}
        title={audioName ?? 'Carregar trilha de áudio'}
      >
        <Music className="h-3.5 w-3.5" />
        <span className="hidden lg:inline truncate max-w-[140px]">{audioName ?? 'Áudio'}</span>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPickAudio(f);
          e.target.value = '';
        }}
      />

      {/* Transport — visible ≥900px; mobile uses FAB below */}
      <div className="hidden md:flex items-center gap-1">
        <GlassIconButton onClick={() => onSeek(-5)} label="Voltar 5s"><SkipBack className="h-4 w-4" /></GlassIconButton>
        <button
          type="button"
          onClick={onTogglePlay}
          aria-label={playing ? 'Pausar' : 'Tocar'}
          aria-keyshortcuts="Space"
          className={cn(
            'inline-flex h-9 w-9 items-center justify-center rounded-full border ds-focus transition-all duration-200',
            playing
              ? 'bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 border-amber-500/40'
              : 'bg-cyan-500/20 text-cyan-100 hover:bg-cyan-500/30 border-cyan-500/40',
          )}
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <GlassIconButton onClick={onStop} label="Parar" danger><Square className="h-4 w-4" /></GlassIconButton>
        <GlassIconButton onClick={() => onSeek(5)} label="Avançar 5s"><SkipForward className="h-4 w-4" /></GlassIconButton>
      </div>

      {/* Timecode */}
      <div className="ds-mono text-[12px] text-cyan-300 tabular-nums px-3 py-1 rounded-md border border-white/[0.06] bg-black/20 hidden md:block">
        {fmtTime(time)} / {fmtTime(duration)}
      </div>

      {/* E-STOP cosmético — redireciona /command */}
      <button
        type="button"
        onClick={onEStop}
        title="Operação real → Centro de Comando"
        className={cn(
          'inline-flex items-center gap-1 h-8 px-3 rounded-full ds-mono text-[10px] uppercase tracking-wider',
          'border border-rose-500/40 text-rose-300 hover:bg-rose-500/10 transition-colors duration-200 ds-focus',
        )}
      >
        <OctagonAlert className="h-3.5 w-3.5" />
        <span className="hidden lg:inline">E-STOP</span>
      </button>
    </header>
  );
}

// Mobile transport FAB (visible <md). Always reachable so operator
// never loses play control on phones.
function MobileTransportFab({
  playing, onTogglePlay, onSeek, time, duration,
}: {
  playing: boolean;
  onTogglePlay: () => void;
  onSeek: (d: number) => void;
  time: number;
  duration: number;
}) {
  return (
    <div className="md:hidden absolute bottom-3 left-1/2 -translate-x-1/2 z-50">
      <div className="glass-pane glass-pill h-14 px-4 flex items-center gap-3"
           style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <GlassIconButton onClick={() => onSeek(-5)} label="Voltar 5s"><SkipBack className="h-5 w-5" /></GlassIconButton>
        <button
          type="button"
          onClick={onTogglePlay}
          aria-label={playing ? 'Pausar' : 'Tocar'}
          className={cn(
            'inline-flex h-12 w-12 items-center justify-center rounded-full border ds-focus',
            playing ? 'bg-amber-500/20 text-amber-200 border-amber-500/40'
                    : 'bg-cyan-500/20 text-cyan-100 border-cyan-500/40',
          )}
        >
          {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </button>
        <GlassIconButton onClick={() => onSeek(5)} label="Avançar 5s"><SkipForward className="h-5 w-5" /></GlassIconButton>
        <span className="ds-mono text-[11px] text-cyan-300 tabular-nums hidden xs:inline">
          {fmtTime(time)}
        </span>
        <span className="sr-only">{fmtTime(time)} de {fmtTime(duration)}</span>
      </div>
    </div>
  );
}

// Dead code removed: Inspector / Row / TimelineStrip now live as lazy tabs
// (see src/components/skycanvas/tabs/* and TabbedDockPanel).

// ─────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────

export default function SkyCanvasPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'SkyCanvas — FX KONTROL';
    try { (window as Window & { __splashDone?: () => void }).__splashDone?.(); } catch { /* */ }
    document.getElementById('splash')?.remove();
    return () => { document.title = prevTitle; };
  }, []);

  const cap = useMemo(() => detectSkyCapability(), []);
  const workMode = useWorkMode();
  const workModeLabel = workMode === 'design' ? 'DESIGN' : workMode === 'simulation' ? 'SIM' : 'REAL OP';
  const session = useActiveDemoSession();

  // Transport
  const playing = useProjectStore((s) => s.isPlaying);
  const time = useProjectStore((s) => s.currentTime);
  const duration = useProjectStore((s) => s.duration) || 60;
  const setPlaying = useProjectStore((s) => s.setPlaying);
  const setCurrentTime = useProjectStore((s) => s.setCurrentTime);
  const setDuration = useProjectStore((s) => s.setDuration);

  // RAF playback
  useEffect(() => {
    if (!playing) return;
    let raf = 0; let last = performance.now();
    const tick = () => {
      const now = performance.now();
      const dt = (now - last) / 1000; last = now;
      const next = useProjectStore.getState().currentTime + dt;
      if (next >= duration) { setCurrentTime(0); setPlaying(false); return; }
      setCurrentTime(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, duration, setCurrentTime, setPlaying]);

  const togglePlay = useCallback(() => setPlaying(!useProjectStore.getState().isPlaying), [setPlaying]);
  const stop = useCallback(() => { setPlaying(false); setCurrentTime(0); }, [setPlaying, setCurrentTime]);
  const seek = useCallback((delta: number) => {
    const t = useProjectStore.getState().currentTime;
    setCurrentTime(Math.max(0, Math.min(duration, t + delta)));
  }, [duration, setCurrentTime]);
  const seekAbs = useCallback((t: number) => setCurrentTime(t), [setCurrentTime]);

  // Master Menu palette
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [cinema, setCinema] = useState(false);

  const focusPanel = useCallback((id: 'library' | 'inspector' | 'timeline') => {
    const cur = dockStore.get().panels[id];
    if (cur?.collapsed) dockStore.toggleCollapsed(id);
    // Defer focus to next paint when panel re-renders
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(`[data-panel-id="${id}"]`);
      el?.focus();
    });
  }, []);

  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const pickAudio = useCallback(() => audioInputRef.current?.click(), []);

  // Audio decoding
  const [peaks, setPeaks] = useState<Float32Array | null>(null);
  const [audioName, setAudioName] = useState<string | null>(null);
  const [decoding, setDecoding] = useState(false);
  const onPickAudio = async (file: File) => {
    if (decoding) return;
    setDecoding(true);
    const tid = toast.loading(`Decodificando ${file.name}…`);
    try {
      const result = await decodeAudioPeaks(file, 1024);
      setPeaks(result.peaks);
      setAudioName(file.name);
      setDuration(result.durationSec);
      setCurrentTime(0);
      setPlaying(false);
      toast.success(`Áudio carregado · ${result.durationSec.toFixed(1)}s · ${result.sampleRate} Hz`, { id: tid });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao decodificar áudio', { id: tid });
    } finally { setDecoding(false); }
  };

  // Cue drop handlers
  const dropEffectAt = useCallback((effectId: string, t: number) => {
    const fx = EFFECT_LIBRARY.find((e) => e.id === effectId);
    if (!fx) return;
    useProjectStore.getState().addCueMarker({
      id: `cue-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      time: Math.max(0, Math.min(duration, t)),
      label: `${fx.icon} ${fx.name}`,
      color: fx.color,
    });
  }, [duration]);
  const dropEffectAtPlayhead = useCallback((effectId: string) => {
    dropEffectAt(effectId, useProjectStore.getState().currentTime);
  }, [dropEffectAt]);

  // Master Menu actions
  const [importOpen, setImportOpen] = useState(false);

  // Local persistence (cues + duration + audio name) — no playback, no buffer.
  useSkyCanvasShowPersistence({ audioName });

  const exportShowJson = useCallback(() => {
    try {
      const cues = useProjectStore.getState().cueMarkers;
      const blob = new Blob([JSON.stringify({
        kind: 'fxk.skycanvas.showbundle.v1',
        exportedAt: new Date().toISOString(),
        duration,
        cues,
      }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `skycanvas-show-${Date.now()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(`Exportado · ${cues.length} cue${cues.length === 1 ? '' : 's'}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao exportar');
    }
  }, [duration]);

  const resetShow = useCallback(() => {
    if (typeof window === 'undefined') return;
    const ok = window.confirm('Apagar todos os cues e limpar show salvo? Esta ação não pode ser desfeita.');
    if (!ok) return;
    useProjectStore.getState().clearCueMarkers();
    clearPersistedSkyCanvasShow();
    toast.success('Show restaurado');
  }, []);

  const actions = useMemo(() => buildSkyActions({
    togglePlay, stop, seekTo: seekAbs, pickAudio,
    focusPanel,
    toggleCinema: () => {
      const next = !cinema;
      setCinema(next);
      dockStore.setAllCollapsed(next);
    },
    resetDock: () => { dockStore.reset(); toast.success('Layout restaurado'); },
    goCommand: () => navigate('/command'),
    goAiBuilder: () => navigate('/ai-builder'),
    goStrategy: () => navigate('/strategy'),
    openImportVdl: () => setImportOpen(true),
    exportShowJson,
    resetShow,
  }), [togglePlay, stop, seekAbs, pickAudio, focusPanel, cinema, navigate, exportShowJson, resetShow, audioName]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const inField = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      const ctrl = e.metaKey || e.ctrlKey;

      // Master menu (toggle)
      if (ctrl && (e.key.toLowerCase() === 'k' || e.key.toLowerCase() === 'm')) {
        e.preventDefault(); setPaletteOpen((o) => !o); return;
      }
      // Panel focus (only outside form fields)
      if (!inField && ctrl && (e.key === '1' || e.key === '2' || e.key === '3')) {
        e.preventDefault();
        focusPanel(e.key === '1' ? 'library' : e.key === '2' ? 'inspector' : 'timeline');
        return;
      }
      // Cinema
      if (!inField && ctrl && e.key === '\\') {
        e.preventDefault();
        const next = !cinema;
        setCinema(next);
        dockStore.setAllCollapsed(next);
        return;
      }
      // Reset dock (Shift+Cmd+0 — destrutivo, exige Shift)
      if (!inField && ctrl && e.shiftKey && e.key === '0') {
        e.preventDefault();
        dockStore.reset();
        toast.success('Layout restaurado');
        return;
      }
      if (inField) return;
      if (e.code === 'Space') { e.preventDefault(); setPlaying(!useProjectStore.getState().isPlaying); }
      else if (e.key === 'ArrowLeft')  { setCurrentTime(Math.max(0, useProjectStore.getState().currentTime - (e.shiftKey ? 1 : 1 / 30))); }
      else if (e.key === 'ArrowRight') { setCurrentTime(Math.min(duration, useProjectStore.getState().currentTime + (e.shiftKey ? 1 : 1 / 30))); }
      else if (e.key === 'Home') { setCurrentTime(0); }
      else if (e.key === 'End')  { setCurrentTime(duration); }
      else if (e.key === 'Escape' && cinema) { setCinema(false); dockStore.setAllCollapsed(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [duration, setPlaying, setCurrentTime, focusPanel, cinema]);

  // Floating dock state
  const dock = useFloatingDock();
  const isMobile = useSmallViewport(900);

  // On mobile, only ONE expanded sheet at a time — others auto-collapse.
  const [mobileActive, setMobileActive] = useState<'library' | 'inspector' | 'timeline'>('library');
  useEffect(() => {
    if (!isMobile) return;
    (['library', 'inspector', 'timeline'] as const).forEach((key) => {
      const cur = dock.panels[key];
      const shouldCollapse = key !== mobileActive;
      if (cur && cur.collapsed !== shouldCollapse) {
        dockStore.updatePanel(key, { collapsed: shouldCollapse });
      }
    });
  }, [isMobile, mobileActive, dock.panels]);

  // Detect user un-collapsing a sheet on mobile → make it the active one.
  useEffect(() => {
    if (!isMobile) return;
    (['library', 'inspector', 'timeline'] as const).forEach((key) => {
      if (dock.panels[key] && !dock.panels[key].collapsed && key !== mobileActive) {
        setMobileActive(key);
      }
    });
  }, [isMobile, dock.panels, mobileActive]);

  return (
    <div
      className="relative h-[100dvh] w-full bg-[#050810] text-zinc-200 overflow-hidden"
      data-theme="dark"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Skip-link for keyboard users */}
      <a
        href="#viewport"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[80] focus:px-3 focus:py-2 focus:rounded-md focus:bg-cyan-500/20 focus:text-cyan-100 focus:ds-focus"
      >
        Pular para viewport
      </a>

      {/* Hidden global audio input (picked from palette) */}
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]; if (f) onPickAudio(f);
          e.target.value = '';
        }}
      />

      {/* VIEWPORT — edge-to-edge */}
      <StudioErrorBoundary area="SkyCanvas · Viewport">
        <div
          id="viewport"
          tabIndex={-1}
          data-fxk-viewport
          className="absolute inset-0 z-0"
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes(FXK_EFFECT_DRAG_TYPE)) {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
            }
          }}
          onDrop={(e) => {
            const id = e.dataTransfer.getData(FXK_EFFECT_DRAG_TYPE);
            if (id) { e.preventDefault(); dropEffectAtPlayhead(id); }
          }}
        >
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

      {/* TOPBAR (glass) */}
      <GlassTopbar
        cap={cap}
        playing={playing}
        onTogglePlay={togglePlay}
        onStop={stop}
        onSeek={seek}
        time={time}
        duration={duration}
        onPickAudio={onPickAudio}
        audioName={audioName}
        onOpenMaster={() => setPaletteOpen(true)}
        onEStop={() => navigate('/command')}
        workModeLabel={workModeLabel}
        sessionMeta={session}
      />

      {/* FLOATING PANELS */}
      <div data-panel-id="library">
        <StudioErrorBoundary area="SkyCanvas · Library">
          <FloatingPanel id="library" title="Biblioteca" state={dock.panels.library}>
            <TabbedDockPanel
              defaultValue="effects"
              tabs={[
                { value: 'effects',   label: 'Efeitos',  load: () => import('@/components/skycanvas/tabs/LibraryEffectsTab') },
                { value: 'fixtures',  label: 'Fixtures', load: () => import('@/components/skycanvas/tabs/LibraryFixturesTab') },
                { value: 'templates', label: 'Templates',load: () => import('@/components/skycanvas/tabs/LibraryTemplatesTab') },
                { value: 'geo',       label: 'Local',    load: () => import('@/components/skycanvas/tabs/LibraryGeoTab') },
              ]}
            />
          </FloatingPanel>
        </StudioErrorBoundary>
      </div>

      <div data-panel-id="inspector">
        <StudioErrorBoundary area="SkyCanvas · Inspector">
          <FloatingPanel id="inspector" title="Inspector" state={dock.panels.inspector}>
            <TabbedDockPanel
              defaultValue="cue"
              dense
              tabs={[
                { value: 'cue',      label: 'Cue',      load: () => import('@/components/skycanvas/tabs/InspectorCueTab') },
                { value: 'scene',    label: 'Cena',     load: () => import('@/components/skycanvas/tabs/InspectorSceneTab') },
                { value: 'render',   label: 'Render',   load: () => import('@/components/skycanvas/tabs/InspectorRenderTab') },
                { value: 'hardware', label: 'Hardware', load: () => import('@/components/skycanvas/tabs/HardwareObserverTab') },
                { value: 'strategy', label: 'Strategy', load: () => import('@/components/skycanvas/tabs/StrategyContextTab') },
              ]}
            />
          </FloatingPanel>
        </StudioErrorBoundary>
      </div>

      <div data-panel-id="timeline">
        <StudioErrorBoundary area="SkyCanvas · Timeline">
          <FloatingPanel id="timeline" title="Timeline" state={dock.panels.timeline} bottomStrip>
            <TimelineCuesProvider value={{ time, duration, onSeekAbs: seekAbs, onDropEffect: dropEffectAt, peaks }}>
              <TabbedDockPanel
                defaultValue="cues"
                dense
                tabs={[
                  { value: 'cues',       label: 'Cues',       load: () => import('@/components/skycanvas/tabs/TimelineCuesTab') },
                  { value: 'smpte',      label: 'SMPTE',      load: () => import('@/components/skycanvas/tabs/TimelineSmpteTab') },
                  { value: 'validation', label: 'Validation', load: () => import('@/components/skycanvas/tabs/TimelineValidationTab') },
                ]}
              />
            </TimelineCuesProvider>
          </FloatingPanel>
        </StudioErrorBoundary>
      </div>

      {/* IMPORT VDL/CSV DIALOG (Master Menu → Project) */}
      <Suspense fallback={null}>
        {importOpen && (
          <CatalogImportDialog open={importOpen} onOpenChange={setImportOpen} />
        )}
      </Suspense>

      {/* MOBILE TRANSPORT + PANEL SWITCHER */}
      <MobileTransportFab
        playing={playing}
        onTogglePlay={togglePlay}
        onSeek={seek}
        time={time}
        duration={duration}
      />
      <MobilePanelSwitcher active={mobileActive} onChange={setMobileActive} />

      {/* MASTER MENU PALETTE */}
      <Suspense fallback={null}>
        {paletteOpen && (
          <SkyCanvasCommandPalette
            open={paletteOpen}
            onOpenChange={setPaletteOpen}
            actions={actions}
          />
        )}
      </Suspense>
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
