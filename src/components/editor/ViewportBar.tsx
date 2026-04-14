/**
 * ViewportBar — Fixed horizontal toolbar at top of 3D viewport.
 * Always visible on desktop. Provides standard view presets, quick actions, and toggles.
 */
import { useViewportStore, type ViewPreset } from '@/store/useViewportStore';
import { useProjectStore } from '@/store/useProjectStore';
import { useSceneStore } from '@/store/useSceneStore';
import {
  Box, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Maximize2, Grid3x3,
  Axis3D, Eye, Lightbulb, Mountain, Focus, ScanSearch, RotateCcw, Hexagon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const VIEW_PRESETS: { id: ViewPreset; label: string; shortLabel: string; icon: typeof Box }[] = [
  { id: 'perspective', label: 'Perspective', shortLabel: 'Persp', icon: Hexagon },
  { id: 'top', label: 'Top', shortLabel: 'Top', icon: ArrowDown },
  { id: 'front', label: 'Front', shortLabel: 'Front', icon: Box },
  { id: 'back', label: 'Back', shortLabel: 'Back', icon: Box },
  { id: 'left', label: 'Left', shortLabel: 'Left', icon: ArrowLeft },
  { id: 'right', label: 'Right', shortLabel: 'Right', icon: ArrowRight },
  { id: 'iso', label: 'Isometric', shortLabel: 'Iso', icon: Box },
];

function BarButton({ 
  active, onClick, title, children, className 
}: { 
  active?: boolean; onClick: () => void; title: string; children: React.ReactNode; className?: string 
}) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            className={cn(
              'h-7 px-2 rounded-md text-[10px] font-medium flex items-center gap-1 transition-all border',
              active
                ? 'bg-primary/15 text-primary border-primary/30'
                : 'bg-transparent text-muted-foreground border-transparent hover:bg-muted/40 hover:text-foreground hover:border-border/30',
              className
            )}
          >
            {children}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-[10px]">
          {title}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function Separator() {
  return <div className="w-px h-5 bg-border/30 mx-0.5" />;
}

export default function ViewportBar() {
  const viewPreset = useViewportStore(s => s.viewPreset);
  const projection = useViewportStore(s => s.projection);
  const showGrid = useViewportStore(s => s.showGrid);
  const showAxes = useViewportStore(s => s.showAxes);
  const showHelpers = useViewportStore(s => s.showHelpers);
  const showGround = useViewportStore(s => s.showGround);
  const setViewPreset = useViewportStore(s => s.setViewPreset);
  const setProjection = useViewportStore(s => s.setProjection);
  const toggleGrid = useViewportStore(s => s.toggleGrid);
  const toggleAxes = useViewportStore(s => s.toggleAxes);
  const toggleHelpers = useViewportStore(s => s.toggleHelpers);
  const toggleGround = useViewportStore(s => s.toggleGround);
  const frameSelection = useViewportStore(s => s.frameSelection);
  const frameAll = useViewportStore(s => s.frameAll);
  const resetCamera = useViewportStore(s => s.resetCamera);

  const editorMode = useProjectStore(s => s.editorMode);

  // Mode chip label
  const modeLabels: Record<string, string> = {
    select: 'Select',
    place: 'Add Pyro',
    'place-drone': 'Add Drone',
    'place-waypoint': 'Add Waypoint',
    'adjust-angles': 'Adjust Angles',
  };
  const modeLabel = modeLabels[editorMode] || editorMode;

  return (
    <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 flex items-center gap-0.5 bg-card/85 backdrop-blur-xl border border-border/25 rounded-xl px-2 py-1 shadow-lg select-none">
      {/* Mode chip */}
      <div className={cn(
        'h-6 px-2.5 rounded-md text-[9px] font-semibold uppercase tracking-wider flex items-center gap-1 mr-1',
        editorMode === 'select'
          ? 'bg-muted/40 text-muted-foreground'
          : 'bg-primary/20 text-primary border border-primary/30'
      )}>
        <Eye className="w-3 h-3" />
        {modeLabel}
      </div>

      <Separator />

      {/* View presets */}
      {VIEW_PRESETS.map(vp => (
        <BarButton
          key={vp.id}
          active={viewPreset === vp.id}
          onClick={() => setViewPreset(vp.id)}
          title={vp.label}
        >
          {vp.shortLabel}
        </BarButton>
      ))}

      <Separator />

      {/* Projection toggle */}
      <BarButton
        active={projection === 'orthographic'}
        onClick={() => setProjection(projection === 'perspective' ? 'orthographic' : 'perspective')}
        title={`Projection: ${projection === 'perspective' ? 'Perspective' : 'Orthographic'}`}
      >
        {projection === 'perspective' ? 'Persp' : 'Ortho'}
      </BarButton>

      <Separator />

      {/* Quick actions */}
      <BarButton onClick={frameSelection} title="Frame Selection (F)">
        <Focus className="w-3.5 h-3.5" />
      </BarButton>
      <BarButton onClick={frameAll} title="Frame All (Home)">
        <ScanSearch className="w-3.5 h-3.5" />
      </BarButton>
      <BarButton onClick={resetCamera} title="Reset Camera">
        <RotateCcw className="w-3.5 h-3.5" />
      </BarButton>

      <Separator />

      {/* Toggles */}
      <BarButton active={showGrid} onClick={toggleGrid} title="Toggle Grid">
        <Grid3x3 className="w-3.5 h-3.5" />
      </BarButton>
      <BarButton active={showAxes} onClick={toggleAxes} title="Toggle Axes">
        <Axis3D className="w-3.5 h-3.5" />
      </BarButton>
      <BarButton active={showHelpers} onClick={toggleHelpers} title="Toggle Helpers">
        <Lightbulb className="w-3.5 h-3.5" />
      </BarButton>
      <BarButton active={showGround} onClick={toggleGround} title="Toggle Ground">
        <Mountain className="w-3.5 h-3.5" />
      </BarButton>
    </div>
  );
}
