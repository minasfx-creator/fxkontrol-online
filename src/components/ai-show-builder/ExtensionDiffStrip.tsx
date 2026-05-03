/**
 * ExtensionDiffStrip — barra horizontal mostrando posição temporal dos cues
 * adicionados pela entry com hover ativo (extensionHighlight singleton).
 *
 * Pure presentation. Sem cliques, sem ações — apenas visualização do diff.
 */
import { useMemo } from 'react';
import { useExtensionHighlight } from '@/lib/aiShowBuilder/useExtensionHighlight';
import type { ShowPlan } from '@/lib/aiShowBuilder/types';

interface Props {
  plan: ShowPlan;
}

export default function ExtensionDiffStrip({ plan }: Props) {
  const highlight = useExtensionHighlight();

  const ticks = useMemo(() => {
    if (!highlight) return [];
    const duration = Math.max(0.001, plan.duration ?? 0);
    const items = plan.timelineItems ?? [];
    return items
      .filter((c) => highlight.cueIds.has(c.id))
      .map((c) => ({
        id: c.id,
        leftPct: Math.min(100, Math.max(0, (c.startTime / duration) * 100)),
        widthPct: c.duration
          ? Math.min(100, Math.max(0.4, (c.duration / duration) * 100))
          : 0.4,
      }));
  }, [highlight, plan]);

  if (!highlight || ticks.length === 0) return null;

  return (
    <div
      className="relative h-3 rounded-sm bg-background/60 border border-primary/30 overflow-hidden"
      role="img"
      aria-label={`${ticks.length} cues adicionados em destaque`}
      title={`${ticks.length} cues adicionados — visualização da extensão`}
    >
      {ticks.map((t) => (
        <div
          key={t.id}
          className="absolute top-0 bottom-0 bg-primary/70 animate-pulse"
          style={{ left: `${t.leftPct}%`, width: `${t.widthPct}%`, minWidth: 2 }}
        />
      ))}
    </div>
  );
}
