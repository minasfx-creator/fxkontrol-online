import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { viewportToolRegistry } from '@/features/viewport-tools/registry';
import { operationLog } from '@/features/viewport-tools/command-dispatcher';
import { useProjectStore } from '@/store/useProjectStore';
import { effectVariantStore } from '@/features/viewport-tools/effectVariants';
import ViewportToolPanel from './ViewportToolPanel';
import EffectConfigDialog from './EffectConfigDialog';
import DroneConfigDialog from './DroneConfigDialog';
import VdlPickerDialog from './VdlPickerDialog';
import type { SegmentType } from '@/features/viewport-tools/types';

// Side-effect import: registers all 5 segment plugins exactly once.
import '@/features/viewport-tools/segments/registerAll';

const SEGMENTS: SegmentType[] = ['PYRO', 'SFX', 'DRONES', 'LIGHT', 'DMX'];

export type ViewportSegmentToolbarOrientation = 'horizontal-top' | 'vertical-right';

interface Props {
  /** Optional initial segment. Defaults to PYRO. */
  defaultSegment?: SegmentType;
  /** Layout. 'horizontal-top' (default) keeps legacy top-center bar.
   *  'vertical-right' renders a thin retractable glass dock on the right edge. */
  orientation?: ViewportSegmentToolbarOrientation;
}

/**
 * ViewportSegmentToolbar — segment switcher for viewport tools.
 * Selecting a segment opens the corresponding ViewportToolPanel as an
 * overlay. Undo button drives the operationLog.
 *
 * Visual: Mission Control / Vantablack palette, Cyan = active segment.
 */
export default function ViewportSegmentToolbar({
  defaultSegment = 'PYRO',
  orientation = 'horizontal-top',
}: Props) {
  const [active, setActive] = useState<SegmentType | null>(defaultSegment);
  const [collapsed, setCollapsed] = useState(false);
  const [, force] = useState(0);

  // Effect/Drone config dialog state
  const [effectDialog, setEffectDialog] = useState<{
    open: boolean;
    effectId: string | null;
    timelineItemId: string | null;
  }>({ open: false, effectId: null, timelineItemId: null });
  const [droneDialog, setDroneDialog] = useState<{ open: boolean; positionId: string | null }>({
    open: false,
    positionId: null,
  });
  const [vdlDialog, setVdlDialog] = useState<{ open: boolean; timelineItemId: string | null }>({
    open: false,
    timelineItemId: null,
  });

  useEffect(() => operationLog.subscribe(() => force((n) => n + 1)), []);
  useEffect(() => viewportToolRegistry.subscribe(() => force((n) => n + 1)), []);

  // Bridge CustomEvents from plugin handlers → dialog state.
  useEffect(() => {
    const onEffect = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        effectId: string;
        timelineItemId: string | null;
      };
      setEffectDialog({
        open: true,
        effectId: detail.effectId,
        timelineItemId: detail.timelineItemId,
      });
    };
    const onDrone = (e: Event) => {
      const detail = (e as CustomEvent).detail as { positionId: string };
      setDroneDialog({ open: true, positionId: detail.positionId });
    };
    const onVdl = (e: Event) => {
      const detail = (e as CustomEvent).detail as { timelineItemId: string | null };
      setVdlDialog({ open: true, timelineItemId: detail.timelineItemId });
    };
    window.addEventListener('viewport-tools:open-effect-config', onEffect);
    window.addEventListener('viewport-tools:open-drone-config', onDrone);
    window.addEventListener('viewport-tools:open-vdl-picker', onVdl);
    return () => {
      window.removeEventListener('viewport-tools:open-effect-config', onEffect);
      window.removeEventListener('viewport-tools:open-drone-config', onDrone);
      window.removeEventListener('viewport-tools:open-vdl-picker', onVdl);
    };
  }, []);

  const undo = () => {
    const op = operationLog.popUndo();
    if (!op) return;
    // Reverse known operations. Unknown ops just pop from the stack.
    if (op.command === 'PYRO_TIME_OFFSET' && (op.before as { items?: unknown[] })?.items) {
      const before = (op.before as { items: import('@/types/projectTypes').TimelineItem[] }).items;
      const map = new Map(before.map((b) => [b.id, b]));
      useProjectStore.setState((s) => ({
        timelineItems: s.timelineItems.map((it) => map.get(it.id) ?? it),
      }));
    } else if (op.command === 'PYRO_MIRROR_CLONE') {
      const ids = new Set((op.after as { clonedIds: string[] }).clonedIds);
      useProjectStore.setState((s) => ({
        timelineItems: s.timelineItems.filter((it) => !ids.has(it.id)),
      }));
    } else if (op.command === 'PYRO_SELECT_ALL' || op.command === 'DRONES_SELECT_ALL' || op.command === 'LIGHT_SELECT_ALL') {
      const before = (op.before as { selection: string[] }).selection;
      useProjectStore.getState().selectMultiplePositions(before);
    } else if (op.command === 'DRONES_FORMATION_CIRCLE') {
      const before = (op.before as { positions: import('@/types/projectTypes').Position[] }).positions;
      const map = new Map(before.map((b) => [b.id, b]));
      useProjectStore.setState((s) => ({
        positions: s.positions.map((p) => map.get(p.id) ?? p),
      }));
    } else if (op.command === 'PYRO_OVERRIDE_CUE') {
      const before = (op.before as { item: import('@/types/projectTypes').TimelineItem }).item;
      useProjectStore.setState((s) => ({
        timelineItems: s.timelineItems.map((it) => (it.id === before.id ? before : it)),
      }));
    } else if (op.command === 'PYRO_VARIANT_SAVE') {
      const variantId = (op.after as { variantId: string }).variantId;
      effectVariantStore.remove(variantId);
    } else if (op.command === 'DRONES_UPDATE_POSITION') {
      const before = (op.before as { position: import('@/types/projectTypes').Position }).position;
      useProjectStore.getState().updatePosition(before.id, before);
    } else if (op.command === 'DRONES_UPDATE_FORMATION') {
      const before = (op.before as { formation: import('@/types/projectTypes').DroneFormation }).formation;
      useProjectStore.getState().updateDroneFormation(before.id, before);
    } else if (op.command === 'DRONES_CREATE_FORMATION') {
      const formationId = (op.after as { formationId: string }).formationId;
      useProjectStore.getState().removeDroneFormation(formationId);
    } else if (op.command === 'PYRO_VDL_PICK') {
      const before = (op.before as { item: import('@/types/projectTypes').TimelineItem }).item;
      useProjectStore.setState((s) => ({
        timelineItems: s.timelineItems.map((it) => (it.id === before.id ? before : it)),
      }));
    } else if (op.command === 'PYRO_TOGGLE_SAFETY_OVERLAY') {
      // Restore previous visibility state.
      const before = (op.before as { visible: boolean }).visible;
      // Lazy import to avoid circular ref.
      import('@/features/viewport-tools/safetyOverlayStore').then((m) =>
        m.useSafetyOverlayStore.getState().setPyroSafety(before),
      );
    }
  };

  // ── Vertical-right (floating glass dock) ─────────────────────────
  if (orientation === 'vertical-right') {
    return (
      <div
        className={
          'absolute top-1/2 -translate-y-1/2 right-3 z-30 pointer-events-auto ' +
          'flex flex-col items-center gap-1 ' +
          (collapsed
            ? 'p-1 rounded-full bg-[#050810]/70 border border-cyan-500/15 backdrop-blur'
            : 'p-1.5 rounded-2xl bg-[#050810]/85 border border-cyan-500/25 backdrop-blur shadow-[0_8px_30px_-12px_rgba(0,255,255,0.25)]')
        }
      >
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="w-7 h-7 rounded-md flex items-center justify-center text-cyan-300/70 hover:text-cyan-200 hover:bg-cyan-500/10 transition-all"
          title={collapsed ? 'Expandir ferramentas' : 'Recolher'}
        >
          {collapsed ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
        {!collapsed && (
          <>
            <div className="w-6 h-px bg-cyan-500/20 my-0.5" />
            {SEGMENTS.map((seg) => {
              const isActive = active === seg;
              return (
                <Button
                  key={seg}
                  size="sm"
                  variant="ghost"
                  className={
                    'h-9 w-9 p-0 rounded-lg text-[10px] font-bold tracking-wider transition-all ' +
                    (isActive
                      ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/60 hover:bg-cyan-500/25'
                      : 'text-muted-foreground border border-transparent hover:text-cyan-300 hover:border-cyan-500/30')
                  }
                  onClick={() => setActive(isActive ? null : seg)}
                  title={seg}
                >
                  {seg.slice(0, 3)}
                </Button>
              );
            })}
            <div className="w-6 h-px bg-cyan-500/20 my-0.5" />
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-9 p-0 text-[10px] text-muted-foreground hover:text-cyan-300"
              onClick={undo}
              disabled={!operationLog.canUndo()}
              title="Undo"
            >
              ↶
            </Button>
          </>
        )}

        {active && !collapsed && (
          <div className="absolute right-[calc(100%+8px)] top-0 max-w-[280px] w-[260px]">
            <ViewportToolPanel segment={active} />
          </div>
        )}

        <EffectConfigDialog
          open={effectDialog.open}
          onClose={() => setEffectDialog((d) => ({ ...d, open: false }))}
          effectId={effectDialog.effectId}
          targetTimelineItemId={effectDialog.timelineItemId}
        />
        <DroneConfigDialog
          open={droneDialog.open}
          onClose={() => setDroneDialog((d) => ({ ...d, open: false }))}
          positionId={droneDialog.positionId}
        />
        <VdlPickerDialog
          open={vdlDialog.open}
          onClose={() => setVdlDialog((d) => ({ ...d, open: false }))}
          timelineItemId={vdlDialog.timelineItemId}
        />
      </div>
    );
  }

  // ── Horizontal-top (legacy default) ──────────────────────────────
  return (
    <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 px-2 py-1.5 rounded-md bg-[#050810]/85 backdrop-blur border border-cyan-500/25 shadow-lg pointer-events-auto">
      {SEGMENTS.map((seg) => {
        const isActive = active === seg;
        return (
          <Button
            key={seg}
            size="sm"
            variant={isActive ? 'default' : 'ghost'}
            className={
              'h-7 px-3 text-[11px] font-semibold tracking-wider ' +
              (isActive
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/60 hover:bg-cyan-500/25'
                : 'text-muted-foreground hover:text-cyan-300')
            }
            onClick={() => setActive(isActive ? null : seg)}
          >
            {seg}
          </Button>
        );
      })}
      <div className="mx-1 w-px h-5 bg-cyan-500/20" />
      <Button
        size="sm"
        variant="ghost"
        className="h-7 px-2 text-[11px] text-muted-foreground hover:text-cyan-300"
        onClick={undo}
        disabled={!operationLog.canUndo()}
      >
        ↶ Undo
      </Button>

      {active && (
        <div className="absolute top-10 right-[-260px] max-w-[280px]">
          <ViewportToolPanel segment={active} />
        </div>
      )}

      <EffectConfigDialog
        open={effectDialog.open}
        onClose={() => setEffectDialog((d) => ({ ...d, open: false }))}
        effectId={effectDialog.effectId}
        targetTimelineItemId={effectDialog.timelineItemId}
      />
      <DroneConfigDialog
        open={droneDialog.open}
        onClose={() => setDroneDialog((d) => ({ ...d, open: false }))}
        positionId={droneDialog.positionId}
      />
      <VdlPickerDialog
        open={vdlDialog.open}
        onClose={() => setVdlDialog((d) => ({ ...d, open: false }))}
        timelineItemId={vdlDialog.timelineItemId}
      />
    </div>
  );
}
