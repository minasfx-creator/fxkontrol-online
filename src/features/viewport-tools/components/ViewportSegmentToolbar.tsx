import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { viewportToolRegistry } from '@/features/viewport-tools/registry';
import { operationLog } from '@/features/viewport-tools/command-dispatcher';
import { useProjectStore } from '@/store/useProjectStore';
import { effectVariantStore } from '@/features/viewport-tools/effectVariants';
import ViewportToolPanel from './ViewportToolPanel';
import EffectConfigDialog from './EffectConfigDialog';
import DroneConfigDialog from './DroneConfigDialog';
import type { SegmentType } from '@/features/viewport-tools/types';

// Side-effect import: registers all 5 segment plugins exactly once.
import '@/features/viewport-tools/segments/registerAll';

const SEGMENTS: SegmentType[] = ['PYRO', 'SFX', 'DRONES', 'LIGHT', 'DMX'];

interface Props {
  /** Optional initial segment. Defaults to PYRO. */
  defaultSegment?: SegmentType;
}

/**
 * ViewportSegmentToolbar — fixed bar at the top of the 3D viewport.
 * Selecting a segment opens the corresponding ViewportToolPanel as an
 * overlay on the right. Undo/Redo buttons drive the operationLog.
 *
 * Visual: Mission Control / Vantablack palette, Cyan = active segment.
 */
export default function ViewportSegmentToolbar({ defaultSegment = 'PYRO' }: Props) {
  const [active, setActive] = useState<SegmentType | null>(defaultSegment);
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
    window.addEventListener('viewport-tools:open-effect-config', onEffect);
    window.addEventListener('viewport-tools:open-drone-config', onDrone);
    return () => {
      window.removeEventListener('viewport-tools:open-effect-config', onEffect);
      window.removeEventListener('viewport-tools:open-drone-config', onDrone);
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
    }
  };

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
    </div>
  );
}
