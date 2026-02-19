import { Plus, Trash2, Route, Eye, EyeOff, MapPin, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useProjectStore } from '@/store/useProjectStore';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { useCallback, useState } from 'react';

const PRESET_COLORS = [
  '#00B4D8', '#FF0000', '#00FF00', '#0000FF', '#FFD700',
  '#FF69B4', '#9B30FF', '#FF4500', '#00FFFF', '#FFFFFF',
];

function ColorPicker({ color, onChange }: { color: string; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        className="w-5 h-5 rounded-sm border border-border cursor-pointer"
        style={{ backgroundColor: color }}
        onClick={() => setOpen(!open)}
      />
      {open && (
        <div className="absolute top-6 left-0 z-50 bg-card border border-border rounded-md p-1.5 grid grid-cols-5 gap-1 shadow-lg">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              className={cn("w-5 h-5 rounded-sm border cursor-pointer", c === color ? "border-primary ring-1 ring-primary" : "border-border")}
              style={{ backgroundColor: c }}
              onClick={() => { onChange(c); setOpen(false); }}
            />
          ))}
          <input
            type="color"
            value={color}
            onChange={(e) => { onChange(e.target.value); setOpen(false); }}
            className="w-5 h-5 col-span-5 cursor-pointer bg-transparent border-0 p-0"
          />
        </div>
      )}
    </div>
  );
}

export default function ScriptPanel() {
  const {
    positions, trajectories, selectedTrajectoryId,
    selectTrajectory, addTrajectory, removeTrajectory,
    removeWaypoint, updateWaypoint, showTrajectories, setShowTrajectories,
    editorMode, setEditorMode, updatePosition,
  } = useProjectStore();

  const dronePads = positions.filter((p) => p.type === 'drone-pad');

  const handleCreateTrajectory = (positionId: string) => {
    const pos = positions.find((p) => p.id === positionId);
    if (!pos) return;
    const id = `traj-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    addTrajectory({ id, positionId, waypoints: [], name: `Traj ${pos.name}` });
    selectTrajectory(id);
  };

  const handleAddWaypointMode = (trajId: string) => {
    selectTrajectory(trajId);
    setEditorMode('add-waypoint');
  };

  // Build flat rows for the spreadsheet
  const rows: Array<{
    type: 'pad';
    pad: typeof dronePads[0];
  } | {
    type: 'waypoint';
    pad: typeof dronePads[0];
    traj: typeof trajectories[0];
    wp: typeof trajectories[0]['waypoints'][0];
    wpIndex: number;
  }> = [];

  dronePads.forEach((pad) => {
    rows.push({ type: 'pad', pad });
    const padTrajs = trajectories.filter((t) => t.positionId === pad.id);
    padTrajs.forEach((traj) => {
      const sorted = [...traj.waypoints].sort((a, b) => a.time - b.time);
      sorted.forEach((wp, i) => {
        rows.push({ type: 'waypoint', pad, traj, wp, wpIndex: i });
      });
    });
  });

  return (
    <div className="h-full flex flex-col bg-card border-l border-border">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        <Route className="h-3.5 w-3.5 text-muted-foreground" />
        <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider flex-1">Script</h2>
        <Button
          variant="ghost" size="icon" className="h-6 w-6"
          onClick={() => setShowTrajectories(!showTrajectories)}
          title={showTrajectories ? 'Hide trajectories' : 'Show trajectories'}
        >
          {showTrajectories ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
        </Button>
      </div>

      <div className="flex-1 overflow-auto">
        {/* Spreadsheet table */}
        <table className="w-full text-[9px] font-mono-code border-collapse">
          <thead className="sticky top-0 bg-surface-1 z-10">
            <tr className="border-b border-border">
              <th className="px-1 py-1 text-left text-muted-foreground font-medium w-6">🎨</th>
              <th className="px-1 py-1 text-left text-muted-foreground font-medium">Nome</th>
              <th className="px-1 py-1 text-left text-muted-foreground font-medium">T(s)</th>
              <th className="px-1 py-1 text-left text-muted-foreground font-medium">Pos</th>
              <th className="px-1 py-1 text-left text-muted-foreground font-medium">Dest</th>
              <th className="px-1 py-1 text-center text-muted-foreground font-medium w-8">⚙️</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => {
              if (row.type === 'pad') {
                const pad = row.pad;
                const padTrajs = trajectories.filter((t) => t.positionId === pad.id);
                return (
                  <tr
                    key={`pad-${pad.id}`}
                    className="border-b border-border/30 bg-surface-2/50 hover:bg-surface-3/50"
                  >
                    <td className="px-1 py-1">
                      <ColorPicker
                        color={pad.color || '#00B4D8'}
                        onChange={(c) => updatePosition(pad.id, { color: c })}
                      />
                    </td>
                    <td className="px-1 py-1">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-2.5 w-2.5 text-primary flex-shrink-0" />
                        <span className="text-foreground font-medium">{pad.name}</span>
                      </div>
                    </td>
                    <td className="px-1 py-1 text-muted-foreground">0.0</td>
                    <td className="px-1 py-1 text-muted-foreground">
                      {pad.x.toFixed(1)},{pad.y.toFixed(1)},{pad.z.toFixed(1)}
                    </td>
                    <td className="px-1 py-1 text-muted-foreground">—</td>
                    <td className="px-1 py-1 text-center">
                      <div className="flex items-center justify-center gap-0.5">
                        <button
                          className="text-primary/70 hover:text-primary"
                          title="Criar trajetória"
                          onClick={() => handleCreateTrajectory(pad.id)}
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                        {padTrajs.length > 0 && (
                          <button
                            className={cn(
                              "hover:text-primary",
                              editorMode === 'add-waypoint' && selectedTrajectoryId === padTrajs[0]?.id
                                ? "text-primary"
                                : "text-muted-foreground"
                            )}
                            title="Adicionar waypoint"
                            onClick={() => handleAddWaypointMode(padTrajs[0].id)}
                          >
                            <Route className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              }

              // Waypoint row
              const { pad, traj, wp, wpIndex } = row;
              const isSelected = selectedTrajectoryId === traj.id;
              // Next waypoint for "destination"
              const sortedWps = [...traj.waypoints].sort((a, b) => a.time - b.time);
              const nextWp = sortedWps[wpIndex + 1];

              return (
                <tr
                  key={`wp-${wp.id}`}
                  className={cn(
                    "border-b border-border/20 cursor-pointer transition-colors",
                    isSelected ? "bg-primary/5" : "hover:bg-surface-2/30"
                  )}
                  onClick={() => selectTrajectory(traj.id)}
                >
                  <td className="px-1 py-0.5">
                    <div className="w-2 h-2 rounded-full ml-1.5" style={{ backgroundColor: pad.color || '#00B4D8' }} />
                  </td>
                  <td className="px-1 py-0.5 text-electric">
                    WP{wpIndex + 1}
                  </td>
                  <td className="px-1 py-0.5">
                    <input
                      type="number"
                      step="0.1"
                      className="w-10 bg-transparent border-b border-border/30 text-safety focus:border-primary outline-none px-0.5"
                      value={wp.time}
                      onChange={(e) => updateWaypoint(traj.id, wp.id, { time: parseFloat(e.target.value) || 0 })}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td className="px-1 py-0.5">
                    <div className="flex gap-0.5">
                      <input
                        type="number" step="0.1"
                        className="w-7 bg-transparent border-b border-border/30 text-destructive focus:border-primary outline-none"
                        value={wp.position.x}
                        onChange={(e) => updateWaypoint(traj.id, wp.id, { position: { ...wp.position, x: parseFloat(e.target.value) || 0 } })}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <input
                        type="number" step="0.1"
                        className="w-7 bg-transparent border-b border-border/30 text-success focus:border-primary outline-none"
                        value={wp.position.y}
                        onChange={(e) => updateWaypoint(traj.id, wp.id, { position: { ...wp.position, y: parseFloat(e.target.value) || 0 } })}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <input
                        type="number" step="0.1"
                        className="w-7 bg-transparent border-b border-border/30 text-electric focus:border-primary outline-none"
                        value={wp.position.z}
                        onChange={(e) => updateWaypoint(traj.id, wp.id, { position: { ...wp.position, z: parseFloat(e.target.value) || 0 } })}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </td>
                  <td className="px-1 py-0.5 text-muted-foreground/60">
                    {nextWp
                      ? `${nextWp.position.x.toFixed(1)},${nextWp.position.y.toFixed(1)},${nextWp.position.z.toFixed(1)}`
                      : '—'}
                  </td>
                  <td className="px-1 py-0.5 text-center">
                    <button
                      className="text-destructive/40 hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); removeWaypoint(traj.id, wp.id); }}
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {dronePads.length === 0 && (
          <div className="px-3 py-4 text-center">
            <p className="text-[10px] text-muted-foreground/60">
              Adicione drone pads no viewport para criar trajetórias
            </p>
          </div>
        )}

        <Separator className="my-2" />

        {/* Instructions */}
        <div className="px-2 pb-2 space-y-1">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Como usar</p>
          <ol className="text-[8px] text-muted-foreground/70 space-y-0.5 list-decimal list-inside">
            <li>Adicione Drone Pads no viewport</li>
            <li>Clique + para criar trajetória</li>
            <li>Clique <Route className="inline h-2 w-2" /> e depois no 3D para add waypoints</li>
            <li>Edite tempo e posição direto na planilha</li>
            <li>🎨 Troque a cor do LED do drone</li>
            <li>Shift+Click para multi-selecionar posições</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
