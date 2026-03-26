/**
 * MobileFloatingPanel — Apple-style bottom sheet
 * Smooth spring transitions, grab indicator, swipe-to-dismiss.
 * Refined with Apple design language: rounded corners, smooth rubber-banding.
 */
import { useRef, useCallback, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { haptics } from '@/lib/haptics';
import type { MobileTab } from './MobileTabBar';

interface MobileFloatingPanelProps {
  activeTab: MobileTab | null;
  height: 'collapsed' | 'half' | 'full';
  onHeightChange?: (h: 'collapsed' | 'half' | 'full') => void;
  onDismiss?: () => void;
  children: React.ReactNode;
}

export default function MobileFloatingPanel({
  activeTab,
  height,
  onHeightChange,
  onDismiss,
  children,
}: MobileFloatingPanelProps) {
  const dragRef = useRef<{ startY: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    dragRef.current = { startY: e.touches[0].clientY };
    setIsDragging(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragRef.current) return;
    const dy = e.touches[0].clientY - dragRef.current.startY;
    // Rubber-band effect: resist upward drag, allow downward
    setDragOffset(dy > 0 ? dy : dy * 0.3);
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!dragRef.current) return;
    const dy = e.changedTouches[0].clientY - dragRef.current.startY;
    setIsDragging(false);
    setDragOffset(0);
    dragRef.current = null;

    if (dy > 80) {
      haptics.tap();
      if (height === 'full') {
        onHeightChange?.('half');
      } else {
        onDismiss?.();
      }
    } else if (dy < -60) {
      haptics.tap();
      if (height === 'half') {
        onHeightChange?.('full');
      }
    }
  }, [height, onHeightChange, onDismiss]);

  if (!activeTab || height === 'collapsed') return null;

  const heightValue = height === 'full' ? '88dvh' : '50dvh';

  return (
    <div
      className={cn(
        "fixed left-2 right-2 z-40 rounded-t-[24px] overflow-hidden",
        "animate-in slide-in-from-bottom duration-400",
      )}
      style={{
        bottom: 'calc(64px + env(safe-area-inset-bottom))',
        height: heightValue,
        transform: isDragging ? `translateY(${dragOffset}px)` : undefined,
        transition: isDragging ? 'none' : 'height 0.45s cubic-bezier(0.32, 0.72, 0, 1), transform 0.45s cubic-bezier(0.32, 0.72, 0, 1)',
        willChange: 'transform, height',
        contain: 'layout style paint',
        background: 'rgba(10, 12, 18, 0.96)',
        backdropFilter: 'blur(48px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(48px) saturate(1.6)',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        borderLeft: '1px solid rgba(255, 255, 255, 0.04)',
        borderRight: '1px solid rgba(255, 255, 255, 0.04)',
        boxShadow: '0 -8px 40px rgba(0, 0, 0, 0.6), 0 -2px 12px rgba(0, 0, 0, 0.4)',
      }}
    >
      {/* Grab indicator — Apple style */}
      <div
        className="flex items-center justify-center pt-2.5 pb-1.5 cursor-grab active:cursor-grabbing"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="w-9 h-[5px] rounded-full bg-muted-foreground/25" />
      </div>

      {/* Close button — frosted circle */}
      {onDismiss && (
        <button
          onClick={() => { haptics.tap(); onDismiss(); }}
          className="absolute top-2.5 right-3 w-7 h-7 flex items-center justify-center rounded-full transition-all active:scale-90"
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <X className="w-3.5 h-3.5 text-muted-foreground/60" />
        </button>
      )}

      {/* Content */}
      <div className="h-[calc(100%-32px)] overflow-y-auto overscroll-contain px-1 pb-2 scroll-smooth">
        {children}
      </div>
    </div>
  );
}
