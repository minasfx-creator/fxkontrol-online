/**
 * SkyCanvasViewportShell — Layout canônico do editor SkyCanvas (refined v2).
 *
 * Mudanças nesta rodada (UI/UX polish):
 *  - Topbar com timecode digital grande (HH:MM:SS:FF), agrupamento por seções
 *    com separadores verticais sutis, badge SIM·ADVISORY com pulso suave,
 *    tooltips com atalhos.
 *  - Inspector ANCORADO em rail lateral direito full-height (slide-in),
 *    não mais flutuante. Botão dedicado no topbar para mostrar/esconder.
 *  - Atalho `i` toggla Inspector. `,` toggla colapso da timeline.
 *  - Melhor espaçamento responsivo no pill (gap-1.5).
 *
 * Plano: Show / Experience. ZERO CommandBus / FieldBus / SafetyStateMachine.
 * Real operation continua exclusiva em /command via uiCommandGateway.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Music, Play, Pause, Square, ChevronDown, ChevronUp, OctagonAlert, Activity,
  PanelRightOpen, PanelRightClose, SkipBack, SkipForward,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import SkyCanvasMount from '@/components/editor/SkyCanvasMount';
import GlassTimelineDock from '@/components/skycanvas/GlassTimelineDock';
import SkyCanvasDiagnosticsPanel from '@/components/editor/SkyCanvasDiagnosticsPanel';
import CueInspectorPanel from '@/components/skycanvas/CueInspectorPanel';
import SkyCanvasCueOverlay from '@/components/skycanvas/SkyCanvasCueOverlay';
import { decodeAudioPeaks } from '@/lib/skycanvasAudioPeaks';
import { useProjectStore } from '@/store/useProjectStore';

export interface SkyCanvasViewportShellProps {
  variant?: 'prod' | 'dev';
  timelineCollapsed?: boolean;
  diagOpen?: boolean;
  hideTopbar?: boolean;
  className?: string;
}

/** SMPTE-style timecode HH:MM:SS:FF (fps=30). Compact mm:ss:ff if <1h. */
function fmtTimecode(s: number, fps = 30): string {
  const a = Math.max(0, s);
  const hh = Math.floor(a / 3600);
  const mm = Math.floor((a % 3600) / 60).toString().padStart(2, '0');
  const ss = Math.floor(a % 60).toString().padStart(2, '0');
  const ff = Math.floor((a % 1) * fps).toString().padStart(2, '0');
  return hh > 0 ? `${hh.toString().padStart(2, '0')}:${mm}:${ss}:${ff}` : `${mm}:${ss}:${ff}`;
}

export default function SkyCanvasViewportShell({
  variant = 'prod',
  timelineCollapsed: initialCollapsed = false,
  diagOpen: initialDiag = false,
  hideTopbar = false,
  className,
}: SkyCanvasViewportShellProps) {
  const navigate = useNavigate();
  const [peaks, setPeaks] = useState<Float32Array | null>(null);
  const [audioName, setAudioName] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [diagOpen, setDiagOpen] = useState(() => {
    if (initialDiag) return true;
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('diag') === '1';
    }
    return false;
  });
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const isPlaying = useProjectStore((s) => s.isPlaying);
  const time = useProjectStore((s) => s.currentTime);
  const duration = useProjectStore((s) => s.duration);
  const cuesCount = useProjectStore((s) => s.cueMarkers.length);
  const selectedCueId = useProjectStore((s) => s.selectedCueMarkerId);
  const setPlaying = useProjectStore((s) => s.setPlaying);
  const setCurrentTime = useProjectStore((s) => s.setCurrentTime);
  const setDuration = useProjectStore((s) => s.setDuration);

  // Auto-open inspector when a cue is selected
  useEffect(() => {
    if (selectedCueId) setInspectorOpen(true);
  }, [selectedCueId]);

  const onPickAudio = useCallback(async (file: File) => {
    const tid = toast.loading(`Decodificando ${file.name}…`);
    try {
      const result = await decodeAudioPeaks(file, 1024);
      setPeaks(result.peaks);
      setAudioName(file.name);
      setDuration(result.durationSec);
      setCurrentTime(0);
      setPlaying(false);
      toast.success(`Áudio carregado · ${result.durationSec.toFixed(1)}s`, { id: tid });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao decodificar áudio', { id: tid });
    }
  }, [setDuration, setCurrentTime, setPlaying]);

  // Session-scoped cue clipboard (intentionally outside React to survive re-renders).
  const clipboardRef = useRef<import('@/types/projectTypes').CueMarker | null>(null);

  const newCueId = () => `cue-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  const duplicateSelected = useCallback(() => {
    const st = useProjectStore.getState();
    const cue = st.cueMarkers.find((c) => c.id === st.selectedCueMarkerId);
    if (!cue) return;
    const next = { ...cue, id: newCueId(), time: Math.min(st.duration, cue.time + 0.5) };
    st.addCueMarker(next);
    st.selectCueMarker(next.id);
    toast.success(`Cue duplicado · ${fmtTimecode(next.time)}`);
  }, []);

  const copySelected = useCallback((cut: boolean) => {
    const st = useProjectStore.getState();
    const cue = st.cueMarkers.find((c) => c.id === st.selectedCueMarkerId);
    if (!cue) return;
    clipboardRef.current = { ...cue };
    if (cut) {
      st.removeCueMarker(cue.id);
      toast.success(`Cue cortado · ${cue.label}`);
    } else {
      toast.success(`Cue copiado · ${cue.label}`);
    }
  }, []);

  const pasteAtPlayhead = useCallback(() => {
    const src = clipboardRef.current;
    if (!src) { toast.error('Clipboard vazio'); return; }
    const st = useProjectStore.getState();
    const next = { ...src, id: newCueId(), time: Math.min(st.duration, Math.max(0, st.currentTime)) };
    st.addCueMarker(next);
    st.selectCueMarker(next.id);
    toast.success(`Cue colado · ${fmtTimecode(next.time)}`);
  }, []);

  const deleteSelected = useCallback(() => {
    const st = useProjectStore.getState();
    const cue = st.cueMarkers.find((c) => c.id === st.selectedCueMarkerId);
    if (!cue) return;
    st.removeCueMarker(cue.id);
    toast.success(`Cue removido · ${cue.label}`);
  }, []);

  const nudgeSelected = useCallback((deltaSec: number) => {
    const st = useProjectStore.getState();
    const cue = st.cueMarkers.find((c) => c.id === st.selectedCueMarkerId);
    if (!cue) return;
    const t = Math.max(0, Math.min(st.duration, cue.time + deltaSec));
    if (t === cue.time) return;
    st.updateCueMarker(cue.id, { time: t });
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const inField = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if (inField) return;
      const ctrl = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      if (ctrl && e.shiftKey && k === 'd') {
        e.preventDefault();
        setDiagOpen((o) => !o);
      } else if (ctrl && e.key === '3') {
        e.preventDefault();
        setCollapsed((c) => !c);
      } else if (ctrl && k === 'd') {
        e.preventDefault();
        duplicateSelected();
      } else if (ctrl && k === 'c') {
        e.preventDefault();
        copySelected(false);
      } else if (ctrl && k === 'x') {
        e.preventDefault();
        copySelected(true);
      } else if (ctrl && k === 'v') {
        e.preventDefault();
        pasteAtPlayhead();
      } else if (!ctrl && (e.key === 'Delete' || e.key === 'Backspace')) {
        // Only intercept when a cue is selected to avoid stealing nav keys.
        if (useProjectStore.getState().selectedCueMarkerId) {
          e.preventDefault();
          deleteSelected();
        }
      } else if (!ctrl && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        if (!useProjectStore.getState().selectedCueMarkerId) return;
        e.preventDefault();
        const sign = e.key === 'ArrowRight' ? 1 : -1;
        const step = e.shiftKey ? 0.5 : 0.05;
        nudgeSelected(sign * step);
      } else if (e.code === 'Space') {
        // Avoid double-firing when a transport button still has focus
        if (t && (t.tagName === 'BUTTON' || t.getAttribute('role') === 'button')) {
          (t as HTMLElement).blur();
        }
        e.preventDefault();
        setPlaying(!useProjectStore.getState().isPlaying);
      } else if (e.key === 'Home' && !ctrl) {
        e.preventDefault();
        setCurrentTime(0);
      } else if (e.key === 'End' && !ctrl) {
        e.preventDefault();
        setCurrentTime(useProjectStore.getState().duration);
      } else if (e.key === 'Escape') {
        const st = useProjectStore.getState();
        if (st.selectedCueMarkerId) {
          e.preventDefault();
          st.selectCueMarker(null);
        } else if (diagOpen) {
          e.preventDefault();
          setDiagOpen(false);
        }
      } else if (e.key === 'i' && !ctrl) {
        e.preventDefault();
        setInspectorOpen((o) => !o);
      } else if (e.key === ',' && !ctrl) {
        e.preventDefault();
        setCollapsed((c) => !c);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setPlaying, setCurrentTime, diagOpen, duplicateSelected, copySelected, pasteAtPlayhead, deleteSelected, nudgeSelected]);


  const togglePlay = useCallback(() => setPlaying(!isPlaying), [isPlaying, setPlaying]);
  const stop = useCallback(() => { setPlaying(false); setCurrentTime(0); }, [setPlaying, setCurrentTime]);
  const seekStart = useCallback(() => setCurrentTime(0), [setCurrentTime]);
  const seekEnd = useCallback(() => setCurrentTime(duration), [setCurrentTime, duration]);

  const dockHeight = collapsed ? 36 : 200;
  const inspectorWidth = 320;

  // Right-edge inset for the dock so it doesn't overlap the inspector rail
  const dockRightInset = inspectorOpen ? inspectorWidth : 0;

  const tc = useMemo(() => fmtTimecode(time), [time]);
  const tcDur = useMemo(() => fmtTimecode(duration), [duration]);

  return (
    <div className={cn('fixed inset-0 bg-[#050810] text-cyan-100 overflow-hidden', className)}>
      {/* Viewport — fill */}
      <div className="absolute inset-0">
        <SkyCanvasMount
          instanceKey="viewport-shell"
          area="3D viewport (shell)"
          loaderLabel="Booting SkyCanvas…"
        />
        <SkyCanvasCueOverlay />
      </div>

      {/* Glass topbar pill — top-center */}
      {!hideTopbar && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 pointer-events-auto animate-fade-in">
          <div
            className="flex items-stretch gap-1.5 px-2 rounded-2xl border border-cyan-500/20 shadow-[0_8px_40px_rgba(0,0,0,0.7)]"
            style={{
              height: 52,
              background: 'linear-gradient(180deg, rgba(8,12,22,0.78) 0%, rgba(5,8,16,0.72) 100%)',
              backdropFilter: 'blur(22px) saturate(150%)',
              WebkitBackdropFilter: 'blur(22px) saturate(150%)',
            }}
          >
            {/* Brand + status */}
            <div className="flex items-center gap-2 pl-2 pr-3">
              <div className="flex flex-col leading-none">
                <span className="ds-mono text-[10px] tracking-[0.18em] text-cyan-200/95">FXKONTROL</span>
                <span className="ds-mono text-[8px] tracking-[0.22em] text-cyan-400/60">SKYCANVAS</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span
                  className="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 ds-mono text-[8px] tracking-wider text-cyan-300"
                  title="Modo simulação — nenhum disparo físico"
                >
                  <span className="h-1 w-1 rounded-full bg-cyan-300 animate-pulse" />
                  SIM·ADVISORY
                </span>
                {variant === 'dev' && (
                  <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 ds-mono text-[8px] tracking-wider text-amber-300">
                    DEV
                  </span>
                )}
              </div>
            </div>

            <Sep />

            {/* Transport */}
            <div className="flex items-center gap-0.5 px-1">
              <IconBtn label="Início" onClick={seekStart} title="Ir ao início (Home)">
                <SkipBack className="h-3.5 w-3.5" />
              </IconBtn>
              <button
                type="button"
                onClick={togglePlay}
                aria-label={isPlaying ? 'Pausar' : 'Tocar'}
                title={isPlaying ? 'Pausar (Space)' : 'Tocar (Space)'}
                className={cn(
                  'inline-flex h-9 w-9 items-center justify-center rounded-full border ds-focus transition-all',
                  'hover:scale-105 active:scale-95',
                  isPlaying
                    ? 'bg-amber-500/25 text-amber-200 border-amber-400/50 shadow-[0_0_12px_rgba(245,158,11,0.35)]'
                    : 'bg-cyan-500/25 text-cyan-100 border-cyan-400/50 shadow-[0_0_12px_rgba(34,211,238,0.35)]',
                )}
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-px" />}
              </button>
              <IconBtn label="Parar" onClick={stop} variant="rose" title="Parar e voltar ao início">
                <Square className="h-3 w-3" />
              </IconBtn>
              <IconBtn label="Fim" onClick={seekEnd} title="Ir ao fim (End)">
                <SkipForward className="h-3.5 w-3.5" />
              </IconBtn>
            </div>

            <Sep />

            {/* Timecode digital — destaque máximo */}
            <div
              className="flex flex-col items-center justify-center px-3 min-w-[148px]"
              title="Timecode atual / duração total (SMPTE 30fps)"
            >
              <div className="ds-mono text-[16px] leading-none tabular-nums tracking-[0.05em] text-cyan-100">
                {tc}
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="ds-mono text-[8px] text-zinc-500 tabular-nums">{tcDur}</span>
                <span className="ds-mono text-[8px] text-zinc-600">·</span>
                <span className="ds-mono text-[8px] text-cyan-500/70 tabular-nums">{cuesCount} cue{cuesCount === 1 ? '' : 's'}</span>
              </div>
            </div>

            <Sep />

            {/* Audio + tools */}
            <div className="flex items-center gap-1 px-1">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className={cn(
                  'inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg ds-mono text-[10px] transition-all',
                  'border ds-focus',
                  audioName
                    ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/15'
                    : 'border-white/10 text-zinc-400 hover:text-cyan-200 hover:border-cyan-500/30 hover:bg-white/[0.04]',
                )}
                title={audioName ?? 'Carregar trilha de áudio'}
              >
                <Music className="h-3 w-3" />
                <span className="hidden md:inline truncate max-w-[120px]">{audioName ?? 'Áudio'}</span>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onPickAudio(f);
                  e.target.value = '';
                }}
              />

              <IconBtn
                label="Inspector"
                onClick={() => setInspectorOpen((o) => !o)}
                active={inspectorOpen}
                title={inspectorOpen ? 'Fechar Inspector (I)' : 'Abrir Inspector (I)'}
              >
                {inspectorOpen ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
              </IconBtn>

              <IconBtn
                label="Diagnostics"
                onClick={() => setDiagOpen((o) => !o)}
                active={diagOpen}
                title="Diagnostics (Ctrl+Shift+D)"
              >
                <Activity className="h-3.5 w-3.5" />
              </IconBtn>
            </div>

            <Sep />

            {/* E-STOP */}
            <button
              type="button"
              onClick={() => navigate('/command')}
              title="Operação real → Centro de Comando"
              className={cn(
                'inline-flex items-center gap-1.5 h-8 my-auto px-3 rounded-lg ds-mono text-[10px] uppercase tracking-wider',
                'border border-rose-500/50 bg-rose-500/10 text-rose-300',
                'hover:bg-rose-500/20 hover:border-rose-400/70 hover:shadow-[0_0_12px_rgba(244,63,94,0.4)]',
                'transition-all ds-focus',
              )}
            >
              <OctagonAlert className="h-3.5 w-3.5" />
              <span className="hidden lg:inline font-semibold">E-STOP</span>
            </button>
          </div>
        </div>
      )}

      {/* Diagnostics overlay */}
      {diagOpen && (
        <div
          className="absolute top-20 z-30 max-w-sm pointer-events-auto animate-scale-in"
          style={{ right: (inspectorOpen ? inspectorWidth : 0) + 12 }}
        >
          <SkyCanvasDiagnosticsPanel />
        </div>
      )}

      {/* Inspector — anchored right rail, slide-in, full height */}
      <aside
        className={cn(
          'absolute top-0 right-0 z-30 transition-transform duration-300 ease-out',
          'pointer-events-auto',
          inspectorOpen ? 'translate-x-0' : 'translate-x-full',
        )}
        style={{
          width: inspectorWidth,
          height: '100%',
          paddingTop: 76,
          paddingBottom: dockHeight + 12,
          paddingRight: 12,
        }}
        aria-hidden={!inspectorOpen}
      >
        <CueInspectorPanel docked />
      </aside>

      {/* Glass timeline dock — bottom (insets right when inspector docked) */}
      <div
        className="absolute bottom-0 left-0 z-20 pointer-events-auto transition-[height,right] duration-200 ease-out"
        style={{ height: dockHeight, right: dockRightInset }}
      >
        {collapsed ? (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className={cn(
              'group w-full h-full flex items-center justify-center gap-2',
              'ds-mono text-[10px] text-cyan-300/70 hover:text-cyan-200',
              'border-t border-cyan-500/20 transition-colors',
            )}
            style={{
              background: 'rgba(5, 8, 16, 0.55)',
              backdropFilter: 'blur(18px) saturate(140%)',
              WebkitBackdropFilter: 'blur(18px) saturate(140%)',
            }}
            title="Expandir timeline (, ou ⌘3)"
            aria-label="Expandir timeline"
          >
            <ChevronUp className="h-3 w-3 group-hover:-translate-y-0.5 transition-transform" />
            <span className="tracking-wider">TIMELINE</span>
            <span className="text-zinc-600">·</span>
            <span className="tabular-nums">{tc}</span>
            <span className="text-zinc-600">/</span>
            <span className="tabular-nums">{tcDur}</span>
            <span className="text-zinc-600 ml-2">{cuesCount} cues</span>
          </button>
        ) : (
          <div className="relative h-full">
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="absolute top-1 right-2 z-10 inline-flex items-center gap-1 h-6 px-2 rounded-md ds-mono text-[9px] text-zinc-400 hover:text-cyan-200 hover:bg-white/[0.06] transition-colors ds-focus"
              title="Recolher timeline (, ou ⌘3)"
              aria-label="Recolher timeline"
            >
              <ChevronDown className="h-3 w-3" />
            </button>
            <GlassTimelineDock peaks={peaks} height={dockHeight} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Local UI atoms
// ─────────────────────────────────────────────────────────────────────

function Sep() {
  return <div className="w-px self-stretch my-2 bg-gradient-to-b from-transparent via-white/10 to-transparent" />;
}

function IconBtn({
  children, onClick, label, title, active, variant = 'cyan',
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  title?: string;
  active?: boolean;
  variant?: 'cyan' | 'rose';
}) {
  const hover = variant === 'rose'
    ? 'hover:text-rose-300 hover:bg-rose-500/10'
    : 'hover:text-cyan-200 hover:bg-cyan-500/10';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={title ?? label}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-lg ds-focus transition-all',
        active
          ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40 shadow-[0_0_8px_rgba(34,211,238,0.25)]'
          : `text-zinc-400 ${hover}`,
      )}
    >
      {children}
    </button>
  );
}
