/**
 * /skycanvas — SkyCanvas v4 surface (EditorShell DS v1).
 *
 * Plane: Show / Experience (mem://arquitetura/v6-quatro-planos).
 * Zero CommandBus / FieldBus / SafetyStateMachine / workMode.
 * Real operation lives on /command via uiCommandGateway.
 *
 * Surface contract:
 *   - <EditorShell> grid (Topbar 64 · Tabs 48 · Left 280 · Right 320 · Timeline 180 · Viewport fill)
 *   - Glass topbar with Master Menu pill (⌘K / ⌘M)
 *   - SIM · ADVISORY badge always visible
 *   - E-STOP cosmetic — links to /command (no local dispatch)
 *
 * Persistence: layout in fxk:editor-layout:v1:skycanvas (DS shared hook).
 * Guard test: src/__tests__/skycanvas.safetyImports.guard.spec.ts
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play, Pause, Square, SkipBack, SkipForward,
  Music, Command as CommandIcon, OctagonAlert,
  PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen,
  PanelBottomClose, PanelBottomOpen, RotateCw,
  Flame, Sparkles, Send, Lightbulb, Sliders,
} from 'lucide-react';
import { toast } from 'sonner';


import StudioErrorBoundary from '@/components/errors/StudioErrorBoundary';
import { Badge } from '@/components/ui/badge';

import { useProjectStore } from '@/store/useProjectStore';
import { EFFECT_LIBRARY } from '@/data/effectLibrary';
import { resolveEffectLedAccurate } from '@/data/effectsLibraries/resolveEffect';
import { detectSkyCapability, profileBudget, type SkyCapability } from '@/lib/skycanvasCapability';
import { FXK_EFFECT_DRAG_TYPE } from '@/components/editor/EffectLibrarySidebar';
import SkyFallback2D from '@/components/skycanvas/SkyFallback2D';
import { decodeAudioPeaks } from '@/lib/skycanvasAudioPeaks';
import { useSmallViewport } from '@/hooks/useSmallViewport';
import { buildSkyActions } from '@/components/skycanvas/skyActions';
import TabbedDockPanel from '@/components/skycanvas/TabbedDockPanel';
import { LIBRARY_TABS, INSPECTOR_TABS, TIMELINE_TABS } from '@/components/skycanvas/skyTabsConfig';
import MobilePanelSwitcher, { type MobilePanelKey } from '@/components/skycanvas/MobilePanelSwitcher';
import { TimelineCuesProvider } from '@/components/skycanvas/tabs/TimelineCuesTab';

// Round 8 — viewport HUD overlays consolidated under one chunk + Suspense.
const ViewportOverlays = lazy(() => import('@/components/skycanvas/ViewportOverlays'));

import { useActiveDemoSession } from '@/hooks/useActiveDemoSession';

import { EditorShell, DsSegmentTabs, type SegmentItem } from '@/components/ds';
import { useEditorLayout } from '@/hooks/editor/useEditorLayout';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import { useWorkMode } from '@/core/safety/workMode';
import { useSkyCanvasShowPersistence, clearPersistedSkyCanvasShow } from '@/hooks/useSkyCanvasShowPersistence';
import { cn } from '@/lib/utils';

// Round 7: SkyCanvas2 viewport now mounts via the canonical SkyCanvasMount
// (engine='v2'). One lazy chunk shared with the rest of the platform; the
// mount itself is React.memo'd so the heavy 3D tree no longer re-renders
// when this page's state changes (e.g. tab switches, panel resizes).
import SkyCanvasMount from '@/components/editor/SkyCanvasMount';
import SkyCanvasDiagnosticsPanel from '@/components/editor/SkyCanvasDiagnosticsPanel';
const SkyCanvasCommandPalette = lazy(() => import('@/components/skycanvas/SkyCanvasCommandPalette'));
const CatalogImportDialog = lazy(() => import('@/components/editor/CatalogImportDialog'));

// Legacy 9-Apr chrome (visual-only). Gated by editor_legacy_chrome_2604.
import { isEditorLegacyChrome2604Enabled } from '@/lib/featureFlags';
import EditorTopBarLegacy, { type TopSegment } from '@/components/skycanvas/legacy-2604/EditorTopBarLegacy';
import LeftToolRailLegacy from '@/components/skycanvas/legacy-2604/LeftToolRailLegacy';
import RightIconRailLegacy from '@/components/skycanvas/legacy-2604/RightIconRailLegacy';
import LaserControlFloatingPanel from '@/components/skycanvas/legacy-2604/LaserControlFloatingPanel';
import { TransportBarLegacy, FiringLanesTimelineLegacy, JoiAvatarFab } from '@/components/skycanvas/legacy-2604/TransportAndLanesLegacy';

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

// Small icon button for layout toggles (matches EditorShellPreview).
/** Render a keyboard chord like ⌘1 / ⇧⌘0 inside tooltips. */
function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="ds-mono text-[10px] text-cyan-200/90 border border-white/15 rounded px-1.5 py-0.5 bg-black/40">
      {children}
    </kbd>
  );
}

function LayoutIconButton({
  ariaLabel, onClick, active, children, shortcut, shortcutLabel, controls,
}: {
  ariaLabel: string; onClick: () => void; active: boolean; children: React.ReactNode;
  /** ARIA keyboard shortcut hint, e.g. "Control+1". */
  shortcut?: string;
  /** Display label rendered inside the tooltip kbd, e.g. "⌘1". */
  shortcutLabel?: string;
  /** id of the panel region this button toggles (aria-controls). */
  controls?: string;
}) {
  const titleHint = shortcutLabel ?? shortcut?.replace('Control', '⌘');
  const button = (
    <button
      type="button"
      aria-label={ariaLabel}
      title={titleHint ? `${ariaLabel} (${titleHint})` : ariaLabel}
      aria-pressed={active}
      aria-keyshortcuts={shortcut}
      aria-controls={controls}
      aria-expanded={active}
      onClick={onClick}
      className={cn(
        'flex size-7 items-center justify-center rounded-ds-sm transition-colors ds-focus',
        active
          ? 'text-status-sync hover:bg-ds-surface-deep'
          : 'text-ds-text-muted hover:text-status-sync hover:bg-ds-surface-deep',
      )}
    >
      {children}
    </button>
  );
  if (!shortcutLabel) return button;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="bottom" className="flex items-center gap-2 ds-mono text-[11px]">
        <span>{ariaLabel}</span>
        <Kbd>{shortcutLabel}</Kbd>
      </TooltipContent>
    </Tooltip>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Tabs strip — segment selector (visual only for now)
// ─────────────────────────────────────────────────────────────────────

const SEGMENTS: SegmentItem[] = [
  { id: 'pyro',   label: 'PYRO',   icon: Flame },
  { id: 'sfx',    label: 'SFX',    icon: Sparkles },
  { id: 'drones', label: 'DRONES', icon: Send },
  { id: 'light',  label: 'LIGHT',  icon: Lightbulb },
  { id: 'dmx',    label: 'DMX',    icon: Sliders },
];

// ─────────────────────────────────────────────────────────────────────
// Topbar (glass) + Master Menu pill + transport
// ─────────────────────────────────────────────────────────────────────

function GlassTopbar({
  cap, playing, onTogglePlay, onStop, onSeek, time, duration,
  onPickAudio, audioName, onOpenMaster, onEStop,
  workModeLabel, sessionMeta,
  layoutControls,
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
  layoutControls: {
    leftCollapsed: boolean; rightCollapsed: boolean; timelineCollapsed: boolean;
    toggleLeft: () => void; toggleRight: () => void; toggleTimeline: () => void;
    reset: () => void;
  };
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Intent-based prefetch: hovering Master Menu warms the chunk.
  const prefetchMaster = useCallback(() => {
    void import('@/components/skycanvas/SkyCanvasCommandPalette');
  }, []);

  return (
    <div
      className={cn(
        'glass-pane glass-pane-strong h-full mx-3 my-1.5 rounded-2xl px-3 flex items-center gap-3',
      )}
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
      <Tooltip>
        <TooltipTrigger asChild>
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
            aria-label="Abrir Master Menu"
            aria-haspopup="dialog"
            aria-keyshortcuts="Control+K Control+M"
          >
            <CommandIcon className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Master Menu</span>
            <kbd className="ds-mono text-[10px] text-cyan-300/50 hidden md:inline">⌘K</kbd>
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="flex items-center gap-2 ds-mono text-[11px]">
          <span>Master Menu</span>
          <Kbd>⌘K</Kbd>
          <span className="text-zinc-500">ou</span>
          <Kbd>⌘M</Kbd>
        </TooltipContent>
      </Tooltip>

      <div className="flex-1" />

      {/* Layout toggles — desktop only */}
      <div
        className="hidden lg:flex items-center gap-1 rounded-ds-md border border-ds-border-default bg-ds-surface-elevated/60 p-0.5"
        role="group"
        aria-label="Controles de layout do editor"
      >
        <LayoutIconButton
          ariaLabel={layoutControls.leftCollapsed ? 'Expandir Biblioteca' : 'Recolher Biblioteca'}
          onClick={layoutControls.toggleLeft}
          active={!layoutControls.leftCollapsed}
          shortcut="Control+1"
          shortcutLabel="⌘1"
          controls="panel-library"
        >
          {layoutControls.leftCollapsed ? <PanelLeftOpen className="size-3.5" /> : <PanelLeftClose className="size-3.5" />}
        </LayoutIconButton>
        <LayoutIconButton
          ariaLabel={layoutControls.timelineCollapsed ? 'Expandir Timeline' : 'Recolher Timeline'}
          onClick={layoutControls.toggleTimeline}
          active={!layoutControls.timelineCollapsed}
          shortcut="Control+3"
          shortcutLabel="⌘3"
          controls="panel-timeline"
        >
          {layoutControls.timelineCollapsed ? <PanelBottomOpen className="size-3.5" /> : <PanelBottomClose className="size-3.5" />}
        </LayoutIconButton>
        <LayoutIconButton
          ariaLabel={layoutControls.rightCollapsed ? 'Expandir Inspector' : 'Recolher Inspector'}
          onClick={layoutControls.toggleRight}
          active={!layoutControls.rightCollapsed}
          shortcut="Control+2"
          shortcutLabel="⌘2"
          controls="panel-inspector"
        >
          {layoutControls.rightCollapsed ? <PanelRightOpen className="size-3.5" /> : <PanelRightClose className="size-3.5" />}
        </LayoutIconButton>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={layoutControls.reset}
              aria-label="Resetar layout"
              aria-keyshortcuts="Control+Shift+0"
              className="flex size-7 items-center justify-center rounded-ds-sm text-ds-text-muted hover:text-status-sync hover:bg-ds-surface-deep transition-colors ds-focus"
            >
              <RotateCw className="size-3.5" aria-hidden="true" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="flex items-center gap-2 ds-mono text-[11px]">
            <span>Restaurar layout padrão</span>
            <Kbd>⇧⌘0</Kbd>
          </TooltipContent>
        </Tooltip>
      </div>

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

      {/* Transport — visible ≥md */}
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
    </div>
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
    <div className="md:hidden fixed bottom-3 left-1/2 -translate-x-1/2 z-50">
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
  const budget = useMemo(() => profileBudget(cap), [cap]);
  // Memoized so the memoized SkyCanvasMount doesn't re-render the canvas tree
  // on unrelated parent state changes (panel toggles, tab switches, etc).
  const v2Props = useMemo(
    () => ({
      hideStage: !budget.showStage,
      showFixtures: budget.showFixtures,
      hideStars: !budget.showStars,
      dpr: budget.dpr,
    }),
    [budget],
  );
  const workMode = useWorkMode();
  const workModeLabel = workMode === 'design' ? 'DESIGN' : workMode === 'simulation' ? 'SIM' : 'REAL OP';
  const session = useActiveDemoSession();

  // Persistent shell layout (per-surface, key 'skycanvas').
  const layout = useEditorLayout('skycanvas');

  // Tabs segment (visual only for now)
  const [activeSegment, setActiveSegment] = useState<string>('pyro');

  // Transport
  const playing = useProjectStore((s) => s.isPlaying);
  const time = useProjectStore((s) => s.currentTime);
  const duration = useProjectStore((s) => s.duration) || 60;
  const setPlaying = useProjectStore((s) => s.setPlaying);
  const setCurrentTime = useProjectStore((s) => s.setCurrentTime);
  const setDuration = useProjectStore((s) => s.setDuration);

  // Audio buffer / waveform
  const [peaks, setPeaks] = useState<Float32Array | null>(null);
  const [audioName, setAudioName] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const [decoding, setDecoding] = useState(false);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  // ── Playback clock ──
  // When an audio file is loaded, the <audio> element drives currentTime
  // (audio is master clock). Otherwise, fall back to a wall-clock RAF so the
  // operator can still scrub/play the timeline without a soundtrack.
  useEffect(() => {
    if (!playing) return;
    const el = audioElRef.current;
    const hasAudio = !!audioUrl && !!el;

    if (hasAudio && el) {
      void el.play().catch(() => { /* autoplay block — fall back to RAF below */ });
      let raf = 0;
      const tick = () => {
        const t = el.currentTime;
        if (t >= duration) { el.pause(); setCurrentTime(0); setPlaying(false); return; }
        setCurrentTime(t);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => { cancelAnimationFrame(raf); el.pause(); };
    }

    // Fallback: wall-clock RAF (no audio loaded)
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
  }, [playing, duration, audioUrl, setCurrentTime, setPlaying]);

  const togglePlay = useCallback(() => setPlaying(!useProjectStore.getState().isPlaying), [setPlaying]);
  const stop = useCallback(() => {
    setPlaying(false); setCurrentTime(0);
    const el = audioElRef.current; if (el) { el.pause(); el.currentTime = 0; }
  }, [setPlaying, setCurrentTime]);
  const seek = useCallback((delta: number) => {
    const t = useProjectStore.getState().currentTime;
    const next = Math.max(0, Math.min(duration, t + delta));
    setCurrentTime(next);
    const el = audioElRef.current; if (el) el.currentTime = next;
  }, [duration, setCurrentTime]);
  const seekAbs = useCallback((t: number) => {
    setCurrentTime(t);
    const el = audioElRef.current; if (el) el.currentTime = t;
  }, [setCurrentTime]);

  // Master Menu palette
  const [paletteOpen, setPaletteOpen] = useState(false);

  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const pickAudio = useCallback(() => audioInputRef.current?.click(), []);

  const onPickAudio = async (file: File) => {
    if (decoding) return;
    setDecoding(true);
    const tid = toast.loading(`Decodificando ${file.name}…`);
    try {
      const result = await decodeAudioPeaks(file, 1024);
      setPeaks(result.peaks);
      setAudioName(file.name);
      setAudioUrl((prev) => {
        if (prev) { try { URL.revokeObjectURL(prev); } catch { /* */ } }
        const next = URL.createObjectURL(file);
        audioUrlRef.current = next;
        return next;
      });
      setDuration(result.durationSec);
      setCurrentTime(0);
      setPlaying(false);
      toast.success(`Áudio carregado · ${result.durationSec.toFixed(1)}s · ${result.sampleRate} Hz`, { id: tid });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao decodificar áudio', { id: tid });
    } finally { setDecoding(false); }
  };

  // Revoke audio object URL on unmount via ref (avoid stale-closure on audioUrl).
  useEffect(() => () => {
    const u = audioUrlRef.current;
    if (u) { try { URL.revokeObjectURL(u); } catch { /* */ } }
    audioUrlRef.current = null;
  }, []);

  // Cue drop handlers — resolve via canonical lookup (legacy + Finale 3D parts).
  const dropEffectAt = useCallback((effectId: string, t: number, laneHint?: 'pyro' | 'drone') => {
    const fx = resolveEffectLedAccurate(effectId) ?? EFFECT_LIBRARY.find((e) => e.id === effectId);
    if (!fx) return;
    const baseLabel = `${fx.icon ?? '✦'} ${fx.name}`;
    // If the user dropped on the DRONE lane, tag the label so projection
    // routes to the drone firing system (FiringLanesTimelineLegacy split).
    const label = laneHint === 'drone' && !baseLabel.toLowerCase().includes('drone')
      ? `${baseLabel} · drone`
      : baseLabel;
    useProjectStore.getState().addCueMarker({
      id: `cue-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      time: Math.max(0, Math.min(duration, t)),
      label,
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
    toggleLeft: layout.toggleLeft,
    toggleRight: layout.toggleRight,
    toggleTimeline: layout.toggleTimeline,
    resetLayout: () => { layout.reset(); toast.success('Layout restaurado'); },
    goCommand: () => navigate('/command'),
    goAiBuilder: () => navigate('/ai-builder'),
    goStrategy: () => navigate('/strategy'),
    openImportVdl: () => setImportOpen(true),
    exportShowJson,
    resetShow,
  }), [togglePlay, stop, seekAbs, pickAudio, layout, navigate, exportShowJson, resetShow]);

  // Keyboard shortcuts
  useEffect(() => {
    const focusPanel = (id: string) => {
      // Defer to next frame so the panel has been laid out (uncollapsed) first.
      requestAnimationFrame(() => {
        const el = document.getElementById(id);
        if (el) (el as HTMLElement).focus({ preventScroll: true });
      });
    };
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const inField = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      const ctrl = e.metaKey || e.ctrlKey;

      // Master menu (toggle)
      if (ctrl && (e.key.toLowerCase() === 'k' || e.key.toLowerCase() === 'm')) {
        e.preventDefault(); setPaletteOpen((o) => !o); return;
      }
      // Panel toggles (only outside form fields)
      if (!inField && ctrl && (e.key === '1' || e.key === '2' || e.key === '3')) {
        e.preventDefault();
        if (e.key === '1') { layout.toggleLeft(); focusPanel('panel-library'); }
        else if (e.key === '2') { layout.toggleRight(); focusPanel('panel-inspector'); }
        else { layout.toggleTimeline(); focusPanel('panel-timeline'); }
        return;
      }
      // Reset layout (Shift+Cmd+0 — destrutivo, exige Shift)
      if (!inField && ctrl && e.shiftKey && e.key === '0') {
        e.preventDefault();
        layout.reset();
        toast.success('Layout restaurado');
        return;
      }
      if (inField) return;
      if (e.code === 'Space') { e.preventDefault(); setPlaying(!useProjectStore.getState().isPlaying); }
      else if (e.key === 'ArrowLeft')  { setCurrentTime(Math.max(0, useProjectStore.getState().currentTime - (e.shiftKey ? 1 : 1 / 30))); }
      else if (e.key === 'ArrowRight') { setCurrentTime(Math.min(duration, useProjectStore.getState().currentTime + (e.shiftKey ? 1 : 1 / 30))); }
      else if (e.key === 'Home') { setCurrentTime(0); }
      else if (e.key === 'End')  { setCurrentTime(duration); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [duration, setPlaying, setCurrentTime, layout]);

  const isMobile = useSmallViewport(900);
  const [mobileActive, setMobileActive] = useState<MobilePanelKey>('library');

  // Legacy 9-Apr chrome (visual-only). Toggle via ?legacyChrome=0/1 or flag.
  const legacyChrome = useMemo(() => isEditorLegacyChrome2604Enabled(), []);
  const [legacyTopSegment, setLegacyTopSegment] = useState<TopSegment>('pyro');
  const [laserPanelOpen, setLaserPanelOpen] = useState(true);
  const [transportRate, setTransportRate] = useState(1);
  const setRate = useCallback((r: number) => {
    setTransportRate(r);
    const el = audioElRef.current; if (el) el.playbackRate = r;
  }, []);

  // Effective layout: on mobile, only one rail/timeline visible at a time.
  const effectiveLayout = useMemo(() => {
    if (!isMobile) {
      return {
        leftWidth: layout.effective.leftWidth,
        rightWidth: layout.effective.rightWidth,
        timelineHeight: layout.effective.timelineHeight,
      };
    }
    return {
      leftWidth: mobileActive === 'library' ? layout.leftWidth : 0,
      rightWidth: mobileActive === 'inspector' ? layout.rightWidth : 0,
      timelineHeight: mobileActive === 'timeline' ? layout.timelineHeight : 0,
    };
  }, [isMobile, mobileActive, layout.effective, layout.leftWidth, layout.rightWidth, layout.timelineHeight]);

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

      {/* Audio master clock element — drives currentTime when a track is loaded */}
      {audioUrl && (
        <audio
          ref={audioElRef}
          src={audioUrl}
          preload="auto"
          className="hidden"
          aria-hidden="true"
        />
      )}

      <EditorShell
        layout={effectiveLayout}
        topbar={
          legacyChrome ? (
            <EditorTopBarLegacy
              time={time}
              onOpenMaster={() => setPaletteOpen(true)}
              onOpenImport={() => setImportOpen(true)}
              onExport={exportShowJson}
              onResetShow={resetShow}
              segment={legacyTopSegment}
              onSegmentChange={setLegacyTopSegment}
            />
          ) : (
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
              layoutControls={{
                leftCollapsed: layout.leftCollapsed,
                rightCollapsed: layout.rightCollapsed,
                timelineCollapsed: layout.timelineCollapsed,
                toggleLeft: layout.toggleLeft,
                toggleRight: layout.toggleRight,
                toggleTimeline: layout.toggleTimeline,
                reset: layout.reset,
              }}
            />
          )
        }
        tabs={
          legacyChrome ? null : (
            <div className="h-full glass-pane mx-3 my-1 rounded-xl flex items-center px-ds-4">
              <DsSegmentTabs
                items={SEGMENTS}
                activeId={activeSegment}
                onChange={setActiveSegment}
                colorPerSegment
              />
            </div>
          )
        }
        left={
          <StudioErrorBoundary area="SkyCanvas · Library">
            <section
              id="panel-library"
              role="region"
              aria-label="Biblioteca"
              tabIndex={-1}
              className="h-full flex flex-col outline-none"
              data-panel-id="library"
            >
              <TabbedDockPanel
                defaultValue="effects"
                value={layout.activeTabs?.left ?? 'effects'}
                onValueChange={(v) => layout.setActiveTab('left', v)}
                tabs={LIBRARY_TABS}
              />
            </section>
          </StudioErrorBoundary>
        }
        right={
          <StudioErrorBoundary area="SkyCanvas · Inspector">
            <section
              id="panel-inspector"
              role="region"
              aria-label="Inspector"
              tabIndex={-1}
              className="h-full flex flex-col outline-none"
              data-panel-id="inspector"
            >
              <TabbedDockPanel
                defaultValue="cue"
                dense
                value={layout.activeTabs?.right ?? 'cue'}
                onValueChange={(v) => layout.setActiveTab('right', v)}
                tabs={INSPECTOR_TABS}
              />
            </section>
          </StudioErrorBoundary>
        }
        timeline={
          <StudioErrorBoundary area="SkyCanvas · Timeline">
            <section
              id="panel-timeline"
              role="region"
              aria-label="Timeline"
              tabIndex={-1}
              className="h-full flex flex-col outline-none"
              data-panel-id="timeline"
            >
              {legacyChrome ? (
                <div className="h-full flex flex-col bg-zinc-950/80">
                  <TransportBarLegacy
                    playing={playing}
                    onTogglePlay={togglePlay}
                    onStop={stop}
                    onSeek={(d) => (d === -Infinity ? seekAbs(0) : seek(d))}
                    time={time}
                    duration={duration}
                    rate={transportRate}
                    onRateChange={setRate}
                  />
                  <FiringLanesTimelineLegacy duration={duration} time={time} onDropEffect={dropEffectAt} />
                </div>
              ) : (
                <TimelineCuesProvider value={{ time, duration, onSeekAbs: seekAbs, onDropEffect: dropEffectAt, peaks }}>
                  <TabbedDockPanel
                    defaultValue="cues"
                    dense
                    value={layout.activeTabs?.timeline ?? 'cues'}
                    onValueChange={(v) => layout.setActiveTab('timeline', v)}
                    tabs={TIMELINE_TABS}
                  />
                </TimelineCuesProvider>
              )}
            </section>
          </StudioErrorBoundary>
        }
      >
        {/* VIEWPORT — fills remaining grid cell */}
        <StudioErrorBoundary area="SkyCanvas · Viewport">
          <div
            id="viewport"
            tabIndex={-1}
            data-fxk-viewport
            className="relative h-full w-full"
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
              <SkyCanvasMount
                instanceKey="skycanvas-page"
                engine="v2"
                area="SkyCanvas · Viewport"
                loaderLabel="Booting SkyCanvas…"
                v2Props={v2Props}
              />
            ) : (
              <SkyFallback2D reason={cap.reasons[0]} />
            )}

            {/* Round 8 — viewport HUD overlays consolidated. */}
            <ViewportOverlays />

            {/* SkyCanvas exception inspector — dev/debug overlay (top-right).
                Self-hides when no entries; never affects safety/command path. */}
            {import.meta.env.DEV && <SkyCanvasDiagnosticsPanel />}

            {/* Legacy 9-Apr chrome overlays */}
            {legacyChrome && (
              <>
                <LeftToolRailLegacy />
                <RightIconRailLegacy
                  activeRightTab={layout.activeTabs?.right ?? 'cue'}
                  onSelectRightTab={(v) => layout.setActiveTab('right', v)}
                  onOpenPalette={() => setPaletteOpen(true)}
                />
                <LaserControlFloatingPanel
                  open={laserPanelOpen}
                  onClose={() => setLaserPanelOpen(false)}
                />
                <JoiAvatarFab onClick={() => setPaletteOpen(true)} />
              </>
            )}
          </div>
        </StudioErrorBoundary>
      </EditorShell>

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
      <MobilePanelSwitcher
        active={mobileActive}
        onChange={(key) => {
          setMobileActive(key);
          requestAnimationFrame(() => {
            const id = key === 'library' ? 'panel-library'
              : key === 'inspector' ? 'panel-inspector'
              : 'panel-timeline';
            document.getElementById(id)?.focus({ preventScroll: true });
          });
        }}
        panelIds={{ library: 'panel-library', inspector: 'panel-inspector', timeline: 'panel-timeline' }}
      />

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
