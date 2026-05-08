/**
 * SkyCanvasViewportShell — Layout canônico do editor SkyCanvas.
 *
 * Promove o look fullscreen de /dev/skycanvas-lab (variante smoke) para
 * o viewport definitivo do editor, com refinamentos:
 *   - Glass topbar pill flutuante (top-center)
 *   - SkyCanvasMount fill 100% (engine='auto', flag-driven)
 *   - GlassTimelineDock na base (colapsável, glassmorphism)
 *   - Audio picker integrado (decodeAudioPeaks)
 *   - SkyCanvasDiagnosticsPanel via ?diag=1 ou Ctrl+Shift+D
 *
 * Plano: Show/Experience. ZERO CommandBus/FieldBus/SafetyStateMachine.
 * Real operation continua exclusiva em /command via uiCommandGateway.
 *
 * Self-contained: gerencia peaks/audio/playback via useProjectStore.
 * Não depende de EditorShell — viewport livre, painéis ficam como
 * drawer flutuante (futuro) ou em rotas dedicadas.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Music, Play, Pause, Square, ChevronDown, ChevronUp, OctagonAlert, Activity } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';

export interface SkyCanvasViewportShellProps {
  /** 'prod' (default) hides dev-only badges; 'dev' shows them. */
  variant?: 'prod' | 'dev';
  /** Initial collapsed state for the timeline dock. */
  timelineCollapsed?: boolean;
  /** Initial diagnostics overlay state. */
  diagOpen?: boolean;
  /** Hide the glass topbar entirely. */
  hideTopbar?: boolean;
  className?: string;
}

function fmtTime(s: number) {
  const a = Math.max(0, s);
  const mm = Math.floor(a / 60).toString().padStart(2, '0');
  const ss = Math.floor(a % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
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
  const fileRef = useRef<HTMLInputElement | null>(null);

  const isPlaying = useProjectStore((s) => s.isPlaying);
  const time = useProjectStore((s) => s.currentTime);
  const duration = useProjectStore((s) => s.duration);
  const setPlaying = useProjectStore((s) => s.setPlaying);
  const setCurrentTime = useProjectStore((s) => s.setCurrentTime);
  const setDuration = useProjectStore((s) => s.setDuration);

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

  // Ctrl+Shift+D toggles diagnostics
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const inField = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if (inField) return;
      const ctrl = e.metaKey || e.ctrlKey;
      if (ctrl && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setDiagOpen((o) => !o);
      } else if (ctrl && e.key === '3') {
        e.preventDefault();
        setCollapsed((c) => !c);
      } else if (e.code === 'Space') {
        e.preventDefault();
        setPlaying(!useProjectStore.getState().isPlaying);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setPlaying]);

  const togglePlay = useCallback(() => setPlaying(!isPlaying), [isPlaying, setPlaying]);
  const stop = useCallback(() => { setPlaying(false); setCurrentTime(0); }, [setPlaying, setCurrentTime]);

  const dockHeight = collapsed ? 36 : 200;

  return (
    <div className={cn('fixed inset-0 bg-[#050810] text-cyan-100 overflow-hidden', className)}>
      {/* Viewport — fill */}
      <div className="absolute inset-0">
        <SkyCanvasMount
          instanceKey="viewport-shell"
          area="3D viewport (shell)"
          loaderLabel="Booting SkyCanvas…"
        />
      </div>

      {/* Glass topbar pill — top-center */}
      {!hideTopbar && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 pointer-events-auto">
          <div
            className="flex items-center gap-2 h-12 px-3 rounded-full border border-cyan-500/15 shadow-[0_8px_32px_rgba(0,0,0,0.6)]"
            style={{
              background: 'rgba(5, 8, 16, 0.65)',
              backdropFilter: 'blur(18px) saturate(140%)',
              WebkitBackdropFilter: 'blur(18px) saturate(140%)',
            }}
          >
            <span className="ds-mono text-[11px] tracking-wider text-cyan-300/90 hidden sm:block px-1">
              FXKONTROL · SKYCANVAS
            </span>
            <Badge variant="outline" className="border-cyan-500/30 text-cyan-300 ds-mono text-[9px]">
              SIM · ADVISORY
            </Badge>
            {variant === 'dev' && (
              <Badge variant="outline" className="border-amber-500/30 text-amber-300 ds-mono text-[9px]">
                DEV
              </Badge>
            )}

            {/* Transport mini */}
            <div className="flex items-center gap-1 ml-1">
              <button
                type="button"
                onClick={togglePlay}
                aria-label={isPlaying ? 'Pausar' : 'Tocar'}
                className={cn(
                  'inline-flex h-8 w-8 items-center justify-center rounded-full border ds-focus transition-colors',
                  isPlaying
                    ? 'bg-amber-500/20 text-amber-200 border-amber-500/40'
                    : 'bg-cyan-500/20 text-cyan-100 border-cyan-500/40',
                )}
              >
                {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              </button>
              <button
                type="button"
                onClick={stop}
                aria-label="Parar"
                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 hover:text-rose-300 hover:bg-rose-500/10 ds-focus"
              >
                <Square className="h-3 w-3" />
              </button>
            </div>

            <div className="ds-mono text-[11px] text-cyan-300 tabular-nums px-2 border-l border-white/10">
              {fmtTime(time)} / {fmtTime(duration)}
            </div>

            {/* Audio picker */}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full ds-mono text-[10px] text-zinc-300 hover:text-cyan-200 hover:bg-white/[0.06] transition-colors ds-focus"
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

            {/* Diag toggle */}
            <button
              type="button"
              onClick={() => setDiagOpen((o) => !o)}
              aria-pressed={diagOpen}
              title="Diagnostics (Ctrl+Shift+D)"
              className={cn(
                'inline-flex h-7 w-7 items-center justify-center rounded-full ds-focus transition-colors',
                diagOpen
                  ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40'
                  : 'text-zinc-400 hover:text-cyan-200 hover:bg-white/[0.06]',
              )}
            >
              <Activity className="h-3.5 w-3.5" />
            </button>

            {/* E-STOP cosmético → /command */}
            <button
              type="button"
              onClick={() => navigate('/command')}
              title="Operação real → Centro de Comando"
              className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full ds-mono text-[10px] uppercase tracking-wider border border-rose-500/40 text-rose-300 hover:bg-rose-500/10 transition-colors ds-focus"
            >
              <OctagonAlert className="h-3 w-3" />
              <span className="hidden lg:inline">E-STOP</span>
            </button>
          </div>
        </div>
      )}

      {/* Diagnostics overlay (DEV-only when ?diag=1 or Ctrl+Shift+D) */}
      {diagOpen && (
        <div className="absolute top-20 right-3 z-30 max-w-sm pointer-events-auto">
          <SkyCanvasDiagnosticsPanel />
        </div>
      )}

      {/* Cue Inspector — floating glass dock (right) when a cue is selected */}
      <div
        className="absolute right-3 z-30 pointer-events-none"
        style={{ top: diagOpen ? 'calc(20rem + 24px)' : '5rem' }}
      >
        <CueInspectorPanel />
      </div>

      {/* Glass timeline dock — bottom */}
      <div
        className="absolute inset-x-0 bottom-0 z-20 pointer-events-auto transition-[height] duration-200 ease-out"
        style={{ height: dockHeight }}
      >
        {collapsed ? (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="w-full h-full flex items-center justify-center gap-2 ds-mono text-[10px] text-cyan-300/70 hover:text-cyan-200 border-t border-cyan-500/15 transition-colors"
            style={{
              background: 'rgba(5, 8, 16, 0.55)',
              backdropFilter: 'blur(18px) saturate(140%)',
              WebkitBackdropFilter: 'blur(18px) saturate(140%)',
            }}
            title="Expandir timeline (⌘3)"
            aria-label="Expandir timeline"
          >
            <ChevronUp className="h-3 w-3" />
            <span>TIMELINE · {fmtTime(time)} / {fmtTime(duration)}</span>
          </button>
        ) : (
          <div className="relative h-full">
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="absolute top-1 right-2 z-10 inline-flex items-center gap-1 h-6 px-2 rounded-md ds-mono text-[9px] text-zinc-400 hover:text-cyan-200 hover:bg-white/[0.06] transition-colors ds-focus"
              title="Recolher timeline (⌘3)"
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
