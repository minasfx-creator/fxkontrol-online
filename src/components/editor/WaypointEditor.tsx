import { useState, useCallback } from 'react';
import { Route, Trash2, Plus, Gauge, Spline, X, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { useProjectStore, type Waypoint, type Trajectory } from '@/store/useProjectStore';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

function Vec3Input({ label, value, onChange, color }: {
  label: string;
  value: { x: number; y: number; z: number };
  onChange: (v: { x: number; y: number; z: number }) => void;
  color?: string;
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-[8px] font-mono-code text-muted-foreground uppercase">{label}</p>
      <div className="flex gap-0.5">
        {(['x', 'y', 'z'] as const).map((axis) => (
          <div key={axis} className="flex-1">
            <Input
              type="number"
              step={0.1}
              value={value[axis]}
              onChange={(e) => onChange({ ...value, [axis]: parseFloat(e.target.value) || 0 })}
              className="h-5 text-[9px] font-mono-code px-1 bg-surface-2 border-border"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function SpeedIndicator({ wp, prevWp }: { wp: Waypoint; prevWp?: Waypoint }) {
  if (!prevWp) return null;
  const dx = wp.position.x - prevWp.position.x;
  const dy = wp.position.y - prevWp.position.y;
  const dz = wp.position.z - prevWp.position.z;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const dt = Math.abs(wp.time - prevWp.time) || 0.1;
  const speed = dist / dt;
  const isWarning = speed > 15;
  const isCritical = speed > 25;

  return (
    <div className={cn(
      "flex items-center gap-1 text-[8px] font-mono-code px-1 py-0.5 rounded-sm",
      isCritical ? "bg-destructive/20 text-destructive" : isWarning ? "bg-yellow-500/20 text-yellow-400" : "bg-success/10 text-success"
    )}>
      <Gauge className="h-2 w-2" />
      <span>{speed.toFixed(1)} m/s</span>
      {isWarning && <AlertTriangle className="h-2 w-2" />}
    </div>
  );
}

function WaypointRow({ wp, index, traj, prevWp }: {
  wp: Waypoint;
  index: number;
  traj: Trajectory;
  prevWp?: Waypoint;
}) {
  const { updateWaypoint, removeWaypoint, selectedTrajectoryId } = useProjectStore();
  const [expanded, setExpanded] = useState(false);
  const isSelected = selectedTrajectoryId === traj.id;

  const hasControlIn = !!wp.controlIn;
  const hasControlOut = !!wp.controlOut;

  const addDefaultHandles = useCallback(() => {
    const handle = { x: 0, y: 1, z: 0 };
    updateWaypoint(traj.id, wp.id, {
      controlIn: wp.controlIn || { x: -handle.x, y: -handle.y, z: -handle.z },
      controlOut: wp.controlOut || handle,
    });
  }, [traj.id, wp, updateWaypoint]);

  const removeHandles = useCallback(() => {
    updateWaypoint(traj.id, wp.id, { controlIn: undefined, controlOut: undefined });
  }, [traj.id, wp.id, updateWaypoint]);

  return (
    <div className={cn(
      "border border-border/30 rounded-sm bg-surface-1/50 overflow-hidden",
      isSelected && "border-primary/30"
    )}>
      {/* Header */}
      <div
        className="flex items-center gap-1 px-1.5 py-1 cursor-pointer hover:bg-surface-2/50"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown className="h-2.5 w-2.5 text-muted-foreground" /> : <ChevronRight className="h-2.5 w-2.5 text-muted-foreground" />}
        <span className="text-[9px] font-mono-code text-electric font-medium flex-1">WP{index + 1}</span>
        <SpeedIndicator wp={wp} prevWp={prevWp} />
        <span className="text-[8px] font-mono-code text-muted-foreground">{wp.time.toFixed(1)}s</span>
        <button
          className="text-destructive/40 hover:text-destructive p-0.5"
          onClick={(e) => { e.stopPropagation(); removeWaypoint(traj.id, wp.id); }}
        >
          <Trash2 className="h-2.5 w-2.5" />
        </button>
      </div>

      {expanded && (
        <div className="px-1.5 pb-1.5 space-y-1.5 border-t border-border/20">
          {/* Time */}
          <div className="pt-1">
            <p className="text-[8px] font-mono-code text-muted-foreground uppercase mb-0.5">Time (s)</p>
            <Input
              type="number"
              step={0.1}
              value={wp.time}
              onChange={(e) => updateWaypoint(traj.id, wp.id, { time: parseFloat(e.target.value) || 0 })}
              className="h-5 text-[9px] font-mono-code px-1 bg-surface-2 border-border"
            />
          </div>

          {/* Position */}
          <Vec3Input
            label="Position"
            value={wp.position}
            onChange={(pos) => updateWaypoint(traj.id, wp.id, { position: pos })}
          />

          {/* Speed limit */}
          <div>
            <p className="text-[8px] font-mono-code text-muted-foreground uppercase mb-0.5">Max Speed (m/s) — 0 = auto</p>
            <div className="flex items-center gap-1">
              <Slider
                min={0}
                max={30}
                step={0.5}
                value={[wp.maxSpeed ?? 0]}
                onValueChange={([v]) => updateWaypoint(traj.id, wp.id, { maxSpeed: v })}
                className="flex-1"
              />
              <span className="text-[9px] font-mono-code text-foreground w-8 text-right">{(wp.maxSpeed ?? 0).toFixed(1)}</span>
            </div>
          </div>

          <Separator className="my-1" />

          {/* Bézier handles */}
          <div className="flex items-center gap-1 mb-1">
            <Spline className="h-2.5 w-2.5 text-primary" />
            <span className="text-[8px] font-mono-code text-muted-foreground uppercase flex-1">Bézier Handles</span>
            {(!hasControlIn && !hasControlOut) ? (
              <Button variant="ghost" size="sm" className="h-4 px-1 text-[8px]" onClick={addDefaultHandles}>
                <Plus className="h-2 w-2 mr-0.5" /> Add
              </Button>
            ) : (
              <Button variant="ghost" size="sm" className="h-4 px-1 text-[8px] text-destructive" onClick={removeHandles}>
                <X className="h-2 w-2 mr-0.5" /> Remove
              </Button>
            )}
          </div>

          {hasControlIn && (
            <Vec3Input
              label="Control In (relative)"
              value={wp.controlIn!}
              onChange={(v) => updateWaypoint(traj.id, wp.id, { controlIn: v })}
            />
          )}
          {hasControlOut && (
            <Vec3Input
              label="Control Out (relative)"
              value={wp.controlOut!}
              onChange={(v) => updateWaypoint(traj.id, wp.id, { controlOut: v })}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default function WaypointEditor({ onClose }: { onClose: () => void }) {
  const {
    trajectories, positions, selectedTrajectoryId,
    selectTrajectory, addTrajectory, addWaypoint, setEditorMode, editorMode,
  } = useProjectStore();

  const dronePads = positions.filter((p) => p.type === 'drone-pad');

  const selectedTraj = trajectories.find((t) => t.id === selectedTrajectoryId);
  const sortedWps = selectedTraj
    ? [...selectedTraj.waypoints].sort((a, b) => a.time - b.time)
    : [];

  const handleAddWp = () => {
    if (!selectedTrajectoryId) return;
    const lastWp = sortedWps[sortedWps.length - 1];
    const time = lastWp ? lastWp.time + 2 : 2;
    const pos = lastWp ? { ...lastWp.position, y: lastWp.position.y + 2 } : { x: 0, y: 5, z: 0 };

    addWaypoint(selectedTrajectoryId, {
      id: `wp-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      position: pos,
      time,
    });
  };

  // Compute total distance and total time
  let totalDist = 0;
  for (let i = 1; i < sortedWps.length; i++) {
    const a = sortedWps[i - 1].position;
    const b = sortedWps[i].position;
    totalDist += Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2 + (b.z - a.z) ** 2);
  }
  const totalTime = sortedWps.length >= 2 ? sortedWps[sortedWps.length - 1].time - sortedWps[0].time : 0;
  const avgSpeed = totalTime > 0 ? totalDist / totalTime : 0;

  return (
    <div className="h-full flex flex-col bg-card border-l border-border">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        <Spline className="h-3.5 w-3.5 text-primary" />
        <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider flex-1">Waypoint Editor</h2>
        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onClose}>
          <X className="h-3 w-3" />
        </Button>
      </div>

      <div className="flex-1 overflow-auto px-2 py-2 space-y-2">
        {/* Trajectory selector */}
        <div>
          <p className="text-[8px] font-mono-code text-muted-foreground uppercase mb-1">Trajectory</p>
          <div className="space-y-0.5">
            {trajectories.map((traj) => {
              const pad = positions.find((p) => p.id === traj.positionId);
              return (
                <button
                  key={traj.id}
                  onClick={() => selectTrajectory(traj.id)}
                  className={cn(
                    "w-full flex items-center gap-1.5 px-2 py-1 rounded-sm text-[9px] font-mono-code transition-colors",
                    selectedTrajectoryId === traj.id
                      ? "bg-primary/15 text-primary border border-primary/30"
                      : "bg-surface-2/50 text-muted-foreground hover:bg-surface-2 border border-transparent"
                  )}
                >
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: pad?.color || '#00B4D8' }} />
                  <span className="flex-1 text-left truncate">{traj.name}</span>
                  <span className="text-muted-foreground/60">{traj.waypoints.length} wp</span>
                </button>
              );
            })}
            {/* Create trajectory for drone pads */}
            {dronePads.filter((pad) => !trajectories.some((t) => t.positionId === pad.id)).map((pad) => (
              <button
                key={`create-${pad.id}`}
                onClick={() => {
                  const id = `traj-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
                  addTrajectory({ id, positionId: pad.id, waypoints: [], name: `Traj ${pad.name}` });
                  selectTrajectory(id);
                }}
                className="w-full flex items-center gap-1.5 px-2 py-1 rounded-sm text-[9px] font-mono-code bg-primary/5 text-primary/70 hover:bg-primary/15 border border-dashed border-primary/20 transition-colors"
              >
                <Plus className="h-2.5 w-2.5" />
                <span className="flex-1 text-left truncate">New: {pad.name}</span>
              </button>
            ))}
            {dronePads.length === 0 && trajectories.length === 0 && (
              <p className="text-[9px] text-muted-foreground/50 text-center py-2">
                Adicione drone pads no viewport primeiro
              </p>
            )}
          </div>
        </div>

        {selectedTraj && (
          <>
            <Separator />

            {/* Stats */}
            <div className="grid grid-cols-3 gap-1">
              <div className="bg-surface-2 rounded-sm p-1.5 text-center">
                <p className="text-[7px] text-muted-foreground uppercase">WPs</p>
                <p className="text-[10px] font-mono-code text-electric font-bold">{sortedWps.length}</p>
              </div>
              <div className="bg-surface-2 rounded-sm p-1.5 text-center">
                <p className="text-[7px] text-muted-foreground uppercase">Dist</p>
                <p className="text-[10px] font-mono-code text-safety font-bold">{totalDist.toFixed(1)}m</p>
              </div>
              <div className="bg-surface-2 rounded-sm p-1.5 text-center">
                <p className="text-[7px] text-muted-foreground uppercase">Avg Spd</p>
                <p className={cn(
                  "text-[10px] font-mono-code font-bold",
                  avgSpeed > 15 ? "text-destructive" : "text-success"
                )}>{avgSpeed.toFixed(1)} m/s</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-6 text-[9px] gap-1"
                onClick={handleAddWp}
              >
                <Plus className="h-2.5 w-2.5" /> Add WP
              </Button>
              <Button
                variant={editorMode === 'add-waypoint' ? 'default' : 'outline'}
                size="sm"
                className="flex-1 h-6 text-[9px] gap-1"
                onClick={() => {
                  setEditorMode(editorMode === 'add-waypoint' ? 'select' : 'add-waypoint');
                }}
              >
                <Route className="h-2.5 w-2.5" /> {editorMode === 'add-waypoint' ? 'Placing…' : 'Click 3D'}
              </Button>
            </div>

            <Separator />

            {/* Waypoint list */}
            <div className="space-y-1">
              {sortedWps.map((wp, i) => (
                <WaypointRow
                  key={wp.id}
                  wp={wp}
                  index={i}
                  traj={selectedTraj}
                  prevWp={i > 0 ? sortedWps[i - 1] : undefined}
                />
              ))}
              {sortedWps.length === 0 && (
                <p className="text-[9px] text-muted-foreground/50 text-center py-3">
                  Nenhum waypoint. Clique "Add WP" ou "Click 3D" para adicionar.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
