/**
 * DraggableFloatingPanel — Generic draggable wrapper with localStorage persistence
 * Glassmorphism FUI style, grip handle, minimize, bounds checking, auto-dodge
 */
import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react';
import { GripVertical, Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { haptics } from '@/lib/haptics';

interface Props {
  panelId: string;
  initialX: number;
  initialY: number;
  children: ReactNode;
  minimizable?: boolean;
  className?: string;
  /** Reserved space at the bottom (e.g. for MobileTabBar) */
  bottomOffset?: number;
}

// Static registry for auto-dodge collision detection
const panelRegistry = new Map<string, { x: number; y: number; w: number; h: number }>();

function getStoredPos(id: string, fallback: { x: number; y: number }) {
  try {
    const raw = localStorage.getItem(`dfp-${id}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed.x === 'number' && typeof parsed.y === 'number') return parsed;
    }
  } catch {}
  return fallback;
}

function dodgeCollisions(id: string, x: number, y: number, w: number, h: number): { x: number; y: number } {
  let finalY = y;
  for (const [pid, rect] of panelRegistry) {
    if (pid === id) continue;
    const overlap = !(x + w < rect.x || x > rect.x + rect.w || finalY + h < rect.y || finalY > rect.y + rect.h);
    if (overlap) {
      finalY = rect.y + rect.h + 8;
    }
  }
  return { x, y: finalY };
}

export default function DraggableFloatingPanel({
  panelId,
  initialX,
  initialY,
  children,
  minimizable = true,
  className,
  bottomOffset = 0,
}: Props) {
  const [pos, setPos] = useState(() => getStoredPos(panelId, { x: initialX, y: initialY }));
  const [minimized, setMinimized] = useState(false);
  const [dragging, setDragging] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Register/unregister panel in static map
  useEffect(() => {
    const el = panelRef.current;
    const update = () => {
      panelRegistry.set(panelId, {
        x: pos.x, y: pos.y,
        w: el?.offsetWidth ?? 48,
        h: el?.offsetHeight ?? 48,
      });
    };
    update();
    return () => { panelRegistry.delete(panelId); };
  }, [panelId, pos]);

  const clamp = useCallback((x: number, y: number) => {
    const el = panelRef.current;
    const w = el?.offsetWidth ?? 48;
    const h = el?.offsetHeight ?? 48;
    const snap = 8;
    const maxY = window.innerHeight - h - bottomOffset;
    let cx = Math.max(0, Math.min(window.innerWidth - w, x));
    let cy = Math.max(0, Math.min(maxY, y));
    if (cx < snap) cx = 0;
    if (cy < snap) cy = 0;
    if (cx > window.innerWidth - w - snap) cx = window.innerWidth - w;
    if (cy > maxY - snap) cy = maxY;
    return { x: cx, y: cy };
  }, [bottomOffset]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
    haptics.dragStart();
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [pos]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    const newPos = clamp(e.clientX - dragOffset.current.x, e.clientY - dragOffset.current.y);
    setPos(newPos);
  }, [dragging, clamp]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    setDragging(false);
    haptics.dragEnd();
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    const raw = clamp(e.clientX - dragOffset.current.x, e.clientY - dragOffset.current.y);
    const el = panelRef.current;
    const final = dodgeCollisions(panelId, raw.x, raw.y, el?.offsetWidth ?? 48, el?.offsetHeight ?? 48);
    const clamped = clamp(final.x, final.y);
    setPos(clamped);
    try { localStorage.setItem(`dfp-${panelId}`, JSON.stringify(clamped)); } catch {}
  }, [dragging, clamp, panelId]);

  const handleMinimize = useCallback(() => {
    haptics.panelToggle();
    setMinimized(p => !p);
  }, []);

  // Recalculate bounds on resize
  useEffect(() => {
    const handler = () => setPos(prev => clamp(prev.x, prev.y));
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [clamp]);

  return (
    <div
      ref={panelRef}
      className={cn(
        "fixed z-40 flex flex-col items-center transition-all duration-150",
        dragging && "select-none scale-[1.02]",
        className
      )}
      style={{
        left: pos.x,
        top: pos.y,
        touchAction: 'none',
        opacity: dragging ? 1 : 0.88,
      }}
    >
      {/* Grip handle — 44px touch target always */}
      <div
        className={cn(
          "flex items-center justify-center gap-1 rounded-t-lg cursor-grab active:cursor-grabbing py-2",
          "bg-background/60 backdrop-blur-sm border border-b-0 border-border/20",
          "min-h-[44px] min-w-[44px] px-3",
          dragging && "ring-1 ring-[hsl(var(--fxk-cyan)/0.4)] shadow-[0_0_12px_hsl(var(--fxk-cyan)/0.15)] scale-105",
          "transition-all duration-200"
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {/* 3-dot drag indicator */}
        <div className="flex gap-[3px]">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-1 h-1 rounded-full bg-muted-foreground/30" />
          ))}
        </div>
        {minimizable && (
          <button
            onClick={handleMinimize}
            className="ml-1 text-muted-foreground/40 hover:text-muted-foreground transition-colors p-0.5"
          >
            {minimized ? <Plus className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
          </button>
        )}
      </div>

      {/* Content */}
      {!minimized && (
        <div className="bg-background/80 backdrop-blur-xl border border-t-0 border-border/20 rounded-b-2xl shadow-2xl overflow-hidden">
          {children}
        </div>
      )}
    </div>
  );
}
