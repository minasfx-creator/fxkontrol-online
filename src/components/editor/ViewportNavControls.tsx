import { ZoomIn, ZoomOut, Compass, Layers } from 'lucide-react';

const NAV_BUTTONS = [
  { icon: ZoomIn, title: 'Zoom In', action: () => window.dispatchEvent(new CustomEvent('viewport-zoom', { detail: 1 })) },
  { icon: ZoomOut, title: 'Zoom Out', action: () => window.dispatchEvent(new CustomEvent('viewport-zoom', { detail: -1 })) },
  { icon: Compass, title: 'Reset Camera', action: () => window.dispatchEvent(new Event('viewport-reset-camera')) },
  { icon: Layers, title: 'Toggle 3D/2D', action: () => window.dispatchEvent(new Event('viewport-toggle-2d')) },
];

export default function ViewportNavControls({ collapsed }: { collapsed?: boolean }) {
  return (
    <div
      className="absolute right-3 z-30 flex flex-col gap-1"
      style={{
        bottom: collapsed ? '40px' : 'calc(25vh + 8px)',
        transition: 'bottom 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {NAV_BUTTONS.map(({ icon: Icon, title, action }) => (
        <button
          key={title}
          onClick={action}
          title={title}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-background/50 backdrop-blur-sm border border-border/20 text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all"
        >
          <Icon className="w-4 h-4" />
        </button>
      ))}
    </div>
  );
}
