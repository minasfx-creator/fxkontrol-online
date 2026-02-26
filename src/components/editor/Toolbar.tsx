import { useState } from 'react';
import { Rocket, Save, FolderOpen, Undo, Redo, MapPin, Target, MousePointer, Shapes, Route, LogOut, Upload, Wind, FileText, Package, Cpu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProjectStore } from '@/store/useProjectStore';
import { useAuth } from '@/hooks/useAuth';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import FormationBuilder from './FormationBuilder';
import CSVImporter from './CSVImporter';

function TimecodeDisplay() {
  const { currentTime, isPlaying } = useProjectStore();
  const h = Math.floor(currentTime / 3600);
  const m = Math.floor((currentTime % 3600) / 60);
  const s = Math.floor(currentTime % 60);
  const f = Math.floor((currentTime % 1) * 30); // 30fps frame count
  const tc = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}:${f.toString().padStart(2,'0')}`;

  return (
    <div className="flex items-center gap-2 px-3 py-0.5 bg-surface-0 rounded border border-border">
      <span className="font-mono-code text-sm tracking-[0.12em] text-electric font-bold">{tc}</span>
      <div className={cn(
        "w-1.5 h-1.5 rounded-full",
        isPlaying ? "bg-success animate-pulse-glow" : "bg-muted-foreground"
      )} />
    </div>
  );
}

export default function Toolbar({ onToggleScript, showScript, onToggleWindCamera, showWindCamera, onToggleReports, showReports, onToggleRacks, showRacks, onToggleAddressing, showAddressing }: { onToggleScript: () => void; showScript: boolean; onToggleWindCamera?: () => void; showWindCamera?: boolean; onToggleReports?: () => void; showReports?: boolean; onToggleRacks?: () => void; showRacks?: boolean; onToggleAddressing?: () => void; showAddressing?: boolean }) {
  const { projectName, timelineItems, positions, editorMode, setEditorMode } = useProjectStore();
  const { signOut, user } = useAuth();
  const [formationOpen, setFormationOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);

  return (
    <div className="flex items-center h-10 px-2 bg-surface-1 border-b border-border">
      {/* Logo */}
      <div className="flex items-center gap-2 mr-4">
        <div className="w-6 h-6 rounded bg-gradient-to-br from-electric to-safety flex items-center justify-center">
          <Rocket className="h-3.5 w-3.5 text-primary-foreground" />
        </div>
        <span className="text-sm font-semibold text-foreground tracking-tight">PyroDesigner</span>
      </div>

      <Separator orientation="vertical" className="h-5 mr-2" />

      {/* Project name */}
      <span className="text-xs text-muted-foreground mr-4 font-mono-code">{projectName}</span>

      {/* File actions */}
      <div className="flex items-center gap-0.5">
        <Button variant="ghost" size="icon" className="h-7 w-7" title="New">
          <FolderOpen className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" title="Save">
          <Save className="h-3.5 w-3.5" />
        </Button>
        <Separator orientation="vertical" className="h-4 mx-1" />
        <Button variant="ghost" size="icon" className="h-7 w-7" title="Undo">
          <Undo className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" title="Redo">
          <Redo className="h-3.5 w-3.5" />
        </Button>
      </div>

      <Separator orientation="vertical" className="h-4 mx-2" />

      {/* Position tools */}
      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-7 w-7",
            editorMode === 'select' && "bg-surface-3 text-primary"
          )}
          title="Select (V)"
          onClick={() => setEditorMode('select')}
        >
          <MousePointer className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-7 w-7",
            editorMode === 'add-pyro' && "bg-accent/20 text-accent"
          )}
          title="Add Pyro Position"
          onClick={() => setEditorMode(editorMode === 'add-pyro' ? 'select' : 'add-pyro')}
        >
          <MapPin className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-7 w-7",
            editorMode === 'add-drone' && "bg-primary/20 text-primary"
          )}
          title="Add Drone Launch Pad"
          onClick={() => setEditorMode(editorMode === 'add-drone' ? 'select' : 'add-drone')}
        >
          <Target className="h-3.5 w-3.5" />
        </Button>
        {editorMode !== 'select' && (
          <span className="text-[10px] font-mono-code text-muted-foreground ml-1">
            Click ground to place
          </span>
        )}
        <Separator orientation="vertical" className="h-4 mx-1" />
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title="Formation Builder"
          onClick={() => setFormationOpen(true)}
        >
          <Shapes className="h-3.5 w-3.5" />
        </Button>
        <Separator orientation="vertical" className="h-4 mx-1" />
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title="Import CSV Positions"
          onClick={() => setCsvOpen(true)}
        >
          <Upload className="h-3.5 w-3.5" />
        </Button>
        <Separator orientation="vertical" className="h-4 mx-1" />
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-7 w-7", showScript && "bg-surface-3 text-primary")}
          title="Toggle Script Panel"
          onClick={onToggleScript}
        >
          <Route className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-7 w-7", showWindCamera && "bg-surface-3 text-primary")}
          title="Wind & Camera"
          onClick={onToggleWindCamera}
        >
          <Wind className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-7 w-7", showReports && "bg-surface-3 text-primary")}
          title="Reports"
          onClick={onToggleReports}
        >
          <FileText className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-7 w-7", showRacks && "bg-surface-3 text-primary")}
          title="Rack Manager"
          onClick={onToggleRacks}
        >
          <Package className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-7 w-7", showAddressing && "bg-surface-3 text-primary")}
          title="Addressing"
          onClick={onToggleAddressing}
        >
          <Cpu className="h-3.5 w-3.5" />
        </Button>
      </div>

      <FormationBuilder open={formationOpen} onOpenChange={setFormationOpen} />
      <CSVImporter open={csvOpen} onOpenChange={setCsvOpen} />

      <div className="flex-1" />

      {/* Timecode Display */}
      <TimecodeDisplay />

      {/* Status */}
      <div className="flex items-center gap-3 text-[10px] font-mono-code text-muted-foreground ml-3">
        <span>{timelineItems.length} items</span>
        <span>{positions.length} pins</span>
        <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse-glow" />
        <span className="text-success">Sync: Locked</span>
        <Button variant="ghost" size="icon" className="h-6 w-6 ml-1" title="Sair" onClick={signOut}>
          <LogOut className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
