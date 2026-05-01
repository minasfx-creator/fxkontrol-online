/**
 * DmxHeatmapOverlay — floating glass HUD overlay showing per-universe
 * channel occupancy as a 32×16 heatmap grid. Pure read-only viz.
 *
 * Toggled via safetyOverlayStore.dmxHeatmapVisible. Refreshes on
 * ShowPlan changes via 1Hz polling (cheap; 512 channels × few universes).
 */
import { useEffect, useState, useMemo } from 'react';
import { buildDmxHeatmap, intensityToColor, type UniverseHeatmap } from '../dmx/dmxHeatmapData';
import { useSafetyOverlayStore } from '../safetyOverlayStore';
import { X } from 'lucide-react';

const CELL = 8;
const COLS = 32;
const ROWS = 16; // 32 * 16 = 512

function UniverseGrid({ data }: { data: UniverseHeatmap }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[9px] font-mono uppercase tracking-wider">
        <span className="text-cyan-300/80">U{data.universe}</span>
        <span className="text-muted-foreground/60">
          {data.channelsUsed}/512 · hot ch{data.hottestChannel} ({Math.round(data.hottestValue * 100)}%)
        </span>
      </div>
      <svg
        width={COLS * CELL}
        height={ROWS * CELL}
        className="rounded border border-cyan-500/15 bg-[#020407]"
        shapeRendering="crispEdges"
      >
        {Array.from({ length: 512 }).map((_, i) => {
          const x = (i % COLS) * CELL;
          const y = Math.floor(i / COLS) * CELL;
          const v = data.intensities[i];
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={CELL - 1}
              height={CELL - 1}
              fill={intensityToColor(v)}
            >
              <title>{`Ch ${i + 1} — ${Math.round(v * 100)}%`}</title>
            </rect>
          );
        })}
      </svg>
    </div>
  );
}

export default function DmxHeatmapOverlay() {
  const visible = useSafetyOverlayStore((s) => s.dmxHeatmapVisible);
  const setVisible = useSafetyOverlayStore((s) => s.setDmxHeatmap);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [visible]);

  const universes = useMemo<UniverseHeatmap[]>(() => {
    if (!visible) return [];
    try {
      return buildDmxHeatmap();
    } catch {
      return [];
    }
    // tick is intentionally a dep to refresh the snapshot
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, tick]);

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-20 right-4 z-40 max-h-[60vh] overflow-auto rounded-lg border border-cyan-500/20 bg-[#050810]/95 backdrop-blur-md p-3 shadow-2xl shadow-cyan-500/10"
      style={{ width: COLS * CELL + 28 }}
    >
      <div className="flex items-center justify-between mb-2 pb-2 border-b border-cyan-500/15">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
          DMX Heatmap
        </div>
        <button
          onClick={() => setVisible(false)}
          className="h-5 w-5 inline-flex items-center justify-center rounded text-muted-foreground/70 hover:text-foreground hover:bg-muted/30"
          title="Close"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      {universes.length === 0 ? (
        <div className="text-[10px] text-muted-foreground py-6 text-center">
          No DMX cues or fixtures patched.
        </div>
      ) : (
        <div className="space-y-3">
          {universes.map((u) => (
            <UniverseGrid key={u.universe} data={u} />
          ))}
        </div>
      )}
      <div className="mt-3 pt-2 border-t border-cyan-500/15 flex items-center gap-2 text-[8px] uppercase tracking-wider text-muted-foreground/70">
        <span>Idle</span>
        <div className="flex h-2 flex-1 rounded-sm overflow-hidden">
          {[0, 0.2, 0.4, 0.6, 0.8, 1].map((v) => (
            <div key={v} className="flex-1" style={{ background: intensityToColor(v) }} />
          ))}
        </div>
        <span>Hot</span>
      </div>
    </div>
  );
}
