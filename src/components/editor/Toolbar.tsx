import { useState } from 'react';
import { Rocket, Save, FolderOpen, Undo, Redo, MapPin, Target, MousePointer, Shapes } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProjectStore } from '@/store/useProjectStore';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import FormationBuilder from './FormationBuilder';

export default function Toolbar() {
  const { projectName, timelineItems, positions, editorMode, setEditorMode } = useProjectStore();
  const [formationOpen, setFormationOpen] = useState(false);

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
      </div>

      <FormationBuilder open={formationOpen} onOpenChange={setFormationOpen} />

      <div className="flex-1" />

      {/* Status */}
      <div className="flex items-center gap-3 text-[10px] font-mono-code text-muted-foreground">
        <span>{timelineItems.length} items</span>
        <span>{positions.length} pins</span>
        <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse-glow" />
        <span className="text-success">Ready</span>
      </div>
    </div>
  );
}
