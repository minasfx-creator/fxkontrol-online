/**
 * MobileConsoleFullscreen — Forces landscape fullscreen for console panels on mobile.
 * Apple-style spring animation, swipe-down to dismiss, status bar hidden.
 */
import { useEffect, useCallback, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { haptics } from '@/lib/haptics';

interface MobileConsoleFullscreenProps {
  title: string;
  children: ReactNode;
  onClose: () => void;
  accentColor?: string; // HSL var like 'var(--primary)'
}

export default function MobileConsoleFullscreen({
  title,
  children,
  onClose,
  accentColor,
}: MobileConsoleFullscreenProps) {
  const [isClosing, setIsClosing] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const dragRef = useRef<{ startY: number } | null>(null);

  // Lock orientation hint + hide scrollbar
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    // Try to lock to landscape if available
    try {
      (screen.orientation as any)?.lock?.('landscape').catch(() => {});
    } catch {}
    return () => {
      document.body.style.overflow = '';
      try {
        (screen.orientation as any)?.unlock?.();
      } catch {}
    };
  }, []);

  const handleClose = useCallback(() => {
    haptics.tap();
    setIsClosing(true);
    setTimeout(onClose, 280);
  }, [onClose]);

  // Swipe down to dismiss with rubber-band feedback
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    dragRef.current = { startY: e.touches[0].clientY };
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragRef.current) return;
    const dy = Math.max(0, e.touches[0].clientY - dragRef.current.startY);
    // Rubber-band: diminishing returns past 40px
    setDragOffset(dy > 40 ? 40 + (dy - 40) * 0.3 : dy);
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!dragRef.current) return;
    const dy = e.changedTouches[0].clientY - dragRef.current.startY;
    dragRef.current = null;
    setDragOffset(0);
    if (dy > 80) handleClose();
  }, [handleClose]);

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[60] flex flex-col",
        isClosing ? "animate-out fade-out-0 slide-out-to-bottom duration-280" : "animate-in fade-in-0 slide-in-from-bottom duration-350",
      )}
      style={{
        background: 'hsl(var(--surface-0))',
        willChange: 'transform, opacity',
        transform: dragOffset > 0 ? `translateY(${dragOffset}px)` : undefined,
        transition: dragOffset > 0 ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* Grab bar — Apple sheet style */}
      <div
        className="flex items-center justify-center pt-2 pb-1 cursor-grab active:cursor-grabbing shrink-0"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-4 pb-2 shrink-0">
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{
              background: accentColor ? `hsl(${accentColor})` : 'hsl(var(--primary))',
              boxShadow: `0 0 8px hsl(${accentColor || 'var(--primary)'} / 0.4)`,
            }}
          />
          <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-foreground font-tactical">
            {title}
          </h2>
        </div>
        <button
          onClick={handleClose}
          className="glass-button flex items-center gap-1.5 px-3 py-1.5 active:scale-90 transition-transform"
        >
          <Minimize2 className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Fechar</span>
        </button>
      </div>

      {/* Console content — fills remaining space */}
      <div className="flex-1 overflow-auto overscroll-contain">
        {children}
      </div>
    </div>,
    document.body,
  );
}
