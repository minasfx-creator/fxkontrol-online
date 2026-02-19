import { Plus, Trash2, Route, Eye, EyeOff, MapPin, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProjectStore } from '@/store/useProjectStore';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

export default function ScriptPanel() {
  const {
    positions, trajectories, selectedTrajectoryId,
    selectTrajectory, addTrajectory, removeTrajectory,
    removeWaypoint, showTrajectories, setShowTrajectories,
    editorMode, setEditorMode, selectedPositionId,
  } = useProjectStore();

  const dronePads = positions.filter((p) => p.type === 'drone-pad');

  const handleCreateTrajectory = (positionId: string) => {
    const pos = positions.find((p) => p.id === positionId);
    if (!pos) return;
    const id = `traj-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    addTrajectory({
      id,
      positionId,
      waypoints: [],
      name: `Traj ${pos.name}`,
    });
    selectTrajectory(id);
  };

  const handleAddWaypointMode = (trajId: string) => {
    selectTrajectory(trajId);
    setEditorMode('add-waypoint');
  };

  return (
    <div className="h-full flex flex-col bg-card border-l border-border">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        <Route className="h-3.5 w-3.5 text-muted-foreground" />
        <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider flex-1">Script</h2>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setShowTrajectories(!showTrajectories)}
          title={showTrajectories ? 'Hide trajectories' : 'Show trajectories'}
        >
          {showTrajectories ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2">
        {/* Drone Pads section */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1 mb-1">
            Drone Pads ({dronePads.length})
          </p>
          {dronePads.length === 0 && (
            <p className="text-[10px] text-muted-foreground/60 px-1">
              Adicione drone pads no viewport para criar trajetórias
            </p>
          )}
          {dronePads.map((pad) => {
            const padTrajs = trajectories.filter((t) => t.positionId === pad.id);
            return (
              <div key={pad.id} className="mb-2">
                <div className="flex items-center gap-1 px-1 py-0.5">
                  <MapPin className="h-3 w-3 text-primary" />
                  <span className="text-[10px] font-medium text-foreground flex-1">{pad.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    title="Criar trajetória"
                    onClick={() => handleCreateTrajectory(pad.id)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>

                {/* Trajectories for this pad */}
                {padTrajs.map((traj) => {
                  const isSelected = selectedTrajectoryId === traj.id;
                  return (
                    <div
                      key={traj.id}
                      className={cn(
                        "ml-3 rounded-sm border transition-colors cursor-pointer",
                        isSelected
                          ? "border-primary/50 bg-primary/5"
                          : "border-transparent hover:bg-surface-2"
                      )}
                      onClick={() => selectTrajectory(traj.id)}
                    >
                      <div className="flex items-center gap-1 px-1.5 py-1">
                        <Navigation className="h-3 w-3 text-electric" />
                        <span className="text-[10px] text-foreground flex-1">{traj.name}</span>
                        <span className="text-[9px] text-muted-foreground">
                          {traj.waypoints.length} wp
                        </span>
                      </div>

                      {/* Waypoints list when selected */}
                      {isSelected && (
                        <div className="px-1.5 pb-1.5 space-y-0.5">
                          {traj.waypoints
                            .sort((a, b) => a.time - b.time)
                            .map((wp, i) => (
                              <div
                                key={wp.id}
                                className="flex items-center gap-1 text-[9px] font-mono bg-surface-2 rounded-sm px-1.5 py-0.5"
                              >
                                <span className="text-safety">{wp.time.toFixed(1)}s</span>
                                <span className="text-muted-foreground">→</span>
                                <span className="text-destructive">X{wp.position.x.toFixed(1)}</span>
                                <span className="text-success">Y{wp.position.y.toFixed(1)}</span>
                                <span className="text-electric">Z{wp.position.z.toFixed(1)}</span>
                                <div className="flex-1" />
                                <button
                                  className="text-destructive/50 hover:text-destructive"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeWaypoint(traj.id, wp.id);
                                  }}
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          <div className="flex gap-1 mt-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className={cn(
                                "h-5 text-[9px] flex-1",
                                editorMode === 'add-waypoint' && selectedTrajectoryId === traj.id
                                  ? "bg-primary/20 text-primary"
                                  : ""
                              )}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddWaypointMode(traj.id);
                              }}
                            >
                              <Plus className="h-2.5 w-2.5 mr-0.5" />
                              Waypoint
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 text-destructive/50 hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeTrajectory(traj.id);
                              }}
                            >
                              <Trash2 className="h-2.5 w-2.5" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        <Separator />

        {/* Instructions */}
        <div className="px-1 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Como usar</p>
          <ol className="text-[9px] text-muted-foreground/70 space-y-0.5 list-decimal list-inside">
            <li>Adicione um Drone Pad no viewport</li>
            <li>Clique + para criar uma trajetória</li>
            <li>Clique "+ Waypoint" e depois no viewport 3D</li>
            <li>Os waypoints definem o caminho do drone</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
