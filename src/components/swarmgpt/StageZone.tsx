import { Eye, Layers3 } from 'lucide-react';
import { useProjectStore } from '@/store/useProjectStore';

/**
 * Stage zone — visual placeholder showing the active formation summary.
 * The real 3D viewport lives at /editor; this is an at-a-glance preview.
 */
export default function StageZone() {
  const formations = useProjectStore((s) => (s as any).droneFormations ?? []) as Array<{ id: string; name?: string; points?: unknown[] }>;
  const active = formations[formations.length - 1];
  const droneCount = active?.points?.length ?? 0;

  return (
    <section className="relative h-full glass-card-glow rounded-xl overflow-hidden">
      {/* Grid bg */}
      <div className="absolute inset-0 commander-grid-bg opacity-70 pointer-events-none" />

      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, transparent 40%, hsl(220 30% 1% / 0.55) 100%)' }}
      />

      {/* Top label */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 z-10">
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full glass-premium">
          <Eye className="w-3 h-3 text-[hsl(var(--fxk-cyan))]" />
          <span className="text-[9px] font-mono font-bold tracking-[0.18em] uppercase text-foreground">
            Stage Preview
          </span>
        </div>
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full glass-premium">
          <Layers3 className="w-3 h-3 text-muted-foreground" />
          <span className="text-[9px] font-mono text-muted-foreground">
            {formations.length} formation{formations.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {/* Center content */}
      <div className="relative z-10 h-full flex flex-col items-center justify-center px-6 text-center">
        {active ? (
          <>
            <div className="text-[10px] font-mono tracking-[0.2em] uppercase text-[hsl(var(--fxk-cyan))]">
              Active formation
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              {active.name ?? 'Untitled'}
            </div>
            <div className="mt-1 text-[11px] font-mono text-muted-foreground">
              {droneCount} drones · ready for timeline
            </div>
          </>
        ) : (
          <>
            <div className="w-12 h-12 rounded-full glass-core flex items-center justify-center mb-3">
              <Eye className="w-5 h-5 text-[hsl(var(--fxk-cyan))]" />
            </div>
            <div className="text-sm font-bold text-foreground">Stage clear</div>
            <div className="mt-1 text-[10px] font-mono text-muted-foreground max-w-xs">
              Use o gerador à direita para criar uma formação. O preview aparece aqui antes de aplicar ao editor.
            </div>
          </>
        )}
      </div>
    </section>
  );
}
