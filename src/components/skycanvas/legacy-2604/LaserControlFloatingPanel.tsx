/**
 * LaserControlFloatingPanel — recreates the right-side LASER CONTROL panel
 * from the 9-Apr bookmark. Bound to useLaserPreviewStore (visual only).
 *
 * Draggable. NEVER opens hardware connections, NEVER calls
 * uiCommandGateway. Pure presentation.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Zap, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLaserPreviewStore } from '@/store/useLaserPreviewStore';

interface Props {
  open: boolean;
  onClose: () => void;
}

const HARDWARE_PRESETS = [
  { id: 'none',         label: 'Generic' },
  { id: 'maiman16',     label: 'Maiman 16CH' },
  { id: 'maiman39',     label: 'Maiman 39CH' },
  { id: 'kvant',        label: 'Kvant Spectrum' },
  { id: 'lps',          label: 'LPS Lasersysteme' },
] as const;

const PATTERNS = [
  { id: 'fan',     label: 'Fan Array' },
  { id: 'single',  label: 'Single Beam' },
  { id: 'wave',    label: 'Wave' },
  { id: 'tunnel',  label: 'Tunnel' },
  { id: 'cone',    label: 'Cone' },
  { id: 'harp',    label: 'Harp' },
  { id: 'grid',    label: 'Grid' },
] as const;

const COLORS = [
  '#22c55e', '#ef4444', '#34d399', '#3b82f6', '#22d3ee', '#ec4899', '#facc15',
  '#0ea5e9', '#fb923c', '#a855f7', '#ffffff', '#10b981', '#f43f5e', '#0284c7',
];

export default function LaserControlFloatingPanel({ open, onClose }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const dragOrigin = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: -340, y: 70 });
  // pos.x is right-anchored offset (negative = inside viewport from right)

  const sources = useLaserPreviewStore((s) => s.sources);
  const updateDefault = useLaserPreviewStore((s) => s.updateDefaultSource);
  const globalEnabled = useLaserPreviewStore((s) => s.globalEnabled);
  const setGlobalEnabled = useLaserPreviewStore((s) => s.setGlobalEnabled);

  const def = useMemo(() => sources.find((s) => s.id === 'default') ?? sources[0], [sources]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragOrigin.current) return;
      const dx = e.clientX - dragOrigin.current.x;
      const dy = e.clientY - dragOrigin.current.y;
      setPos({ x: dragOrigin.current.ox + dx, y: Math.max(50, dragOrigin.current.oy + dy) });
    };
    const onUp = () => { dragOrigin.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  if (!open || !def) return null;

  const panelStyle: React.CSSProperties = pos.x < 0
    ? { right: -pos.x, top: pos.y }
    : { left: pos.x, top: pos.y };

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Laser Control"
      style={panelStyle}
      className={cn(
        'absolute z-40 w-[320px] select-none',
        'bg-zinc-950/95 backdrop-blur-xl border border-cyan-500/15 rounded-xl shadow-2xl',
      )}
    >
      {/* Header — drag handle */}
      <div
        onMouseDown={(e) => {
          dragOrigin.current = { x: e.clientX, y: e.clientY, ox: pos.x, oy: pos.y };
        }}
        className="flex items-center justify-between h-10 px-3 border-b border-cyan-500/10 cursor-grab active:cursor-grabbing"
      >
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-emerald-400" aria-hidden="true" />
          <span className="ds-mono text-[11px] uppercase tracking-wider text-zinc-200">Laser Control</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="h-7 w-7 rounded-md flex items-center justify-center text-zinc-500 hover:text-rose-300 hover:bg-rose-500/10 transition-colors ds-focus"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-3 space-y-3 max-h-[calc(100vh-160px)] overflow-y-auto">
        {/* 3D Viewport switch */}
        <div className="flex items-center justify-between">
          <span className="ds-mono text-[11px] uppercase tracking-wider text-zinc-300">3D Viewport</span>
          <button
            type="button"
            role="switch"
            aria-checked={globalEnabled}
            onClick={() => setGlobalEnabled(!globalEnabled)}
            className={cn(
              'h-5 w-9 rounded-full relative transition-colors ds-focus',
              globalEnabled ? 'bg-cyan-500/60' : 'bg-zinc-700',
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform',
                globalEnabled ? 'translate-x-4' : 'translate-x-0.5',
              )}
            />
          </button>
        </div>

        {/* HARDWARE PRESET */}
        <Section label="Hardware Preset" icon="◎">
          <select
            value={def.hwPreset}
            onChange={(e) => updateDefault({ hwPreset: e.target.value })}
            className="w-full h-9 px-2 rounded-md bg-zinc-900 border border-white/10 text-zinc-200 ds-mono text-[12px] focus:border-cyan-500/40 outline-none"
          >
            {HARDWARE_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </Section>

        {/* PATTERN */}
        <Section label="Pattern">
          <select
            value={def.pattern}
            onChange={(e) => updateDefault({ pattern: e.target.value })}
            className="w-full h-9 px-2 rounded-md bg-zinc-900 border border-white/10 text-zinc-200 ds-mono text-[12px] focus:border-cyan-500/40 outline-none"
          >
            {PATTERNS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </Section>

        {/* BEAM COLOR */}
        <Section label="Beam Color">
          <div className="grid grid-cols-7 gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => updateDefault({ color: c })}
                aria-label={`Cor ${c}`}
                className={cn(
                  'h-7 w-7 rounded-sm border-2 transition-all ds-focus',
                  def.color.toLowerCase() === c.toLowerCase()
                    ? 'border-white scale-110 shadow-[0_0_8px_-1px_currentColor]'
                    : 'border-white/10 hover:border-white/30',
                )}
                style={{ backgroundColor: c, color: c }}
              />
            ))}
          </div>
        </Section>

        {/* PAN / TILT */}
        <div className="grid grid-cols-2 gap-3">
          <SliderField
            label="Pan"
            value={def.pan}
            min={-180}
            max={180}
            unit="°"
            onChange={(v) => updateDefault({ pan: v })}
          />
          <SliderField
            label="Tilt"
            value={def.tilt}
            min={-90}
            max={90}
            unit="°"
            onChange={(v) => updateDefault({ tilt: v })}
          />
        </div>

        {/* INTENSITY */}
        <SliderField
          label="Intensity"
          value={def.intensity}
          min={0}
          max={100}
          unit="%"
          onChange={(v) => updateDefault({ intensity: v })}
          accent="amber"
        />
      </div>
    </div>
  );
}

function Section({ label, icon, children }: { label: string; icon?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        {icon && <span className="text-cyan-400 text-[10px]">{icon}</span>}
        <span className="ds-mono text-[10px] uppercase tracking-wider text-zinc-400">{label}</span>
      </div>
      {children}
    </div>
  );
}

function SliderField({
  label, value, min, max, unit, onChange, accent = 'amber',
}: {
  label: string;
  value: number;
  min: number; max: number;
  unit: string;
  onChange: (v: number) => void;
  accent?: 'amber' | 'cyan';
}) {
  const accentClr = accent === 'amber' ? '#FF7700' : '#22d3ee';
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="ds-mono text-[10px] uppercase tracking-wider text-zinc-400">{label}</span>
        <span className="ds-mono text-[10px] tabular-nums text-amber-300">
          {Math.round(value)}{unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="w-full h-1.5 appearance-none rounded-full cursor-pointer ds-focus"
        style={{
          background: `linear-gradient(to right, ${accentClr} 0%, ${accentClr} ${pct}%, rgba(255,255,255,0.08) ${pct}%, rgba(255,255,255,0.08) 100%)`,
        }}
      />
    </div>
  );
}
