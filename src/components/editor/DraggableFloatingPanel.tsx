/**
 * DraggableFloatingPanel — Generic draggable wrapper with localStorage persistence
 * Glassmorphism FUI style, grip handle, minimize, bounds checking
 */
import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react';
import { GripVertical, Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  panelId: string;
  initialX: number;
  initialY: number;
  children: ReactNode;
  minimizable?: boolean;
  className?: string;
}

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

export default function DraggableFloatingPanel({
  panelId,
  initialX,
  initialY,
  children,
  minimizable = true,
  className,
}: Props) {
  const [pos, setPos] = useState(() => getStoredPos(panelId, { x: initialX, y: initialY }));
  const [minimized, setMinimized] = useState(false);
  const [dragging, setDragging] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  const clamp = useCallback((x: number, y: number) => {
    const el = panelRef.current;
    const w = el?.offsetWidth ?? 48;
    const h = el?.offsetHeight ?? 48;
    const snap = 8;
    let cx = Math.max(0, Math.min(window.innerWidth - w, x));
    let cy = Math.max(0, Math.min(window.innerHeight - h, y));
    // Snap to edges
    if (cx < snap) cx = 0;
    if (cy < snap) cy = 0;
    if (cx > window.innerWidth - w - snap) cx = window.innerWidth - w;
    if (cy > window.innerHeight - h - snap) cy = window.innerHeight - h;
    return { x: cx, y: cy };
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
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
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    const final = clamp(e.clientX - dragOffset.current.x, e.clientY - dragOffset.current.y);
    setPos(final);
    try { localStorage.setItem(`dfp-${panelId}`, JSON.stringify(final)); } catch {}
  }, [dragging, clamp, panelId]);

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
        "fixed z-40 flex flex-col items-center",
        dragging && "select-none",
        className
      )}
      style={{ left: pos.x, top: pos.y, touchAction: 'none' }}
    >
      {/* Grip handle */}
      <div
        className={cn(
          "flex items-center justify-center gap-0.5 rounded-t-lg px-2 py-0.5 cursor-grab active:cursor-grabbing",
          "bg-background/60 backdrop-blur-sm border border-b-0 border-border/20",
          dragging && "ring-1 ring-primary/30"
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <GripVertical className="w-3 h-3 text-muted-foreground/40" />
        {minimizable && (
          <button
            onClick={() => setMinimized(p => !p)}
            className="ml-1 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
          >
            {minimized ? <Plus className="w-2.5 h-2.5" /> : <Minus className="w-2.5 h-2.5" />}
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
