import { useEffect, useState } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { viewportToolRegistry } from '@/features/viewport-tools/registry';
import {
  getSelectionSegmentSummary,
  filterSelectionBySegment,
} from '@/features/viewport-tools/selection-engine';
import SegmentToolButton from './SegmentToolButton';
import type { SegmentType } from '@/features/viewport-tools/types';
import { Button } from '@/components/ui/button';

interface Props {
  segment: SegmentType;
}

/**
 * ViewportToolPanel — dynamic side panel for the active segment.
 * Lists tools grouped by scope and shows a summary of the current
 * selection. Mixed-selection mode exposes per-segment "Filter to ..."
 * actions per the design spec.
 */
export default function ViewportToolPanel({ segment }: Props) {
  const plugin = viewportToolRegistry.get(segment);
  // Re-render on selection changes so requiresSelection is honored.
  const selectedIds = useProjectStore((s) => s.selectedPositionIds);
  const [, force] = useState(0);

  useEffect(() => viewportToolRegistry.subscribe(() => force((n) => n + 1)), []);

  if (!plugin) {
    return (
      <div className="p-3 text-xs text-muted-foreground">
        No plugin registered for {segment}.
      </div>
    );
  }

  const summary = getSelectionSegmentSummary();
  const groups = new Map<string, typeof plugin.tools>();
  for (const t of plugin.tools) {
    const arr = groups.get(t.scope) ?? [];
    arr.push(t);
    groups.set(t.scope, arr);
  }

  const selectionForSegment = summary.bySegment[segment];

  return (
    <div className="flex flex-col gap-3 p-3 bg-[#050810]/95 border-l border-cyan-500/20 min-w-[260px]">
      <header className="flex items-center justify-between">
        <h3 className="text-xs font-semibold tracking-wider text-cyan-400">
          {segment} TOOLS
        </h3>
        <span className="text-[10px] text-muted-foreground">
          {selectionForSegment} sel.
        </span>
      </header>

      {summary.hasMixed && (
        <div className="rounded border border-amber-500/40 bg-amber-500/5 p-2 text-[11px] text-amber-300 space-y-2">
          <div>Mixed selection detected ({summary.total} items).</div>
          <Button
            size="sm"
            variant="outline"
            className="h-7 w-full text-[11px]"
            onClick={() => filterSelectionBySegment(segment)}
          >
            Filter to {segment}
          </Button>
        </div>
      )}

      {Array.from(groups.entries()).map(([scope, tools]) => (
        <section key={scope} className="space-y-1.5">
          <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {scope}
          </h4>
          <div className="flex flex-col gap-1">
            {tools.map((t) => (
              <SegmentToolButton
                key={t.id}
                tool={t}
                disabled={t.requiresSelection && selectedIds.length === 0}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
