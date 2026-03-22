/**
 * FullscreenablePanel — wraps any panel with a maximize button
 * that renders the content as a fixed overlay over the entire viewport.
 * ESC or minimize button to exit.
 */
import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FullscreenablePanelProps {
  title?: string;
  children: ReactNode;
  className?: string;
}

export default function FullscreenablePanel({ title, children, className }: FullscreenablePanelProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev);
  }, []);

  // ESC to exit fullscreen
  useEffect(() => {
    if (!isFullscreen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKey, true);
    // Lock body scroll
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKey, true);
      document.body.style.overflow = '';
    };
  }, [isFullscreen]);

  if (isFullscreen) {
    return createPortal(
      <div className="fixed inset-0 z-50 bg-surface-0 flex flex-col">
        {/* Fullscreen header bar */}
        <div className="h-8 flex items-center justify-between px-3 border-b border-border/40 bg-surface-1/80 backdrop-blur-sm flex-shrink-0">
          <span className="text-[11px] font-bold text-foreground uppercase tracking-wider">
            {title || 'Panel'} — Fullscreen
          </span>
          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] text-muted-foreground hover:text-foreground hover:bg-surface-2/60 transition-colors"
            title="Exit fullscreen (ESC)"
          >
            <Minimize2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">ESC</span>
          </button>
        </div>
        {/* Content fills remaining space */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </div>,
      document.body
    );
  }

  return (
    <div className={cn('h-full flex flex-col relative', className)}>
      <button
        onClick={toggleFullscreen}
        className="absolute top-1 right-1 z-10 p-1 rounded hover:bg-surface-3/60 text-muted-foreground hover:text-foreground transition-colors"
        title="Maximize to fullscreen"
      >
        <Maximize2 className="w-3 h-3" />
      </button>
      {children}
    </div>
  );
}
