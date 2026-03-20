/**
 * MobileFloatingPanel — Translucent swipeable sheet (Free Fire style)
 * Glass background, 3 snap heights, drag handle, swipe-to-dismiss.
 */
import { useRef, useCallback, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MobileTab } from './MobileTabBar';

interface MobileFloatingPanelProps {
  activeTab: MobileTab | null;
  height: 'collapsed' | 'half' | 'full';
  onHeightChange?: (h: 'collapsed' | 'half' | 'full') => void;
  onDismiss?: () => void;
  children: React.ReactNode;
}

const HEIGHT_CLASSES: Record<string, string> = {
  collapsed: 'translate-y-full',
  half: 'h-[45vh]',
  full: 'h-[85vh]',
};

export default function MobileFloatingPanel({
  activeTab,
  height,
  onHeightChange,
  onDismiss,
  children,
}: MobileFloatingPanelProps) {
  const dragRef = useRef<{ startY: number; startHeight: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    dragRef.current = { startY: touch.clientY, startHeight: height };
    setIsDragging(true);
  }, [height]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!dragRef.current) return;
    const touch = e.changedTouches[0];
    const deltaY = touch.clientY - dragRef.current.startY;
    setIsDragging(false);

    // Swipe down → shrink or dismiss
    if (deltaY > 60) {
      if (height === 'full') {
        onHeightChange?.('half');
      } else {
        onDismiss?.();
      }
    }
    // Swipe up → expand
    else if (deltaY < -60) {
      if (height === 'half') {
        onHeightChange?.('full');
      }
    }
    dragRef.current = null;
  }, [height, onHeightChange, onDismiss]);

  if (!activeTab || height === 'collapsed') return null;

  return (
    <div
      className={cn(
        "fixed left-0 right-0 z-40 glass-sheet rounded-t-2xl transition-all duration-300 ease-out overflow-hidden",
        HEIGHT_CLASSES[height]
      )}
      style={{
        bottom: 'calc(52px + env(safe-area-inset-bottom))',
      }}
    >
      {/* Drag handle */}
      <div
        className="flex items-center justify-center pt-2 pb-1 cursor-grab active:cursor-grabbing"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className={cn(
          "w-10 h-1 rounded-full transition-colors",
          isDragging ? "bg-primary/50" : "bg-white/20"
        )} />
      </div>

      {/* Close button */}
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="absolute top-2 right-3 w-7 h-7 flex items-center justify-center rounded-full glass-card text-muted-foreground hover:text-foreground active:scale-90 transition-all z-10"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Content */}
      <div className="h-[calc(100%-28px)] overflow-y-auto overscroll-contain scrollbar-thin px-1">
        {children}
      </div>
    </div>
  );
}
