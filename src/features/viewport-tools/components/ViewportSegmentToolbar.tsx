import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronRight, ChevronLeft, GripVertical } from 'lucide-react';
import { viewportToolRegistry } from '@/features/viewport-tools/registry';
import { operationLog } from '@/features/viewport-tools/command-dispatcher';
import { useProjectStore } from '@/store/useProjectStore';
import { effectVariantStore } from '@/features/viewport-tools/effectVariants';
import { useDraggableFloat } from '@/components/editor/useDraggableFloat';
import ViewportToolPanel from './ViewportToolPanel';
import EffectConfigDialog from './EffectConfigDialog';
import DroneConfigDialog from './DroneConfigDialog';
import VdlPickerDialog from './VdlPickerDialog';
import DmxPatchDialog from './DmxPatchDialog';
import ValidatorsReportDialog from './ValidatorsReportDialog';
import ExportCenterDialog from './ExportCenterDialog';
import GeneratorsDialog from './GeneratorsDialog';
import DmxHeatmapOverlay from './DmxHeatmapOverlay';
import { generateCake, type CakeParams } from '@/features/viewport-tools/generators/cakeGenerator';
import { generateMortarFan, type MortarFanParams } from '@/features/viewport-tools/generators/mortarFanGenerator';
import { generateDroneFormation, type FormationParams } from '@/features/viewport-tools/generators/droneFormationGenerator';
import type { SegmentType } from '@/features/viewport-tools/types';

// Side-effect import: registers all 5 segment plugins exactly once.
import '@/features/viewport-tools/segments/registerAll';

const SEGMENTS: SegmentType[] = ['PYRO', 'SFX', 'DRONES', 'LIGHT', 'DMX'];

/**
 * Legacy orientation type — kept exported for callers that still pass it.
 * Only `'vertical-right'` is rendered (the desktop floating glass dock).
 * The legacy `'horizontal-top'` branch was removed in the Mission Control
 * refactor; mobile uses MobileTabBar instead.
 */
export type ViewportSegmentToolbarOrientation = 'horizontal-top' | 'vertical-right';

interface Props {
  /** Optional initial segment. Defaults to PYRO. */
  defaultSegment?: SegmentType;
  /** Accepted for backward compatibility; the dock is always vertical-right. */
  orientation?: ViewportSegmentToolbarOrientation;
}

/**
 * ViewportSegmentToolbar — segment switcher (PYRO / SFX / DRONES / LIGHT /
 * DMX) for viewport tools, rendered as a draggable vertical glass dock.
 *
 * - Drag handle = the grip strip at the top of the dock.
 * - Position is persisted (localStorage `fxk:float-pos:segment-dock`).
 * - Double-click the handle to reset position. Right-side reset button too.
 * - Selecting a segment opens the corresponding ViewportToolPanel attached
 *   to the side closer to the viewport center.
 *
 * Visual: Mission Control / Vantablack palette, Cyan = active segment.
 * Never mutates the viewport directly; all commands flow through the
 * existing operation-log + plugin command handlers.
 */
export default function ViewportSegmentToolbar({ defaultSegment = 'PYRO' }: Props) {
  const [active, setActive] = useState<SegmentType | null>(defaultSegment);
  const [collapsed, setCollapsed] = useState(false);
  const [, force] = useState(0);

  const drag = useDraggableFloat({
    id: 'segment-dock',
    defaultPos: { anchor: 'tr', x: 12, y: 120 },
    snapPx: 16,
  });

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
  const [dmxDialog, setDmxDialog] = useState<{ open: boolean; tab: 'patch' | 'conflicts' }>({
    open: false,
    tab: 'patch',
  });
  const [validatorsDialog, setValidatorsDialog] = useState(false);
  const [exportDialog, setExportDialog] = useState(false);
  const [generatorsDialog, setGeneratorsDialog] = useState(false);

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
    const onDmx = (e: Event) => {
      const detail = (e as CustomEvent).detail as { tab?: 'patch' | 'conflicts' };
      setDmxDialog({ open: true, tab: detail?.tab ?? 'patch' });
    };
    const onValidators = () => setValidatorsDialog(true);
    const onExport = () => setExportDialog(true);
    const onOpenGenerators = () => setGeneratorsDialog(true);

    // ── Generator commit handlers (mutate store + record undo) ──
    const uid = (p: string) => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

    const onGenCake = (e: Event) => {
      const params = (e as CustomEvent).detail as CakeParams;
      const items = generateCake(params);
      if (items.length === 0) return;
      useProjectStore.setState((s) => ({ timelineItems: [...s.timelineItems, ...items] }));
      operationLog.push({
        id: uid('op'),
        segment: 'PYRO',
        command: 'PYRO_GENERATE_CAKE',
        timestamp: Date.now(),
        before: null,
        after: { addedIds: items.map((i) => i.id) },
        description: `Generated cake: ${items.length} shots @${params.staggerMs}ms / ${params.spreadDeg}°.`,
      });
    };

    const onGenFan = (e: Event) => {
      const params = (e as CustomEvent).detail as MortarFanParams;
      const { positions, items } = generateMortarFan(params);
      if (items.length === 0) return;
      useProjectStore.setState((s) => ({
        positions: [...s.positions, ...positions],
        timelineItems: [...s.timelineItems, ...items],
      }));
      operationLog.push({
        id: uid('op'),
        segment: 'PYRO',
        command: 'PYRO_GENERATE_MORTAR_FAN',
        timestamp: Date.now(),
        before: null,
        after: { addedPositionIds: positions.map((p) => p.id), addedItemIds: items.map((i) => i.id) },
        description: `Generated mortar fan: ${positions.length} mortars / ${params.spacingM}m.`,
      });
    };

    const onGenDrone = (e: Event) => {
      const params = (e as CustomEvent).detail as FormationParams;
      const formation = generateDroneFormation(params);
      useProjectStore.getState().addDroneFormation(formation);
      operationLog.push({
        id: uid('op'),
        segment: 'DRONES',
        command: 'DRONES_GENERATE_FORMATION',
        timestamp: Date.now(),
        before: null,
        after: { formationId: formation.id },
        description: `Generated ${formation.formationType} formation: ${formation.droneCount} drones.`,
      });
    };

    window.addEventListener('viewport-tools:open-effect-config', onEffect);
    window.addEventListener('viewport-tools:open-drone-config', onDrone);
    window.addEventListener('viewport-tools:open-vdl-picker', onVdl);
    window.addEventListener('viewport-tools:open-dmx-patch', onDmx);
    window.addEventListener('viewport-tools:open-validators-report', onValidators);
    window.addEventListener('viewport-tools:open-export-center', onExport);
    window.addEventListener('viewport-tools:open-generators', onOpenGenerators);
    window.addEventListener('viewport-tools:generate-cake', onGenCake);
    window.addEventListener('viewport-tools:generate-mortar-fan', onGenFan);
    window.addEventListener('viewport-tools:generate-drone-formation', onGenDrone);
    return () => {
      window.removeEventListener('viewport-tools:open-effect-config', onEffect);
      window.removeEventListener('viewport-tools:open-drone-config', onDrone);
      window.removeEventListener('viewport-tools:open-vdl-picker', onVdl);
      window.removeEventListener('viewport-tools:open-dmx-patch', onDmx);
      window.removeEventListener('viewport-tools:open-validators-report', onValidators);
      window.removeEventListener('viewport-tools:open-export-center', onExport);
      window.removeEventListener('viewport-tools:open-generators', onOpenGenerators);
      window.removeEventListener('viewport-tools:generate-cake', onGenCake);
      window.removeEventListener('viewport-tools:generate-mortar-fan', onGenFan);
      window.removeEventListener('viewport-tools:generate-drone-formation', onGenDrone);
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
      const before = (op.before as { visible: boolean }).visible;
      import('@/features/viewport-tools/safetyOverlayStore').then((m) =>
        m.useSafetyOverlayStore.getState().setPyroSafety(before),
      );
    } else if (op.command === 'DRONES_TOGGLE_COLLISION') {
      const before = (op.before as { visible: boolean }).visible;
      import('@/features/viewport-tools/safetyOverlayStore').then((m) =>
        m.useSafetyOverlayStore.getState().setDronesCollision(before),
      );
    } else if (op.command === 'PYRO_GENERATE_CAKE') {
      const ids = new Set((op.after as { addedIds: string[] }).addedIds);
      useProjectStore.setState((s) => ({
        timelineItems: s.timelineItems.filter((it) => !ids.has(it.id)),
      }));
    } else if (op.command === 'PYRO_GENERATE_MORTAR_FAN') {
      const after = op.after as { addedPositionIds: string[]; addedItemIds: string[] };
      const posIds = new Set(after.addedPositionIds);
      const itemIds = new Set(after.addedItemIds);
      useProjectStore.setState((s) => ({
        positions: s.positions.filter((p) => !posIds.has(p.id)),
        timelineItems: s.timelineItems.filter((it) => !itemIds.has(it.id)),
      }));
    } else if (op.command === 'DRONES_GENERATE_FORMATION') {
      const formationId = (op.after as { formationId: string }).formationId;
      useProjectStore.getState().removeDroneFormation(formationId);
    } else if (op.command === 'DMX_TOGGLE_HEATMAP') {
      const before = (op.before as { visible: boolean }).visible;
      import('@/features/viewport-tools/safetyOverlayStore').then((m) =>
        m.useSafetyOverlayStore.getState().setDmxHeatmap(before),
      );
    }
  };

  // Tool panel anchors to the *opposite* side of the dock so it stays inside
  // the viewport regardless of where the user dragged the dock to.
  const panelOnLeft = drag.style.right !== undefined;

  return (
    <div
      ref={drag.ref}
      style={{ ...drag.style, zIndex: 30 }}
      className={
        'pointer-events-auto flex flex-col items-stretch ' +
        (collapsed
          ? 'rounded-full bg-[#050810]/70 border border-cyan-500/15 backdrop-blur'
          : 'rounded-2xl bg-[#050810]/85 border border-cyan-500/25 backdrop-blur shadow-[0_8px_30px_-12px_rgba(0,255,255,0.25)]')
      }
    >
      {/* Drag handle — the grip strip at the top doubles as the collapse target.
          Buttons inside opt out of drag via data-no-drag. */}
      <div
        {...drag.dragHandleProps}
        className={
          'flex items-center justify-between gap-1 px-1.5 py-1 select-none ' +
          (collapsed ? '' : 'border-b border-cyan-500/15')
        }
      >
        <GripVertical className="h-3 w-3 text-cyan-300/40" aria-hidden />
        <button
          type="button"
          data-no-drag
          onClick={() => setCollapsed((c) => !c)}
          className="w-6 h-6 rounded-md flex items-center justify-center text-cyan-300/70 hover:text-cyan-200 hover:bg-cyan-500/10 transition-all"
          title={collapsed ? 'Expandir ferramentas' : 'Recolher'}
        >
          {collapsed ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
      </div>

      {!collapsed && (
        <div className="flex flex-col items-center gap-1 p-1.5">
          {SEGMENTS.map((seg) => {
            const isActive = active === seg;
            return (
              <Button
                key={seg}
                size="sm"
                variant="ghost"
                data-no-drag
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
            data-no-drag
            className="h-7 w-9 p-0 text-[10px] text-muted-foreground hover:text-cyan-300"
            onClick={undo}
            disabled={!operationLog.canUndo()}
            title="Undo"
          >
            ↶
          </Button>
          <Button
            size="sm"
            variant="ghost"
            data-no-drag
            className="h-6 w-9 p-0 text-[9px] text-muted-foreground/60 hover:text-cyan-300"
            onClick={drag.resetPosition}
            title="Reset dock position"
          >
            ⌖
          </Button>
        </div>
      )}

      {active && !collapsed && (
        <div
          className={
            'absolute top-0 max-w-[280px] w-[260px] ' +
            (panelOnLeft ? 'right-[calc(100%+8px)]' : 'left-[calc(100%+8px)]')
          }
        >
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
      <DmxPatchDialog
        open={dmxDialog.open}
        onClose={() => setDmxDialog((d) => ({ ...d, open: false }))}
      />
      <ValidatorsReportDialog
        open={validatorsDialog}
        onClose={() => setValidatorsDialog(false)}
      />
      <ExportCenterDialog
        open={exportDialog}
        onClose={() => setExportDialog(false)}
      />
      <GeneratorsDialog
        open={generatorsDialog}
        onClose={() => setGeneratorsDialog(false)}
      />
      <DmxHeatmapOverlay />
    </div>
  );
}
