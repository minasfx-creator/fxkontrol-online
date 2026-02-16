import { Rocket, Save, FolderOpen, Undo, Redo, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProjectStore } from '@/store/useProjectStore';
import { Separator } from '@/components/ui/separator';

export default function Toolbar() {
  const { projectName, timelineItems } = useProjectStore();

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

      {/* Actions */}
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

      <div className="flex-1" />

      {/* Status */}
      <div className="flex items-center gap-3 text-[10px] font-mono-code text-muted-foreground">
        <span>{timelineItems.length} items</span>
        <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse-glow" />
        <span className="text-success">Ready</span>
      </div>
    </div>
  );
}
