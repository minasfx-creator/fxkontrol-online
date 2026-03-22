import { useState, useCallback } from 'react';
import { useProjectStore, EFFECT_LIBRARY } from '@/store/useProjectStore';
import { MapPin, Crosshair, Zap, Move, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, RotateCw, Maximize2, Minimize2, Grid3x3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function SelectionStatusBar() {
  const {
    selectedPositionIds, positions, timelineItems, editorMode,
    updatePosition, selectMultiplePositions,
    trajectories, selectedTrajectoryIds, batchOffsetWaypoints,
    selectionMode, linkedTimelineItemIds,
    selectMultiplePositionsAndLinkedEvents,
  } = useProjectStore();
  const [showBatchTools, setShowBatchTools] = useState(false);

  const selectedPositions = positions.filter(p => selectedPositionIds.includes(p.id));
  const selectedPyro = selectedPositions.filter(p => p.type === 'pyro');
  const selectedDrone = selectedPositions.filter(p => p.type === 'drone-pad');

  const linkedEffectCount = timelineItems.filter(
    t => selectedPositionIds.includes(t.positionId || '') ||
      t.positionIds?.some(id => selectedPositionIds.includes(id))
  ).length;

  // Select all drones
  const selectAllDrones = useCallback(() => {
    const droneIds = positions.filter(p => p.type === 'drone-pad').map(p => p.id);
    selectMultiplePositionsAndLinkedEvents(droneIds);
  }, [positions, selectMultiplePositionsAndLinkedEvents]);

  // Batch move selected positions
  const batchMove = useCallback((dx: number, dy: number, dz: number) => {
    selectedPositionIds.forEach(id => {
      const pos = positions.find(p => p.id === id);
      if (pos) {
        updatePosition(id, {
          x: Math.round((pos.x + dx) * 10) / 10,
          y: Math.max(0, Math.round((pos.y + dy) * 10) / 10),
          z: Math.round((pos.z + dz) * 10) / 10,
        });
      }
    });
    // Also move linked trajectories
    const linkedTrajIds = trajectories
      .filter(t => selectedPositionIds.includes(t.positionId))
      .map(t => t.id);
    if (linkedTrajIds.length > 0) {
      batchOffsetWaypoints(linkedTrajIds, { x: dx, y: dy, z: dz });
    }
  }, [selectedPositionIds, positions, updatePosition, trajectories, batchOffsetWaypoints]);

  // Batch rotate around center
  const batchRotate = useCallback((angleDeg: number) => {
    if (selectedPositions.length < 2) return;
    const cx = selectedPositions.reduce((s, p) => s + p.x, 0) / selectedPositions.length;
    const cz = selectedPositions.reduce((s, p) => s + p.z, 0) / selectedPositions.length;
    const rad = (angleDeg * Math.PI) / 180;
    selectedPositionIds.forEach(id => {
      const pos = positions.find(p => p.id === id);
      if (!pos) return;
      const rx = pos.x - cx;
      const rz = pos.z - cz;
      updatePosition(id, {
        x: Math.round((cx + rx * Math.cos(rad) - rz * Math.sin(rad)) * 10) / 10,
        z: Math.round((cz + rx * Math.sin(rad) + rz * Math.cos(rad)) * 10) / 10,
      });
    });
  }, [selectedPositions, selectedPositionIds, positions, updatePosition]);

  // Batch scale from center
  const batchScale = useCallback((factor: number) => {
    if (selectedPositions.length < 2) return;
    const cx = selectedPositions.reduce((s, p) => s + p.x, 0) / selectedPositions.length;
    const cz = selectedPositions.reduce((s, p) => s + p.z, 0) / selectedPositions.length;
    selectedPositionIds.forEach(id => {
      const pos = positions.find(p => p.id === id);
      if (!pos) return;
      updatePosition(id, {
        x: Math.round((cx + (pos.x - cx) * factor) * 10) / 10,
        z: Math.round((cz + (pos.z - cz) * factor) * 10) / 10,
      });
    });
  }, [selectedPositions, selectedPositionIds, positions, updatePosition]);

  if (editorMode !== 'select' && editorMode !== 'add-pyro' && editorMode !== 'add-drone') return null;

  if (selectedPositions.length === 0) {
    const droneCount = positions.filter(p => p.type === 'drone-pad').length;
    return (
      <div className="absolute bottom-14 left-3 bg-card/85 backdrop-blur-sm border border-border/50 rounded-md px-3 py-1.5 shadow-lg">
        <span className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
          {editorMode === 'select' ? (
            <>
              <Crosshair className="w-3 h-3" />
              Click selecionar · Shift+Click multi · Alt+Drag box
              {droneCount > 0 && (
                <button
                  onClick={selectAllDrones}
                  className="ml-2 px-1.5 py-0.5 text-[8px] bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors border border-primary/20"
                >
                  Selecionar {droneCount} drones
                </button>
              )}
            </>
          ) : (
            <>
              <Move className="w-3 h-3 text-primary" />
              Click no terreno para posicionar · ESC cancelar
            </>
          )}
        </span>
      </div>
    );
  }

  return (
    <div className="absolute bottom-14 left-3 bg-card/90 backdrop-blur-md border border-primary/20 rounded-md px-3 py-2 space-y-1.5 shadow-xl max-w-sm">
      {/* Selection summary */}
      <div className="flex items-center gap-3 text-[10px] font-mono">
        {selectedPyro.length > 0 && (
          <span className="flex items-center gap-1 text-accent">
            <MapPin className="w-3 h-3" />
            {selectedPyro.length} Pyro
          </span>
        )}
        {selectedDrone.length > 0 && (
          <span className="flex items-center gap-1 text-primary">
            <MapPin className="w-3 h-3" />
            {selectedDrone.length} Drone
          </span>
        )}
        <span className="text-border">|</span>
        <span className="flex items-center gap-1 text-foreground">
          <Zap className="w-3 h-3" />
          {linkedEffectCount} fx
        </span>
        <div className="flex-1" />
        <button
          onClick={() => setShowBatchTools(!showBatchTools)}
          className={cn(
            "px-1.5 py-0.5 text-[8px] rounded border transition-colors",
            showBatchTools
              ? "bg-primary/15 text-primary border-primary/30"
              : "bg-surface-2 text-muted-foreground border-border/50 hover:text-foreground"
          )}
        >
          {showBatchTools ? '▼ Tools' : '▶ Tools'}
        </button>
      </div>

      {/* Position tags */}
      <div className="flex flex-wrap gap-1">
        {selectedPositions.slice(0, 8).map(p => (
          <span
            key={p.id}
            className={cn(
              "px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border",
              p.type === 'pyro'
                ? "bg-accent/15 text-accent border-accent/30"
                : "bg-primary/15 text-primary border-primary/30"
            )}
          >
            {p.name}
          </span>
        ))}
        {selectedPositions.length > 8 && (
          <span className="text-[8px] text-muted-foreground self-center">+{selectedPositions.length - 8}</span>
        )}
      </div>

      {/* Batch transform tools */}
      {showBatchTools && selectedPositions.length >= 1 && (
        <div className="border-t border-border/30 pt-1.5 space-y-1.5">
          <span className="text-[8px] text-muted-foreground font-semibold uppercase">Mover Seleção</span>
          {/* Move arrows */}
          <div className="flex items-center gap-1">
            <div className="grid grid-cols-3 gap-0.5 w-fit">
              <div />
              <Button variant="outline" size="icon" className="h-5 w-5" onClick={() => batchMove(0, 0, -1)}>
                <ArrowUp className="w-2.5 h-2.5" />
              </Button>
              <div />
              <Button variant="outline" size="icon" className="h-5 w-5" onClick={() => batchMove(-1, 0, 0)}>
                <ArrowLeft className="w-2.5 h-2.5" />
              </Button>
              <div className="h-5 w-5 flex items-center justify-center">
                <Grid3x3 className="w-2.5 h-2.5 text-muted-foreground/30" />
              </div>
              <Button variant="outline" size="icon" className="h-5 w-5" onClick={() => batchMove(1, 0, 0)}>
                <ArrowRight className="w-2.5 h-2.5" />
              </Button>
              <div />
              <Button variant="outline" size="icon" className="h-5 w-5" onClick={() => batchMove(0, 0, 1)}>
                <ArrowDown className="w-2.5 h-2.5" />
              </Button>
              <div />
            </div>
            <div className="flex flex-col gap-0.5 ml-2">
              <Button variant="outline" size="sm" className="h-5 text-[7px] px-1.5" onClick={() => batchMove(0, 1, 0)}>
                ↑ +1m Y
              </Button>
              <Button variant="outline" size="sm" className="h-5 text-[7px] px-1.5" onClick={() => batchMove(0, -1, 0)}>
                ↓ -1m Y
              </Button>
            </div>
          </div>

          {/* Rotate & Scale */}
          {selectedPositions.length >= 2 && (
            <div className="flex gap-1">
              <Button variant="outline" size="sm" className="h-5 text-[7px] px-1.5 flex-1" onClick={() => batchRotate(-15)}>
                <RotateCw className="w-2.5 h-2.5 mr-0.5 scale-x-[-1]" /> -15°
              </Button>
              <Button variant="outline" size="sm" className="h-5 text-[7px] px-1.5 flex-1" onClick={() => batchRotate(15)}>
                <RotateCw className="w-2.5 h-2.5 mr-0.5" /> +15°
              </Button>
              <Button variant="outline" size="sm" className="h-5 text-[7px] px-1.5" onClick={() => batchScale(1.1)}>
                <Maximize2 className="w-2.5 h-2.5" />
              </Button>
              <Button variant="outline" size="sm" className="h-5 text-[7px] px-1.5" onClick={() => batchScale(0.9)}>
                <Minimize2 className="w-2.5 h-2.5" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
