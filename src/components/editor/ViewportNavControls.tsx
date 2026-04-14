import { ZoomIn, ZoomOut, Compass, Layers, Focus } from 'lucide-react';
import { useViewportStore } from '@/store/useViewportStore';

export default function ViewportNavControls() {
  const frameSelection = useViewportStore(s => s.frameSelection);
  const resetCamera = useViewportStore(s => s.resetCamera);

  const NAV_BUTTONS = [
    { icon: ZoomIn, title: 'Zoom In', action: () => window.dispatchEvent(new CustomEvent('viewport-zoom', { detail: 1 })) },
    { icon: ZoomOut, title: 'Zoom Out', action: () => window.dispatchEvent(new CustomEvent('viewport-zoom', { detail: -1 })) },
    { icon: Focus, title: 'Frame Selection', action: frameSelection },
    { icon: Compass, title: 'Reset Camera', action: resetCamera },
    { icon: Layers, title: 'Toggle 3D/2D', action: () => window.dispatchEvent(new Event('viewport-toggle-2d')) },
  ];

  return (
    <div className="fixed right-4 bottom-1/3 z-30 bg-surface-1/80 backdrop-blur-sm rounded-xl border border-border/30 shadow-lg">
      <div className="flex flex-col gap-1 p-1">
        {NAV_BUTTONS.map(({ icon: Icon, title, action }) => (
          <button
            key={title}
            onClick={action}
            title={title}
            aria-label={title}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all"
          >
            <Icon className="w-4 h-4" />
          </button>
        ))}
      </div>
    </div>
  );
}
