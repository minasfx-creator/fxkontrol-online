import { Cpu, Layers, Shield, AlertTriangle, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const ACTIVE_TECH = [
  { label: 'SwarmGPT Pipeline', detail: 'refiner → planner → critic → enhancer' },
  { label: 'VVIZ Streaming Engine', detail: 'Zero-GC, 2000+ drones' },
  { label: 'WebGPU Unified Kernel', detail: 'WGSL v3 single-pass' },
  { label: 'ShowPlan Source of Truth', detail: 'canonical entity' },
];

const LEGACY_TECH = [
  'Manual Formation Editor (panel)',
  'Editor SwarmGPT Modal (duplicate)',
  'Dashboard Quick Generator (legacy)',
];

const SAFETY_LAYERS = [
  'Geometry validator (min distance)',
  'Timing validator (overlap/gaps)',
  'Schema validator (Zod)',
  'Referential integrity (transitions)',
];

export default function CorePanel() {
  return (
    <aside className="flex flex-col gap-3 p-3 overflow-y-auto h-full">
      {/* Core */}
      <section className="glass-core rounded-xl p-3.5">
        <header className="flex items-center gap-2 mb-2.5">
          <Cpu className="w-3.5 h-3.5 text-[hsl(var(--fxk-cyan))]" />
          <h2 className="text-[10px] font-black tracking-[0.18em] uppercase text-foreground">
            SwarmGPT Core
          </h2>
        </header>
        <p className="text-[10px] leading-relaxed text-muted-foreground font-mono">
          Coreografia governada por pipeline de IA com validação geométrica e temporal.
          Saída compilada para timeline canônica do ShowPlan.
        </p>
      </section>

      {/* Active tech */}
      <section className="glass-card-glow rounded-xl p-3.5">
        <header className="flex items-center gap-2 mb-2.5">
          <Layers className="w-3.5 h-3.5 text-[hsl(var(--fxk-cyan))]" />
          <h2 className="text-[10px] font-black tracking-[0.18em] uppercase text-foreground">
            Tecnologias Ativas
          </h2>
        </header>
        <ul className="space-y-1.5">
          {ACTIVE_TECH.map((t) => (
            <li key={t.label} className="flex items-start gap-2 text-[10px] leading-tight">
              <Check className="w-3 h-3 mt-0.5 text-[hsl(var(--fxk-green))] shrink-0" />
              <div className="min-w-0">
                <div className="font-semibold text-foreground truncate">{t.label}</div>
                <div className="text-[9px] font-mono text-muted-foreground truncate">{t.detail}</div>
              </div>
            </li>
          ))}
          {LEGACY_TECH.map((t) => (
            <li key={t} className="flex items-start gap-2 text-[10px] leading-tight opacity-50">
              <span className="w-3 h-3 mt-0.5 rounded-full bg-muted shrink-0" />
              <span className={cn('font-mono text-[9px] line-through text-muted-foreground truncate')}>
                {t}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Safety */}
      <section className="glass-warn rounded-xl p-3.5">
        <header className="flex items-center gap-2 mb-2.5">
          <Shield className="w-3.5 h-3.5 text-[hsl(var(--fxk-amber))]" />
          <h2 className="text-[10px] font-black tracking-[0.18em] uppercase text-foreground">
            Safety Layer
          </h2>
        </header>
        <ul className="space-y-1.5">
          {SAFETY_LAYERS.map((s) => (
            <li key={s} className="flex items-start gap-2 text-[10px] text-muted-foreground font-mono">
              <AlertTriangle className="w-3 h-3 mt-0.5 text-[hsl(var(--fxk-amber))] shrink-0" />
              <span className="truncate">{s}</span>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
