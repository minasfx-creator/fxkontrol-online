/**
 * CueInspectorPanel — Painel de propriedades do cue selecionado.
 *
 * Plano: Show / Experience. ZERO CommandBus / FieldBus / SafetyStateMachine.
 *
 * Aparece como dock glassmorphism flutuante no canto direito do viewport
 * SkyCanvas quando há um cue selecionado (via clique no marker da régua
 * ou no chip da lane). Edita propriedades semânticas:
 *   • Tempo (s)
 *   • Intensidade (0..100%)
 *   • Quantidade (shells / drones / beams)
 *   • Duração (s)
 *   • Posição XYZ (drone / formation)
 *   • Heading 0..360° (drone / formation)
 *   • Pitch -90..+90°
 *   • Notas operacionais (textarea)
 *
 * Tudo persistido via useProjectStore.updateCueMarker (canonical).
 */
import { useCallback, useMemo } from 'react';
import { X, Trash2 } from 'lucide-react';
import { useProjectStore } from '@/store/useProjectStore';
import { resolveEffectLedAccurate } from '@/data/effectsLibraries/resolveEffect';
import { EFFECT_LIBRARY } from '@/data/effectLibrary';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { CueMarker } from '@/types/projectTypes';

export interface CueInspectorPanelProps {
  className?: string;
  /** When true, fills the parent (full-height rail dock). Default: floating card. */
  docked?: boolean;
}

function fmtTime(s: number) {
  const a = Math.max(0, s);
  const mm = Math.floor(a / 60).toString().padStart(2, '0');
  const ss = Math.floor(a % 60).toString().padStart(2, '0');
  const ms = Math.floor((a % 1) * 1000).toString().padStart(3, '0');
  return `${mm}:${ss}.${ms}`;
}

function classifyLane(cue: CueMarker): 'pyro' | 'drone' | 'formation' {
  if (cue.lane) return cue.lane;
  const lbl = (cue.label ?? '').toLowerCase();
  if (lbl.includes('· formation') || lbl.includes('formation')) return 'formation';
  if (lbl.includes('· drone') || lbl.includes('drone')) return 'drone';
  return 'pyro';
}

function NumberField({
  label, value, min, max, step, suffix, onChange,
}: {
  label: string; value: number; min?: number; max?: number; step?: number; suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-[11px]">
      <span className="ds-mono text-zinc-400 uppercase tracking-wider w-24 shrink-0">{label}</span>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        max={max}
        step={step ?? 0.01}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange(v);
        }}
        className="flex-1 min-w-0 h-7 px-2 rounded bg-black/40 border border-white/10 ds-mono text-[11px] text-cyan-100 tabular-nums focus:outline-none focus:border-cyan-400/60"
      />
      {suffix && <span className="ds-mono text-[10px] text-zinc-500 w-6 text-right">{suffix}</span>}
    </label>
  );
}

function SliderField({
  label, value, min, max, step, suffix, onChange,
}: {
  label: string; value: number; min: number; max: number; step?: number; suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="ds-mono text-zinc-400 uppercase tracking-wider w-24 shrink-0">{label}</span>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step ?? 1}
        onValueChange={(v) => onChange(v[0] ?? value)}
        className="flex-1"
      />
      <span className="ds-mono text-[10px] text-cyan-200 tabular-nums w-12 text-right">
        {value.toFixed(step && step < 1 ? 2 : 0)}{suffix ?? ''}
      </span>
    </div>
  );
}

export default function CueInspectorPanel({ className, docked = false }: CueInspectorPanelProps) {
  const cue = useProjectStore((s) =>
    s.selectedCueMarkerId
      ? s.cueMarkers.find((c) => c.id === s.selectedCueMarkerId) ?? null
      : null,
  );
  const duration = useProjectStore((s) => s.duration);
  const updateCueMarker = useProjectStore((s) => s.updateCueMarker);
  const removeCueMarker = useProjectStore((s) => s.removeCueMarker);
  const selectCueMarker = useProjectStore((s) => s.selectCueMarker);
  const addCueMarker = useProjectStore((s) => s.addCueMarker);

  const fx = useMemo(() => {
    if (!cue?.effectId) return null;
    return resolveEffectLedAccurate(cue.effectId)
      ?? EFFECT_LIBRARY.find((e) => e.id === cue.effectId)
      ?? null;
  }, [cue?.effectId]);

  const lane = cue ? classifyLane(cue) : 'pyro';
  const showSpatial = cue ? (lane === 'drone' || lane === 'formation') : false;

  const patch = useCallback(<K extends keyof CueMarker>(k: K, v: CueMarker[K]) => {
    if (!cue) return;
    updateCueMarker(cue.id, { [k]: v } as Partial<CueMarker>);
  }, [cue, updateCueMarker]);

  const patchPos = useCallback((axis: 'x' | 'y' | 'z', v: number) => {
    if (!cue) return;
    const cur = cue.position ?? { x: 0, y: 0, z: 0 };
    updateCueMarker(cue.id, { position: { ...cur, [axis]: v } });
  }, [cue, updateCueMarker]);

  if (!cue) {
    if (!docked) return null;
    return (
      <div
        className={cn(
          'pointer-events-auto select-none flex flex-col items-center justify-center text-center',
          'rounded-xl border border-cyan-500/10 h-full w-full',
          className,
        )}
        style={{
          background: 'rgba(5, 8, 16, 0.55)',
          backdropFilter: 'blur(20px) saturate(140%)',
          WebkitBackdropFilter: 'blur(20px) saturate(140%)',
        }}
      >
        <div className="px-6 animate-fade-in">
          <div className="mx-auto mb-3 h-10 w-10 rounded-full border border-cyan-500/30 bg-cyan-500/5 flex items-center justify-center">
            <span className="ds-mono text-[14px] text-cyan-400/70">⊕</span>
          </div>
          <div className="ds-mono text-[10px] tracking-[0.18em] text-cyan-300/80 uppercase">
            Cue Inspector
          </div>
          <p className="mt-2 ds-mono text-[10px] text-zinc-500 leading-relaxed max-w-[220px]">
            Selecione um cue na timeline ou arraste um efeito da biblioteca para inspecionar e ajustar suas propriedades.
          </p>
          <p className="mt-3 ds-mono text-[9px] text-zinc-600">
            Atalho: <span className="text-cyan-400/70">I</span> para mostrar/esconder
          </p>
        </div>
      </div>
    );
  }

  const intensity = cue.intensity ?? 100;
  const quantity = cue.quantity ?? 1;
  const dur = cue.durationSec ?? 1;
  const heading = cue.heading ?? 0;
  const pitch = cue.pitch ?? 0;
  const pos = cue.position ?? { x: 0, y: 0, z: 0 };

  const laneLabel = lane === 'pyro' ? 'PYRO' : lane === 'drone' ? 'DRONE' : 'FORMATION';
  const laneColor = lane === 'pyro' ? 'border-amber-500/40 text-amber-300 bg-amber-500/10'
    : lane === 'drone' ? 'border-cyan-500/40 text-cyan-300 bg-cyan-500/10'
    : 'border-violet-500/40 text-violet-300 bg-violet-500/10';

  const snapToPlayhead = () => patch('time', useProjectStore.getState().currentTime);
  const duplicate = () => {
    addCueMarker({
      ...cue,
      id: `cue-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      time: Math.min(duration, cue.time + 0.5),
    });
  };

  return (
    <div
      className={cn(
        'pointer-events-auto select-none animate-fade-in',
        'flex flex-col rounded-xl border border-cyan-500/15',
        'shadow-[0_8px_32px_rgba(0,0,0,0.7)]',
        'overflow-hidden',
        docked ? 'h-full w-full' : '',
        className,
      )}
      style={{
        background: 'rgba(5, 8, 16, 0.72)',
        backdropFilter: 'blur(20px) saturate(140%)',
        WebkitBackdropFilter: 'blur(20px) saturate(140%)',
        ...(docked ? {} : { width: 320 }),
      }}
      role="dialog"
      aria-label="Inspetor de cue"
    >
      <div className="relative">
        <div
          className="absolute inset-x-0 top-0 h-px"
          style={{ background: `linear-gradient(90deg, transparent, ${cue.color}, transparent)` }}
        />
        <div className="flex items-center gap-2 px-3 h-12 border-b border-white/[0.06]">
          <span
            className="h-3 w-3 rounded-full shrink-0 ring-2 ring-white/5"
            style={{ background: cue.color, boxShadow: `0 0 10px ${cue.color}` }}
          />
          <div className="flex-1 min-w-0">
            <div className="ds-mono text-[11px] tracking-wide text-cyan-100 truncate font-semibold">
              {cue.label}
            </div>
            <div className="ds-mono text-[9px] text-zinc-500 tabular-nums truncate">
              {fmtTime(cue.time)} {fx ? `· ${fx.id}` : ''}
            </div>
          </div>
          <Badge variant="outline" className={cn('ds-mono text-[9px] tracking-wider', laneColor)}>
            {laneLabel}
          </Badge>
          <button
            type="button"
            onClick={() => selectCueMarker(null)}
            aria-label="Fechar inspector"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:text-cyan-200 hover:bg-white/[0.06] ds-focus transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1 px-3 py-2 border-b border-white/[0.04]">
        <button
          type="button"
          onClick={snapToPlayhead}
          className="flex-1 h-7 rounded-md ds-mono text-[9px] tracking-wider uppercase border border-white/10 text-zinc-300 hover:text-cyan-200 hover:border-cyan-500/40 hover:bg-cyan-500/10 transition-all ds-focus"
          title={`Mover para o playhead (${fmtTime(currentTime)})`}
        >
          ⇥ Snap Playhead
        </button>
        <button
          type="button"
          onClick={duplicate}
          className="flex-1 h-7 rounded-md ds-mono text-[9px] tracking-wider uppercase border border-white/10 text-zinc-300 hover:text-cyan-200 hover:border-cyan-500/40 hover:bg-cyan-500/10 transition-all ds-focus"
          title="Duplicar cue (Ctrl/Cmd+D · +0.5s)"
        >
          ⧉ Duplicate
        </button>
      </div>
      <div
        className="px-3 py-1.5 border-b border-white/[0.04] ds-mono text-[8.5px] text-zinc-500 tracking-wider flex flex-wrap gap-x-2 gap-y-0.5"
        aria-label="Atalhos do cue selecionado"
      >
        <span><Kbd>⌘D</Kbd> dup</span>
        <span><Kbd>⌘C</Kbd>/<Kbd>⌘X</Kbd>/<Kbd>⌘V</Kbd></span>
        <span><Kbd>⌫</Kbd> del</span>
        <span><Kbd>←</Kbd>/<Kbd>→</Kbd> ±0.05s</span>
        <span><Kbd>⇧+←/→</Kbd> ±0.5s</span>
      </div>



      <div className={cn(
        'flex flex-col gap-3 p-3 overflow-y-auto',
        docked ? 'flex-1' : 'max-h-[60vh]',
      )}>
        <Section title="Tempo & Energia">
          <NumberField
            label="Tempo" value={cue.time} min={0} max={Math.max(0, duration)} step={0.01} suffix="s"
            onChange={(v) => patch('time', Math.max(0, Math.min(duration, v)))}
          />
          <SliderField label="Intensidade" value={intensity} min={0} max={100} step={1} suffix="%"
            onChange={(v) => patch('intensity', v)} />
          <SliderField label="Quantidade" value={quantity} min={1}
            max={lane === 'drone' || lane === 'formation' ? 500 : 64} step={1}
            onChange={(v) => patch('quantity', v)} />
          <NumberField label="Duração" value={dur} min={0.1} max={120} step={0.1} suffix="s"
            onChange={(v) => patch('durationSec', v)} />
        </Section>

        {showSpatial && (
          <Section title="Espacial">
            <NumberField label="Pos X" value={pos.x} step={0.1} suffix="m" onChange={(v) => patchPos('x', v)} />
            <NumberField label="Pos Y" value={pos.y} step={0.1} suffix="m" onChange={(v) => patchPos('y', v)} />
            <NumberField label="Pos Z" value={pos.z} step={0.1} suffix="m" onChange={(v) => patchPos('z', v)} />
            <SliderField label="Heading" value={heading} min={0} max={360} step={1} suffix="°"
              onChange={(v) => patch('heading', v)} />
            <SliderField label="Pitch" value={pitch} min={-90} max={90} step={1} suffix="°"
              onChange={(v) => patch('pitch', v)} />
          </Section>
        )}

        <Section title="Notas">
          <textarea
            value={cue.notes ?? ''}
            onChange={(e) => patch('notes', e.target.value)}
            rows={3}
            placeholder="Observações operacionais…"
            className="w-full rounded-md bg-black/40 border border-white/10 px-2 py-1.5 ds-mono text-[11px] text-cyan-100 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-400/60 resize-none transition-colors"
          />
        </Section>
      </div>

      <div className="flex items-center justify-between gap-2 px-3 h-10 border-t border-white/[0.06] bg-black/20">
        <span className="ds-mono text-[9px] text-zinc-500 tracking-wider">SIM · ADVISORY</span>
        <Button
          type="button" variant="ghost" size="sm"
          onClick={() => { removeCueMarker(cue.id); }}
          className="h-7 px-2 text-rose-300 hover:text-rose-200 hover:bg-rose-500/10 ds-mono text-[10px]"
        >
          <Trash2 className="h-3 w-3 mr-1" /> Remover
        </Button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="ds-mono text-[9px] tracking-[0.18em] text-cyan-300/70 uppercase pb-1 border-b border-white/[0.04]">
        {title}
      </div>
      {children}
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center rounded border border-white/15 bg-black/40 px-1 py-px ds-mono text-[8.5px] text-cyan-200 leading-none">
      {children}
    </kbd>
  );
}
