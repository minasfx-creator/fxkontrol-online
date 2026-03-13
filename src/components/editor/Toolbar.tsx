import { useState } from 'react';
import { Rocket, Save, FolderOpen, Undo, Redo, MapPin, Target, MousePointer, Shapes, LogOut, Upload, FileJson } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProjectStore } from '@/store/useProjectStore';
import { useAuth } from '@/hooks/useAuth';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import FormationBuilder from './FormationBuilder';
import CSVImporter from './CSVImporter';
import VVIZImporter from './VVIZImporter';

function TimecodeDisplay() {
  const { currentTime, isPlaying } = useProjectStore();
  const h = Math.floor(currentTime / 3600);
  const m = Math.floor((currentTime % 3600) / 60);
  const s = Math.floor(currentTime % 60);
  const f = Math.floor((currentTime % 1) * 30);
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

function MenuButton({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-[10px] font-mono-code text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-surface-3 transition-colors uppercase tracking-wider"
    >
      {label}
    </button>
  );
}

export default function Toolbar() {
  const { projectName, timelineItems, positions, editorMode, setEditorMode } = useProjectStore();
  const { signOut, user } = useAuth();
  const [formationOpen, setFormationOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [vvizOpen, setVvizOpen] = useState(false);

  return (
    <div className="flex items-center h-10 px-2 bg-surface-1 border-b border-border">
      {/* Logo */}
      <div className="flex items-center gap-2 mr-3">
        <div className="w-6 h-6 rounded bg-gradient-to-br from-electric to-safety flex items-center justify-center">
          <Rocket className="h-3.5 w-3.5 text-primary-foreground" />
        </div>
        <span className="text-xs font-bold text-foreground tracking-[0.15em] uppercase font-mono-code">NEXUS PRIME</span>
      </div>

      <Separator orientation="vertical" className="h-5 mr-2" />

      {/* Menu items */}
      <div className="flex items-center gap-0.5">
        <MenuButton label="File: New" />
        <MenuButton label="Diagnostic" />
        <MenuButton label="Export" />
      </div>

      <Separator orientation="vertical" className="h-4 mx-2" />

      {/* Mode tools */}
      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-7 px-2 text-[10px] font-mono-code gap-1",
            editorMode === 'select' && "bg-surface-3 text-primary"
          )}
          title="Select (V)"
          onClick={() => setEditorMode('select')}
        >
          <MousePointer className="h-3 w-3" />
          <span className="hidden lg:inline">SELECT</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-7 px-2 text-[10px] font-mono-code gap-1",
            editorMode === 'add-pyro' && "bg-accent/20 text-accent"
          )}
          title="Add Pyro Position"
          onClick={() => setEditorMode(editorMode === 'add-pyro' ? 'select' : 'add-pyro')}
        >
          <MapPin className="h-3 w-3" />
          <span className="hidden lg:inline">PYRO</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-7 px-2 text-[10px] font-mono-code gap-1",
            editorMode === 'add-drone' && "bg-primary/20 text-primary"
          )}
          title="Add Drone Launch Pad"
          onClick={() => setEditorMode(editorMode === 'add-drone' ? 'select' : 'add-drone')}
        >
          <Target className="h-3 w-3" />
          <span className="hidden lg:inline">DRONE</span>
        </Button>
        {editorMode !== 'select' && (
          <span className="text-[9px] font-mono-code text-muted-foreground ml-1">
            Click to place
          </span>
        )}
      </div>

      <Separator orientation="vertical" className="h-4 mx-1" />

      {/* Tools */}
      <div className="flex items-center gap-0.5">
        <Button variant="ghost" size="icon" className="h-7 w-7" title="Formations" onClick={() => setFormationOpen(true)}>
          <Shapes className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" title="Import CSV" onClick={() => setCsvOpen(true)}>
          <Upload className="h-3.5 w-3.5" />
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
