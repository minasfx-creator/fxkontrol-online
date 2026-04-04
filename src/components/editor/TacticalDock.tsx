/**
 * TacticalDock — Vertical macOS-style dock for editing tools
 * Wrapped in DraggableFloatingPanel for repositioning
 */
import { MousePointer2, Move, RotateCw, Maximize2, Lasso, Plus, Axis3D, Magnet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProjectStore } from '@/store/useProjectStore';
import { useSceneStore } from '@/store/useSceneStore';
import { isLassoActive } from './SelectionModeBar';
import { useState, useEffect, useCallback } from 'react';
import DraggableFloatingPanel from './DraggableFloatingPanel';

type DockTool = 'select' | 'translate' | 'rotate' | 'scale' | 'lasso' | 'add';

const TOOLS: { id: DockTool; icon: typeof Move; label: string; shortcut: string }[] = [
  { id: 'select', icon: MousePointer2, label: 'Select', shortcut: 'V' },
  { id: 'translate', icon: Move, label: 'Move', shortcut: 'W' },
  { id: 'rotate', icon: RotateCw, label: 'Rotate', shortcut: 'E' },
  { id: 'scale', icon: Maximize2, label: 'Scale', shortcut: 'R' },
  { id: 'lasso', icon: Lasso, label: 'Lasso Select', shortcut: 'L' },
  { id: 'add', icon: Plus, label: 'Add Position', shortcut: 'A' },
];

export default function TacticalDock() {
  const editorMode = useProjectStore(s => s.editorMode);
  const setEditorMode = useProjectStore(s => s.setEditorMode);
  const env = useSceneStore(s => s.environment);
  const updateEnvironment = useSceneStore(s => s.updateEnvironment);
  const transformMode = env.positionTransformMode;
  const showAxes = env.showAxesHelper;

  const [lassoOn, setLassoOn] = useState(false);

  const activeTool: DockTool = (() => {
    if (lassoOn && editorMode === 'select') return 'lasso';
    if (editorMode === 'add-pyro' || editorMode === 'add-drone') return 'add';
    if (editorMode === 'select') {
      if (transformMode === 'rotate') return 'rotate';
      if (transformMode === 'scale') return 'scale';
      if (transformMode === 'translate') return 'translate';
      return 'select';
    }
    return 'select';
  })();

  const handleToolClick = useCallback((tool: DockTool) => {
    switch (tool) {
      case 'select':
        setEditorMode('select');
        setLassoOn(false);
        break;
      case 'translate':
        setEditorMode('select');
        updateEnvironment({ positionTransformMode: 'translate' });
        setLassoOn(false);
        break;
      case 'rotate':
        setEditorMode('select');
        updateEnvironment({ positionTransformMode: 'rotate' });
        setLassoOn(false);
        break;
      case 'scale':
        setEditorMode('select');
        updateEnvironment({ positionTransformMode: 'scale' });
        setLassoOn(false);
        break;
      case 'lasso':
        setEditorMode('select');
        setLassoOn(prev => !prev);
        break;
      case 'add':
        setEditorMode('add-pyro');
        setLassoOn(false);
        break;
    }
  }, [setEditorMode, updateEnvironment]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const key = e.key.toLowerCase();
      if (key === 'v') handleToolClick('select');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleToolClick]);

  return (
    <DraggableFloatingPanel panelId="tactical-dock" initialX={12} initialY={Math.round(window.innerHeight / 2 - 150)}>
      <div className="flex flex-col items-center gap-0.5 p-1">
        {TOOLS.map(({ id, icon: Icon, label, shortcut }) => {
          const isActive = activeTool === id;
          return (
            <button
              key={id}
              onClick={() => handleToolClick(id)}
              className={cn(
                "relative w-9 h-9 rounded-xl flex items-center justify-center transition-all group",
                isActive
                  ? "bg-primary/20 text-primary shadow-md shadow-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
              )}
              title={`${label} (${shortcut})`}
            >
              <Icon className="w-4 h-4" />
              <span className="absolute left-full ml-2 px-2 py-1 rounded-lg text-[10px] font-medium bg-popover border border-border/30 text-foreground opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap shadow-lg z-50">
                {label}
                <kbd className="ml-1.5 text-[8px] text-muted-foreground/60 bg-muted/40 px-1 py-0.5 rounded">{shortcut}</kbd>
              </span>
              {isActive && (
                <span className="absolute -right-0.5 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-primary shadow-sm shadow-primary/50" />
              )}
            </button>
          );
        })}

        <div className="w-5 h-px bg-border/30 my-0.5" />

        <button
          onClick={() => updateEnvironment({ showAxesHelper: !showAxes })}
          className={cn(
            "w-9 h-9 rounded-xl flex items-center justify-center transition-all group",
            showAxes
              ? "bg-accent/20 text-accent-foreground"
              : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/20"
          )}
          title="Axes Helper"
        >
          <Axis3D className="w-4 h-4" />
        </button>

        <button
          onClick={() => {
            const snaps = [0.1, 0.5, 1, 5, 10];
            const idx = snaps.indexOf(env.gridSnapResolution);
            const next = snaps[(idx + 1) % snaps.length];
            updateEnvironment({ gridSnapResolution: next });
          }}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-all text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/20 group"
          title={`Snap: ${env.gridSnapResolution >= 1 ? `${env.gridSnapResolution}m` : `${env.gridSnapResolution * 100}cm`}`}
        >
          <Magnet className="w-4 h-4" />
          <span className="absolute left-full ml-2 px-2 py-1 rounded-lg text-[9px] font-mono bg-popover border border-border/30 text-foreground opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap shadow-lg z-50">
            {env.gridSnapResolution >= 1 ? `${env.gridSnapResolution}m` : `${env.gridSnapResolution * 100}cm`}
          </span>
        </button>
      </div>
    </DraggableFloatingPanel>
  );
}
