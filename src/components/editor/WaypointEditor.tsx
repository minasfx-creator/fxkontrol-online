import { useState, useCallback, useEffect } from 'react';
import { Route, Trash2, Plus, Gauge, Spline, X, ChevronDown, ChevronRight, AlertTriangle, Undo2, PenTool, ArrowUpDown, Circle, Square, Zap, Shield, Eye, EyeOff, Move, CheckSquare, Minimize2, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { useProjectStore, type Waypoint, type Trajectory } from '@/store/useProjectStore';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

/* ── helpers ─────────────────────────────────────────────────── */

function Vec3Input({ label, value, onChange }: {
  label: string;
  value: { x: number; y: number; z: number };
  onChange: (v: { x: number; y: number; z: number }) => void;
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

/* ── trajectory presets ──────────────────────────────────────── */

interface PresetDef { id: string; label: string; icon: React.ElementType; generate: (radius: number, height: number, count: number) => Omit<Waypoint, 'id'>[] }

const PRESETS: PresetDef[] = [
  {
    id: 'circle', label: 'Circular', icon: Circle,
    generate: (r, h, n) => Array.from({ length: n + 1 }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      return { position: { x: Math.cos(a) * r, y: h, z: Math.sin(a) * r }, time: i * 2 };
    }),
  },
  {
    id: 'square', label: 'Quadrado', icon: Square,
    generate: (r, h, _n) => {
      const pts: { x: number; z: number }[] = [
        { x: -r, z: -r }, { x: r, z: -r }, { x: r, z: r }, { x: -r, z: r }, { x: -r, z: -r },
      ];
      return pts.map((p, i) => ({ position: { x: p.x, y: h, z: p.z }, time: i * 3 }));
    },
  },
  {
    id: 'vigilance', label: 'Vigilância', icon: Shield,
    generate: (r, h, n) => {
      // Elliptical orbit with height variation
      const wps: Omit<Waypoint, 'id'>[] = [];
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2;
        const yVar = Math.sin(a * 2) * 3;
        wps.push({ position: { x: Math.cos(a) * r * 1.3, y: h + yVar, z: Math.sin(a) * r }, time: i * 2.5 });
      }
      return wps;
    },
  },
  {
    id: 'zigzag', label: 'Zigzag', icon: Zap,
    generate: (r, h, n) => Array.from({ length: n }, (_, i) => ({
      position: { x: -r + (i / (n - 1)) * r * 2, y: h + (i % 2 === 0 ? 3 : -3), z: (i % 2 === 0 ? -r / 2 : r / 2) },
      time: i * 1.5,
    })),
  },
];

/* ── waypoint row ────────────────────────────────────────────── */

function WaypointRow({ wp, index, traj, prevWp }: {
  wp: Waypoint; index: number; traj: Trajectory; prevWp?: Waypoint;
}) {
  const { updateWaypoint, removeWaypoint, selectedWaypointId, selectWaypoint } = useProjectStore();
  const [expanded, setExpanded] = useState(false);
  const isSelected = selectedWaypointId === wp.id;

  const toggleHandles = useCallback(() => {
    if (wp.controlIn || wp.controlOut) {
      updateWaypoint(traj.id, wp.id, { controlIn: undefined, controlOut: undefined });
    } else {
      updateWaypoint(traj.id, wp.id, {
        controlIn: { x: 0, y: -1, z: 0 },
        controlOut: { x: 0, y: 1, z: 0 },
      });
    }
  }, [traj.id, wp, updateWaypoint]);

  return (
    <div className={cn(
      "border border-border/30 rounded-sm bg-surface-1/50 overflow-hidden transition-colors",
      isSelected && "border-primary/50 bg-primary/5"
    )}>
      <div
        className="flex items-center gap-1 px-1.5 py-1 cursor-pointer hover:bg-surface-2/50"
        onClick={() => { selectWaypoint(wp.id); setExpanded(!expanded); }}
      >
        {expanded ? <ChevronDown className="h-2.5 w-2.5 text-muted-foreground" /> : <ChevronRight className="h-2.5 w-2.5 text-muted-foreground" />}
        <span className="text-[9px] font-mono-code text-electric font-medium flex-1">WP{index + 1}</span>
        <SpeedIndicator wp={wp} prevWp={prevWp} />
        <span className="text-[8px] font-mono-code text-muted-foreground">{wp.time.toFixed(1)}s</span>
        <button className="text-destructive/40 hover:text-destructive p-0.5"
          onClick={(e) => { e.stopPropagation(); removeWaypoint(traj.id, wp.id); }}>
          <Trash2 className="h-2.5 w-2.5" />
        </button>
      </div>

      {expanded && (
        <div className="px-1.5 pb-1.5 space-y-1.5 border-t border-border/20">
          <div className="pt-1">
            <p className="text-[8px] font-mono-code text-muted-foreground uppercase mb-0.5">Time (s)</p>
            <Input type="number" step={0.1} value={wp.time}
              onChange={(e) => updateWaypoint(traj.id, wp.id, { time: parseFloat(e.target.value) || 0 })}
              className="h-5 text-[9px] font-mono-code px-1 bg-surface-2 border-border" />
          </div>
          <Vec3Input label="Position" value={wp.position}
            onChange={(pos) => updateWaypoint(traj.id, wp.id, { position: pos })} />
          <div>
            <p className="text-[8px] font-mono-code text-muted-foreground uppercase mb-0.5">Max Speed (m/s) — 0 = auto</p>
            <div className="flex items-center gap-1">
              <Slider min={0} max={30} step={0.5} value={[wp.maxSpeed ?? 0]}
                onValueChange={([v]) => updateWaypoint(traj.id, wp.id, { maxSpeed: v })} className="flex-1" />
              <span className="text-[9px] font-mono-code text-foreground w-8 text-right">{(wp.maxSpeed ?? 0).toFixed(1)}</span>
            </div>
          </div>
          <Separator className="my-1" />
          <div className="flex items-center gap-1">
            <Spline className="h-2.5 w-2.5 text-primary" />
            <span className="text-[8px] font-mono-code text-muted-foreground uppercase flex-1">Bézier</span>
            <Button variant="ghost" size="sm" className="h-4 px-1 text-[8px]" onClick={toggleHandles}>
              {(wp.controlIn || wp.controlOut) ? <><X className="h-2 w-2 mr-0.5" /> Rem</> : <><Plus className="h-2 w-2 mr-0.5" /> Add</>}
            </Button>
          </div>
          {wp.controlIn && <Vec3Input label="Control In" value={wp.controlIn} onChange={(v) => updateWaypoint(traj.id, wp.id, { controlIn: v })} />}
          {wp.controlOut && <Vec3Input label="Control Out" value={wp.controlOut} onChange={(v) => updateWaypoint(traj.id, wp.id, { controlOut: v })} />}
        </div>
      )}
    </div>
  );
}

/* ── main editor ─────────────────────────────────────────────── */

export default function WaypointEditor({ onClose }: { onClose: () => void }) {
  const {
    trajectories, positions, selectedTrajectoryId, selectedWaypointId,
    selectTrajectory, selectWaypoint, addTrajectory, addWaypoint,
    removeWaypoint, updateWaypoint, setEditorMode, editorMode,
    drawHeight, setDrawHeight, undoLastWaypoint,
    showTrajectories, setShowTrajectories, showFormations, setShowFormations,
    selectedTrajectoryIds, toggleTrajectorySelection, selectAllFormationTrajectories,
    clearTrajectorySelection, batchOffsetWaypoints, batchScaleWaypoints,
    droneFormations,
  } = useProjectStore();

  const [presetRadius, setPresetRadius] = useState(15);
  const [presetCount, setPresetCount] = useState(12);
  const [batchMode, setBatchMode] = useState(false);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [offsetZ, setOffsetZ] = useState(0);

  const dronePads = positions.filter((p) => p.type === 'drone-pad');
  const selectedTraj = trajectories.find((t) => t.id === selectedTrajectoryId);
  const sortedWps = selectedTraj ? [...selectedTraj.waypoints].sort((a, b) => a.time - b.time) : [];

  /* ── keyboard shortcuts ── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;

      // Delete selected waypoint
      if (e.key === 'Delete' && selectedWaypointId && selectedTrajectoryId) {
        e.preventDefault();
        removeWaypoint(selectedTrajectoryId, selectedWaypointId);
        selectWaypoint(null);
      }
      // B = toggle bézier on selected waypoint
      if (e.key === 'b' || e.key === 'B') {
        if (!selectedWaypointId || !selectedTraj) return;
        const wp = selectedTraj.waypoints.find((w) => w.id === selectedWaypointId);
        if (!wp) return;
        e.preventDefault();
        if (wp.controlIn || wp.controlOut) {
          updateWaypoint(selectedTraj.id, wp.id, { controlIn: undefined, controlOut: undefined });
        } else {
          updateWaypoint(selectedTraj.id, wp.id, { controlIn: { x: 0, y: -1, z: 0 }, controlOut: { x: 0, y: 1, z: 0 } });
        }
      }
      // Ctrl+Z = undo last waypoint
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undoLastWaypoint();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedWaypointId, selectedTrajectoryId, selectedTraj, removeWaypoint, selectWaypoint, updateWaypoint, undoLastWaypoint]);

  const handleAddWp = () => {
    if (!selectedTrajectoryId) return;
    const lastWp = sortedWps[sortedWps.length - 1];
    const time = lastWp ? lastWp.time + 2 : 2;
    const pos = lastWp ? { ...lastWp.position, y: lastWp.position.y + 2 } : { x: 0, y: drawHeight, z: 0 };
    addWaypoint(selectedTrajectoryId, {
      id: `wp-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      position: pos,
      time,
    });
  };

  const applyPreset = (preset: PresetDef) => {
    if (!selectedTrajectoryId) return;
    const wps = preset.generate(presetRadius, drawHeight, presetCount);
    const baseTime = sortedWps.length > 0 ? sortedWps[sortedWps.length - 1].time + 2 : 0;
    wps.forEach((wp, i) => {
      addWaypoint(selectedTrajectoryId, {
        id: `wp-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 4)}`,
        position: wp.position,
        time: baseTime + wp.time,
      });
    });
  };

  // Stats
  let totalDist = 0;
  for (let i = 1; i < sortedWps.length; i++) {
    const a = sortedWps[i - 1].position;
    const b = sortedWps[i].position;
    totalDist += Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2 + (b.z - a.z) ** 2);
  }
  const totalTime = sortedWps.length >= 2 ? sortedWps[sortedWps.length - 1].time - sortedWps[0].time : 0;
  const avgSpeed = totalTime > 0 ? totalDist / totalTime : 0;

  const isDrawMode = editorMode === 'add-waypoint';

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
        {/* Shortcuts hint */}
        <div className="bg-surface-2/50 rounded-sm px-2 py-1 text-[8px] font-mono-code text-muted-foreground space-y-0.5">
          <p><kbd className="bg-surface-1 px-0.5 rounded text-foreground">Del</kbd> remover WP · <kbd className="bg-surface-1 px-0.5 rounded text-foreground">B</kbd> toggle Bézier · <kbd className="bg-surface-1 px-0.5 rounded text-foreground">Ctrl+Z</kbd> undo</p>
        </div>

        {/* Visibility toggles */}
        <div className="flex gap-1">
          <Button
            variant={showTrajectories ? 'outline' : 'ghost'}
            size="sm" className="flex-1 h-6 text-[8px] gap-1"
            onClick={() => setShowTrajectories(!showTrajectories)}
          >
            {showTrajectories ? <Eye className="h-2.5 w-2.5" /> : <EyeOff className="h-2.5 w-2.5" />}
            Trajetórias
          </Button>
          <Button
            variant={showFormations ? 'outline' : 'ghost'}
            size="sm" className="flex-1 h-6 text-[8px] gap-1"
            onClick={() => setShowFormations(!showFormations)}
          >
            {showFormations ? <Eye className="h-2.5 w-2.5" /> : <EyeOff className="h-2.5 w-2.5" />}
            Formações
          </Button>
        </div>

        <Separator />

        {/* Batch / Single mode toggle */}
        <div className="flex gap-1">
          <Button
            variant={!batchMode ? 'default' : 'outline'}
            size="sm" className="flex-1 h-6 text-[8px] gap-1"
            onClick={() => setBatchMode(false)}
          >
            Individual
          </Button>
          <Button
            variant={batchMode ? 'default' : 'outline'}
            size="sm" className="flex-1 h-6 text-[8px] gap-1"
            onClick={() => setBatchMode(true)}
          >
            <CheckSquare className="h-2.5 w-2.5" /> Coletivo ({selectedTrajectoryIds.length})
          </Button>
        </div>

        {batchMode && (
          <>
            {/* Formation quick-select */}
            {droneFormations.length > 0 && (
              <div>
                <p className="text-[8px] font-mono-code text-muted-foreground uppercase mb-1">Selecionar por Formação</p>
                <div className="flex flex-wrap gap-1">
                  {droneFormations.map((f, i) => (
                    <Button key={f.id} variant="outline" size="sm" className="h-5 text-[8px] px-1.5"
                      onClick={() => selectAllFormationTrajectories(i)}>
                      F{i + 1} ({f.droneCount})
                    </Button>
                  ))}
                  <Button variant="ghost" size="sm" className="h-5 text-[8px] px-1.5"
                    onClick={clearTrajectorySelection}>
                    Limpar
                  </Button>
                </div>
              </div>
            )}

            {/* Multi-select trajectory list */}
            <div className="space-y-0.5 max-h-24 overflow-auto">
              {trajectories.map((traj) => {
                const pad = positions.find((p) => p.id === traj.positionId);
                const isSel = selectedTrajectoryIds.includes(traj.id);
                return (
                  <button key={traj.id} onClick={() => toggleTrajectorySelection(traj.id)}
                    className={cn(
                      "w-full flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[8px] font-mono-code transition-colors",
                      isSel ? "bg-primary/15 text-primary border border-primary/30" : "bg-surface-2/30 text-muted-foreground hover:bg-surface-2 border border-transparent"
                    )}>
                    <div className={cn("w-2 h-2 rounded-sm border", isSel ? "bg-primary border-primary" : "border-muted-foreground/40")} />
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: pad?.color || '#00B4D8' }} />
                    <span className="flex-1 text-left truncate">{traj.name}</span>
                    <span className="text-muted-foreground/50">{traj.waypoints.length}wp</span>
                  </button>
                );
              })}
            </div>

            {/* Offset controls */}
            {selectedTrajectoryIds.length > 0 && (
              <div className="space-y-1.5">
                <Separator />
                <p className="text-[8px] font-mono-code text-muted-foreground uppercase">Offset Coletivo</p>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { label: 'X', value: offsetX, set: setOffsetX },
                    { label: 'Y', value: offsetY, set: setOffsetY },
                    { label: 'Z', value: offsetZ, set: setOffsetZ },
                  ].map(({ label, value, set }) => (
                    <div key={label}>
                      <p className="text-[7px] text-muted-foreground text-center">{label}</p>
                      <Input type="number" step={1} value={value}
                        onChange={(e) => set(parseFloat(e.target.value) || 0)}
                        className="h-5 text-[9px] font-mono-code px-1 bg-surface-2 border-border text-center" />
                    </div>
                  ))}
                </div>
                <div className="flex gap-1">
                  <Button variant="default" size="sm" className="flex-1 h-6 text-[8px] gap-1"
                    onClick={() => {
                      batchOffsetWaypoints(selectedTrajectoryIds, { x: offsetX, y: offsetY, z: offsetZ });
                      toast.success(`Offset aplicado a ${selectedTrajectoryIds.length} trajetórias`);
                      setOffsetX(0); setOffsetY(0); setOffsetZ(0);
                    }}>
                    <Move className="h-2.5 w-2.5" /> Aplicar Offset
                  </Button>
                </div>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" className="flex-1 h-5 text-[7px]"
                    onClick={() => { batchScaleWaypoints(selectedTrajectoryIds, 1.2); toast.success('Escala +20%'); }}>
                    <Maximize2 className="h-2 w-2" /> +20%
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 h-5 text-[7px]"
                    onClick={() => { batchScaleWaypoints(selectedTrajectoryIds, 0.8); toast.success('Escala -20%'); }}>
                    <Minimize2 className="h-2 w-2" /> -20%
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {!batchMode && (
          <>
        {/* Draw height control */}
        <div>
          <div className="flex items-center gap-1 mb-0.5">
            <ArrowUpDown className="h-2.5 w-2.5 text-primary" />
            <p className="text-[8px] font-mono-code text-muted-foreground uppercase flex-1">Altura do Desenho</p>
            <span className="text-[9px] font-mono-code text-foreground">{drawHeight.toFixed(0)}m</span>
          </div>
          <Slider min={1} max={120} step={1} value={[drawHeight]}
            onValueChange={([v]) => setDrawHeight(v)} />
        </div>

        <Separator />

        {/* Trajectory selector */}
        <div>
          <p className="text-[8px] font-mono-code text-muted-foreground uppercase mb-1">Trajetória</p>
          <div className="space-y-0.5">
            {trajectories.map((traj) => {
              const pad = positions.find((p) => p.id === traj.positionId);
              return (
                <button key={traj.id} onClick={() => selectTrajectory(traj.id)}
                  className={cn(
                    "w-full flex items-center gap-1.5 px-2 py-1 rounded-sm text-[9px] font-mono-code transition-colors",
                    selectedTrajectoryId === traj.id
                      ? "bg-primary/15 text-primary border border-primary/30"
                      : "bg-surface-2/50 text-muted-foreground hover:bg-surface-2 border border-transparent"
                  )}>
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: pad?.color || '#00B4D8' }} />
                  <span className="flex-1 text-left truncate">{traj.name}</span>
                  <span className="text-muted-foreground/60">{traj.waypoints.length} wp</span>
                </button>
              );
            })}
            {dronePads.filter((pad) => !trajectories.some((t) => t.positionId === pad.id)).map((pad) => (
              <button key={`create-${pad.id}`}
                onClick={() => {
                  const id = `traj-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
                  addTrajectory({ id, positionId: pad.id, waypoints: [], name: `Traj ${pad.name}` });
                  selectTrajectory(id);
                }}
                className="w-full flex items-center gap-1.5 px-2 py-1 rounded-sm text-[9px] font-mono-code bg-primary/5 text-primary/70 hover:bg-primary/15 border border-dashed border-primary/20 transition-colors">
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
                <p className={cn("text-[10px] font-mono-code font-bold", avgSpeed > 15 ? "text-destructive" : "text-success")}>{avgSpeed.toFixed(1)} m/s</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-1">
              <Button variant="outline" size="sm" className="flex-1 h-6 text-[9px] gap-1" onClick={handleAddWp}>
                <Plus className="h-2.5 w-2.5" /> Add WP
              </Button>
              <Button
                variant={isDrawMode ? 'default' : 'outline'} size="sm"
                className="flex-1 h-6 text-[9px] gap-1"
                onClick={() => setEditorMode(isDrawMode ? 'select' : 'add-waypoint')}>
                <PenTool className="h-2.5 w-2.5" /> {isDrawMode ? 'Drawing…' : 'Draw 2D'}
              </Button>
              <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[9px]" onClick={undoLastWaypoint} title="Undo (Ctrl+Z)">
                <Undo2 className="h-2.5 w-2.5" />
              </Button>
            </div>

            {isDrawMode && (
              <div className="bg-primary/5 border border-primary/20 rounded-sm px-2 py-1.5 text-[8px] font-mono-code text-primary/80">
                <p className="font-bold mb-0.5">Modo Desenho 2D Ativo</p>
                <p>Clique no viewport para adicionar waypoints a {drawHeight}m de altura. Ajuste a altura acima entre cliques.</p>
              </div>
            )}

            <Separator />

            {/* Presets */}
            <div>
              <p className="text-[8px] font-mono-code text-muted-foreground uppercase mb-1">Presets de Trajetória</p>
              <div className="flex gap-1 mb-1.5">
                <div className="flex-1">
                  <p className="text-[7px] text-muted-foreground mb-0.5">Raio (m)</p>
                  <Input type="number" value={presetRadius} onChange={(e) => setPresetRadius(parseFloat(e.target.value) || 5)}
                    className="h-5 text-[9px] font-mono-code px-1 bg-surface-2 border-border" />
                </div>
                <div className="flex-1">
                  <p className="text-[7px] text-muted-foreground mb-0.5">Pontos</p>
                  <Input type="number" value={presetCount} onChange={(e) => setPresetCount(parseInt(e.target.value) || 8)}
                    className="h-5 text-[9px] font-mono-code px-1 bg-surface-2 border-border" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1">
                {PRESETS.map((p) => (
                  <Button key={p.id} variant="outline" size="sm" className="h-6 text-[8px] gap-1"
                    onClick={() => applyPreset(p)}>
                    <p.icon className="h-2.5 w-2.5" /> {p.label}
                  </Button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Waypoint list */}
            <div className="space-y-1">
              {sortedWps.map((wp, i) => (
                <WaypointRow key={wp.id} wp={wp} index={i} traj={selectedTraj} prevWp={i > 0 ? sortedWps[i - 1] : undefined} />
              ))}
              {sortedWps.length === 0 && (
                <p className="text-[9px] text-muted-foreground/50 text-center py-3">
                  Nenhum waypoint. Use "Add WP", "Draw 2D" ou um preset.
                </p>
              )}
            </div>
          </>
        )}
          </>
        )}
      </div>
    </div>
  );
}
