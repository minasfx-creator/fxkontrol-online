/**
 * MobileFloatingPanel — Apple-style bottom sheet
 * Smooth spring transitions, grab indicator, swipe-to-dismiss.
 * Enhanced with visible scroll indicators and better grab area.
 */
import { useRef, useCallback, useState } from 'react';
import { X, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { haptics } from '@/lib/haptics';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { MobileTab } from './mobileTabTypes';

interface MobileFloatingPanelProps {
  activeTab: MobileTab | null;
  height: 'collapsed' | 'half' | 'full';
  onHeightChange?: (h: 'collapsed' | 'half' | 'full') => void;
  onDismiss?: () => void;
  children: React.ReactNode;
  title?: string;
}

export default function MobileFloatingPanel({
  activeTab,
  height,
  onHeightChange,
  onDismiss,
  children,
  title,
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
    setDragOffset(dy > 0 ? dy : dy * 0.3);
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!dragRef.current) return;
    const dy = e.changedTouches[0].clientY - dragRef.current.startY;
    setIsDragging(false);
    setDragOffset(0);
    dragRef.current = null;

    if (dy > 60) {
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

  const heightValue = height === 'full'
    ? 'calc(100dvh - 64px - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 48px)'
    : 'min(50dvh, calc(100dvh - 180px))';

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
      {/* Grab handle area — larger touch target */}
      <div
        className="flex flex-col items-center pt-2 pb-1 cursor-grab active:cursor-grabbing"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="w-10 h-[5px] rounded-full bg-muted-foreground/30" />
        
        {/* Header row with title and controls */}
        <div className="w-full flex items-center justify-between px-3 mt-1.5">
          <div className="flex items-center gap-2">
            {/* Height toggle */}
            <button
              onClick={() => {
                haptics.tap();
                onHeightChange?.(height === 'full' ? 'half' : 'full');
              }}
              className="w-7 h-7 flex items-center justify-center rounded-full transition-all active:scale-90"
              style={{ background: 'rgba(255, 255, 255, 0.06)' }}
            >
              {height === 'full'
                ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/60" />
                : <ChevronUp className="w-3.5 h-3.5 text-muted-foreground/60" />
              }
            </button>
            {title && (
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/50">
                {title}
              </span>
            )}
          </div>

          {/* Close button */}
          {onDismiss && (
            <button
              onClick={() => { haptics.tap(); onDismiss(); }}
              className="w-7 h-7 flex items-center justify-center rounded-full transition-all active:scale-90"
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                backdropFilter: 'blur(8px)',
              }}
            >
              <X className="w-3.5 h-3.5 text-muted-foreground/60" />
            </button>
          )}
        </div>
      </div>

      {/* Content with visible scrollbar */}
      <ScrollArea className="h-[calc(100%-56px)] px-1 pb-2">
        {children}
      </ScrollArea>
    </div>
  );
}
