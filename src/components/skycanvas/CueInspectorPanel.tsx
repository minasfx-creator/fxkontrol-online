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

export default function CueInspectorPanel({ className }: CueInspectorPanelProps) {
  const cue = useProjectStore((s) =>
    s.selectedCueMarkerId
      ? s.cueMarkers.find((c) => c.id === s.selectedCueMarkerId) ?? null
      : null,
  );
  const duration = useProjectStore((s) => s.duration);
  const updateCueMarker = useProjectStore((s) => s.updateCueMarker);
  const removeCueMarker = useProjectStore((s) => s.removeCueMarker);
  const selectCueMarker = useProjectStore((s) => s.selectCueMarker);

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

  if (!cue) return null;

  const intensity = cue.intensity ?? 100;
  const quantity = cue.quantity ?? 1;
  const dur = cue.durationSec ?? 1;
  const heading = cue.heading ?? 0;
  const pitch = cue.pitch ?? 0;
  const pos = cue.position ?? { x: 0, y: 0, z: 0 };

  const laneLabel = lane === 'pyro' ? 'PYRO' : lane === 'drone' ? 'DRONE' : 'FORMATION';
  const laneColor = lane === 'pyro' ? 'border-amber-500/40 text-amber-300'
    : lane === 'drone' ? 'border-cyan-500/40 text-cyan-300'
    : 'border-violet-500/40 text-violet-300';

  return (
    <div
      className={cn(
        'pointer-events-auto select-none',
        'flex flex-col rounded-xl border border-cyan-500/15',
        'shadow-[0_8px_32px_rgba(0,0,0,0.7)]',
        'overflow-hidden',
        className,
      )}
      style={{
        background: 'rgba(5, 8, 16, 0.70)',
        backdropFilter: 'blur(20px) saturate(140%)',
        WebkitBackdropFilter: 'blur(20px) saturate(140%)',
        width: 320,
      }}
      role="dialog"
      aria-label="Inspetor de cue"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 h-10 border-b border-white/[0.06]">
        <span
          className="h-2.5 w-2.5 rounded-full shrink-0"
          style={{ background: cue.color, boxShadow: `0 0 6px ${cue.color}` }}
        />
        <div className="flex-1 min-w-0">
          <div className="ds-mono text-[10px] tracking-wider text-cyan-300/90 uppercase truncate">
            Cue · {cue.label}
          </div>
          <div className="ds-mono text-[9px] text-zinc-500 tabular-nums">
            {fmtTime(cue.time)} {fx ? `· ${fx.id}` : ''}
          </div>
        </div>
        <Badge variant="outline" className={cn('ds-mono text-[9px]', laneColor)}>
          {laneLabel}
        </Badge>
        <button
          type="button"
          onClick={() => selectCueMarker(null)}
          aria-label="Fechar inspector"
          className="inline-flex h-7 w-7 items-center justify-center rounded text-zinc-400 hover:text-cyan-200 hover:bg-white/[0.06]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-col gap-3 p-3 max-h-[60vh] overflow-y-auto">
        {/* Time */}
        <NumberField
          label="Tempo"
          value={cue.time}
          min={0}
          max={Math.max(0, duration)}
          step={0.01}
          suffix="s"
          onChange={(v) => patch('time', Math.max(0, Math.min(duration, v)))}
        />

        {/* Intensity */}
        <SliderField
          label="Intensidade"
          value={intensity}
          min={0}
          max={100}
          step={1}
          suffix="%"
          onChange={(v) => patch('intensity', v)}
        />

        {/* Quantity */}
        <SliderField
          label="Quantidade"
          value={quantity}
          min={1}
          max={lane === 'drone' || lane === 'formation' ? 500 : 64}
          step={1}
          onChange={(v) => patch('quantity', v)}
        />

        {/* Duration */}
        <NumberField
          label="Duração"
          value={dur}
          min={0.1}
          max={120}
          step={0.1}
          suffix="s"
          onChange={(v) => patch('durationSec', v)}
        />

        {/* Spatial controls (drones / formations) */}
        {showSpatial && (
          <div className="flex flex-col gap-2 pt-2 mt-1 border-t border-white/[0.06]">
            <div className="ds-mono text-[10px] tracking-wider text-cyan-300/80 uppercase">
              Espacial
            </div>
            <NumberField label="Pos X" value={pos.x} step={0.1} suffix="m"
              onChange={(v) => patchPos('x', v)} />
            <NumberField label="Pos Y" value={pos.y} step={0.1} suffix="m"
              onChange={(v) => patchPos('y', v)} />
            <NumberField label="Pos Z" value={pos.z} step={0.1} suffix="m"
              onChange={(v) => patchPos('z', v)} />
            <SliderField label="Heading" value={heading} min={0} max={360} step={1} suffix="°"
              onChange={(v) => patch('heading', v)} />
            <SliderField label="Pitch" value={pitch} min={-90} max={90} step={1} suffix="°"
              onChange={(v) => patch('pitch', v)} />
          </div>
        )}

        {/* Notes */}
        <div className="flex flex-col gap-1 pt-2 mt-1 border-t border-white/[0.06]">
          <span className="ds-mono text-[10px] tracking-wider text-zinc-400 uppercase">Notas</span>
          <textarea
            value={cue.notes ?? ''}
            onChange={(e) => patch('notes', e.target.value)}
            rows={2}
            placeholder="Observações operacionais…"
            className="w-full rounded bg-black/40 border border-white/10 px-2 py-1 ds-mono text-[11px] text-cyan-100 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-400/60 resize-none"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 px-3 h-10 border-t border-white/[0.06]">
        <span className="ds-mono text-[9px] text-zinc-500">
          SIM · ADVISORY · não-físico
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => { removeCueMarker(cue.id); }}
          className="h-7 px-2 text-rose-300 hover:text-rose-200 hover:bg-rose-500/10 ds-mono text-[10px]"
        >
          <Trash2 className="h-3 w-3 mr-1" /> Remover
        </Button>
      </div>
    </div>
  );
}
