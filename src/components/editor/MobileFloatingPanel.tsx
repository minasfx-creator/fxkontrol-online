/**
 * MobileFloatingPanel — Apple-style bottom sheet
 * Smooth spring transitions, grab indicator, swipe-to-dismiss.
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

const HEIGHT_MAP: Record<string, string> = {
  collapsed: 'translate-y-full',
  half: 'h-[50vh]',
  full: 'h-[88vh]',
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

    if (deltaY > 60) {
      if (height === 'full') {
        onHeightChange?.('half');
      } else {
        onDismiss?.();
      }
    } else if (deltaY < -60) {
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
        "fixed left-0 right-0 z-40 glass-sheet rounded-t-[20px] overflow-hidden animate-ios-spring-up",
        HEIGHT_MAP[height]
      )}
      style={{
        bottom: 'calc(64px + env(safe-area-inset-bottom))',
        transition: isDragging ? 'none' : 'height 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        willChange: 'transform, height',
        contain: 'layout style paint',
      }}
    >
      {/* Grab indicator — Apple style */}
      <div
        className="flex items-center justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="sheet-indicator" />
      </div>

      {/* Close button */}
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full glass-button text-muted-foreground z-10"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {/* Content — only render children when panel is visible */}
      <div className="h-[calc(100%-36px)] overflow-y-auto overscroll-contain px-1 pb-2">
        {children}
      </div>
    </div>
  );
}
