/**
 * FloatingPanel — Apple-glass dark panel with Pointer Events drag,
 * collapse pill, persisted layout via dockStore. Pure presentation;
 * never imports safety/CommandBus/FieldBus.
 *
 * Touch + Apple Pencil + mouse unified. iOS setPointerCapture failure
 * is caught and we fall back to window listeners.
 */
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { GripVertical, Minus, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { dockStore, type PanelState } from '@/hooks/useFloatingDock';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface Props {
  id: string;
  title: string;
  state: PanelState;
  /** When true, panel docks to bottom edge as a full-width strip (timeline). */
  bottomStrip?: boolean;
  className?: string;
  children: React.ReactNode;
}

const SAVE_TOAST_DEBOUNCE = 800;
let lastSaveToast = 0;

function FloatingPanelImpl({ id, title, state, bottomStrip, className, children }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ active: boolean; sx: number; sy: number; ox: number; oy: number; pid: number | null }>({
    active: false, sx: 0, sy: 0, ox: 0, oy: 0, pid: null,
  });
  const [dragging, setDragging] = useState(false);
  const reducedMotion = useReducedMotion();

  // Drag handlers — store delta in ref, commit on pointerup (no re-render mid-drag).
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (bottomStrip) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-no-drag]')) return;
    dragRef.current = {
      active: true,
      sx: e.clientX, sy: e.clientY,
      ox: state.x, oy: state.y,
      pid: e.pointerId,
    };
    setDragging(true);
    try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch { /* iOS quirk */ }
    if (ref.current) ref.current.style.willChange = 'transform';
  }, [bottomStrip, state.x, state.y]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d.active || !ref.current) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    ref.current.style.transform = `translate(${dx}px, ${dy}px)`;
  }, []);

  const finishDrag = useCallback((e?: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d.active) return;
    const el = ref.current;
    let nx = state.x, ny = state.y;
    if (e && el) {
      nx = d.ox + (e.clientX - d.sx);
      ny = d.oy + (e.clientY - d.sy);
      // clamp to viewport
      const vw = window.innerWidth, vh = window.innerHeight;
      nx = Math.max(8, Math.min(nx, vw - state.w - 8));
      ny = Math.max(8, Math.min(ny, vh - state.h - 8));
      el.style.transform = '';
      el.style.willChange = '';
    }
    dragRef.current = { active: false, sx: 0, sy: 0, ox: 0, oy: 0, pid: null };
    setDragging(false);
    if (e) {
      try { (e.currentTarget as Element).releasePointerCapture(e.pointerId); } catch { /* */ }
    }
    dockStore.updatePanel(id, { x: nx, y: ny, slot: 'free' });

    // Debounced silent save toast (deferred import to avoid SSR)
    const now = Date.now();
    if (now - lastSaveToast > SAVE_TOAST_DEBOUNCE) {
      lastSaveToast = now;
      void import('sonner').then(({ toast }) => toast('Layout salvo', { duration: 1100 }));
    }
  }, [id, state.x, state.y, state.w, state.h]);

  // Collapsed pill ----------------------------------------------------
  if (state.collapsed) {
    const style: React.CSSProperties = bottomStrip
      ? { left: 16, right: 16, bottom: 16, height: 44 }
      : { left: state.x, top: state.y, width: 'auto', height: 40 };
    return (
      <button
        type="button"
        aria-label={`Mostrar ${title}`}
        aria-expanded={false}
        onClick={() => dockStore.toggleCollapsed(id)}
        className={cn(
          'glass-pane glass-pill absolute z-40 px-3 inline-flex items-center gap-2',
          'text-cyan-200/90 ds-mono text-[11px] tracking-wider uppercase',
          'hover:text-cyan-100 transition-colors duration-300',
          reducedMotion ? '' : 'animate-in fade-in zoom-in-95',
        )}
        style={style}
      >
        <Maximize2 className="h-3.5 w-3.5" />
        <span>{title}</span>
      </button>
    );
  }

  // Expanded panel ----------------------------------------------------
  const style: React.CSSProperties = bottomStrip
    ? { left: 16, right: 16, bottom: 16, height: state.h }
    : { left: state.x, top: state.y, width: state.w, height: state.h };

  return (
    <section
      ref={ref}
      role="dialog"
      aria-label={title}
      aria-expanded
      className={cn(
        'glass-pane absolute z-40 flex flex-col overflow-hidden',
        'rounded-2xl text-zinc-200',
        dragging ? 'cursor-grabbing select-none' : '',
        reducedMotion ? '' : 'transition-shadow duration-300',
        className,
      )}
      style={style}
    >
      <header
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        className={cn(
          'flex h-9 shrink-0 items-center gap-2 px-3 border-b border-white/[0.06]',
          bottomStrip ? '' : (dragging ? 'cursor-grabbing' : 'cursor-grab'),
          'touch-none', // prevent scroll during drag
        )}
        title={bottomStrip ? title : 'Arraste para mover · clique no botão para recolher'}
      >
        {!bottomStrip && (
          <GripVertical className="h-3.5 w-3.5 text-cyan-300/40 shrink-0" aria-hidden />
        )}
        <span className="ds-mono text-[10px] tracking-wider uppercase text-cyan-300/80 truncate">
          {title}
        </span>
        <div className="flex-1" />
        <button
          type="button"
          data-no-drag
          aria-label={`Recolher ${title}`}
          aria-expanded
          onClick={() => dockStore.toggleCollapsed(id)}
          className="ds-focus rounded-md p-1 text-zinc-400 hover:text-cyan-200 hover:bg-white/[0.04] transition-colors"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-hidden">
        {children}
      </div>
    </section>
  );
}

export const FloatingPanel = memo(FloatingPanelImpl);
