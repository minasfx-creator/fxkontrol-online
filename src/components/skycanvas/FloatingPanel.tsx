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
import { dockStore, type PanelState, type DockSlot } from '@/hooks/useFloatingDock';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useSmallViewport } from '@/hooks/useSmallViewport';

const SNAP_RADIUS = 56; // px to corner before magnetic pull engages
const SNAP_MARGIN = 16;
const MOBILE_SHEET_HEIGHT_RATIO = 0.55; // 55dvh
const MOBILE_DISMISS_DRAG_PX = 80;      // swipe-down threshold to collapse

function nearestSlot(x: number, y: number, w: number, h: number, vw: number, vh: number): { slot: DockSlot; x: number; y: number } | null {
  const corners: Array<{ slot: DockSlot; cx: number; cy: number }> = [
    { slot: 'TL', cx: SNAP_MARGIN,            cy: SNAP_MARGIN },
    { slot: 'TR', cx: vw - w - SNAP_MARGIN,   cy: SNAP_MARGIN },
    { slot: 'BL', cx: SNAP_MARGIN,            cy: vh - h - SNAP_MARGIN },
    { slot: 'BR', cx: vw - w - SNAP_MARGIN,   cy: vh - h - SNAP_MARGIN },
  ];
  let best: { slot: DockSlot; x: number; y: number; d: number } | null = null;
  for (const c of corners) {
    const d = Math.hypot(x - c.cx, y - c.cy);
    if (d < SNAP_RADIUS && (!best || d < best.d)) {
      best = { slot: c.slot, x: c.cx, y: c.cy, d };
    }
  }
  return best ? { slot: best.slot, x: best.x, y: best.y } : null;
}

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
  const [snapHint, setSnapHint] = useState<DockSlot | null>(null);
  const [sheetDrag, setSheetDrag] = useState(0); // mobile bottom-sheet drag offset (px, ≥0)
  const reducedMotion = useReducedMotion();
  const isMobile = useSmallViewport(900);

  // ── Mobile bottom-sheet drag (swipe down to collapse) ───────────────
  const sheetDragRef = useRef<{ active: boolean; sy: number; pid: number | null }>({
    active: false, sy: 0, pid: null,
  });
  const onSheetPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-no-drag]')) return;
    sheetDragRef.current = { active: true, sy: e.clientY, pid: e.pointerId };
    try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch { /* iOS quirk */ }
  }, []);
  const onSheetPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = sheetDragRef.current;
    if (!d.active) return;
    const dy = e.clientY - d.sy;
    setSheetDrag(dy > 0 ? dy : dy * 0.25); // rubber-band upward
  }, []);
  const finishSheetDrag = useCallback((e?: React.PointerEvent<HTMLDivElement>) => {
    const d = sheetDragRef.current;
    if (!d.active) return;
    const dy = e ? e.clientY - d.sy : 0;
    sheetDragRef.current = { active: false, sy: 0, pid: null };
    if (e) { try { (e.currentTarget as Element).releasePointerCapture(e.pointerId); } catch { /* */ } }
    setSheetDrag(0);
    if (dy > MOBILE_DISMISS_DRAG_PX) dockStore.toggleCollapsed(id);
  }, [id]);

  // Drag handlers — store delta in ref, commit on pointerup (no re-render mid-drag).
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (bottomStrip || isMobile) return;
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
    // live snap hint
    const nx = d.ox + dx;
    const ny = d.oy + dy;
    const snap = nearestSlot(nx, ny, state.w, state.h, window.innerWidth, window.innerHeight);
    setSnapHint(snap ? snap.slot : null);
  }, [state.w, state.h]);

  const finishDrag = useCallback((e?: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d.active) return;
    const el = ref.current;
    let nx = state.x, ny = state.y;
    let nextSlot: DockSlot = 'free';
    if (e && el) {
      nx = d.ox + (e.clientX - d.sx);
      ny = d.oy + (e.clientY - d.sy);
      const vw = window.innerWidth, vh = window.innerHeight;
      // Snap only when there's room. On small viewports the snap targets
      // collide with the topbar/FAB, so we skip snap entirely.
      if (!isMobile) {
        const snap = nearestSlot(nx, ny, state.w, state.h, vw, vh);
        if (snap) { nx = snap.x; ny = snap.y; nextSlot = snap.slot; }
      }
      // clamp to viewport (always)
      nx = Math.max(8, Math.min(nx, vw - state.w - 8));
      ny = Math.max(8, Math.min(ny, vh - state.h - 8));
      el.style.transform = '';
      el.style.willChange = '';
    }
    dragRef.current = { active: false, sx: 0, sy: 0, ox: 0, oy: 0, pid: null };
    setDragging(false);
    setSnapHint(null);
    if (e) {
      try { (e.currentTarget as Element).releasePointerCapture(e.pointerId); } catch { /* */ }
    }
    dockStore.updatePanel(id, { x: nx, y: ny, slot: nextSlot });

    // Debounced silent save toast (deferred import to avoid SSR)
    const now = Date.now();
    if (now - lastSaveToast > SAVE_TOAST_DEBOUNCE) {
      lastSaveToast = now;
      void import('sonner').then(({ toast }) => toast('Layout salvo', { duration: 1100 }));
    }
  }, [id, state.x, state.y, state.w, state.h, isMobile]);

  // ── Mobile order for collapsed pills (stack above FAB) ──────────────
  // library left, inspector right, timeline center → predictable layout.
  const mobilePillSide: 'left' | 'right' | 'center' =
    id === 'library' ? 'left' : id === 'inspector' ? 'right' : 'center';

  // Collapsed pill ----------------------------------------------------
  if (state.collapsed) {
    let style: React.CSSProperties;
    if (isMobile) {
      // Sit above the bottom transport FAB (≈ 84px tall + safe area)
      const bottom = 'calc(96px + env(safe-area-inset-bottom, 0px))';
      style = mobilePillSide === 'left'
        ? { left: 12, bottom, height: 38 }
        : mobilePillSide === 'right'
        ? { right: 12, bottom, height: 38 }
        : { left: '50%', bottom: `calc(150px + env(safe-area-inset-bottom, 0px))`, transform: 'translateX(-50%)', height: 38 };
    } else if (bottomStrip) {
      style = { left: 16, right: 16, bottom: 16, height: 44 };
    } else {
      style = { left: state.x, top: state.y, width: 'auto', height: 40 };
    }
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
  // Mobile: bottom-sheet (full width, ~55dvh, anchored above FAB).
  // Desktop: floating glass island honoring stored x/y/w/h or bottomStrip.
  let style: React.CSSProperties;
  if (isMobile) {
    style = {
      left: 0,
      right: 0,
      bottom: 0,
      height: `calc(${MOBILE_SHEET_HEIGHT_RATIO * 100}dvh)`,
      paddingBottom: 'calc(96px + env(safe-area-inset-bottom, 0px))',
      borderRadius: '24px 24px 0 0',
      transform: sheetDrag > 0 ? `translateY(${sheetDrag}px)` : undefined,
      transition: sheetDrag > 0 ? 'none' : 'transform 280ms cubic-bezier(0.32, 0.72, 0, 1)',
      willChange: 'transform',
      touchAction: 'none',
    };
  } else if (bottomStrip) {
    style = { left: 16, right: 16, bottom: 16, height: state.h };
  } else {
    style = { left: state.x, top: state.y, width: state.w, height: state.h };
  }

  // Snap-target ghost preview — desktop only.
  const ghost = !isMobile && dragging && snapHint ? (() => {
    const vw = typeof window !== 'undefined' ? window.innerWidth : 0;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 0;
    const positions: Record<string, React.CSSProperties> = {
      TL: { left: SNAP_MARGIN, top: SNAP_MARGIN, width: state.w, height: state.h },
      TR: { left: vw - state.w - SNAP_MARGIN, top: SNAP_MARGIN, width: state.w, height: state.h },
      BL: { left: SNAP_MARGIN, top: vh - state.h - SNAP_MARGIN, width: state.w, height: state.h },
      BR: { left: vw - state.w - SNAP_MARGIN, top: vh - state.h - SNAP_MARGIN, width: state.w, height: state.h },
    };
    const pos = positions[snapHint];
    if (!pos) return null;
    return (
      <div
        aria-hidden
        className="absolute z-30 rounded-2xl pointer-events-none border border-cyan-300/40 bg-cyan-300/[0.04]"
        style={{ ...pos, boxShadow: '0 0 0 1px hsl(190 70% 58% / 0.25), inset 0 0 24px hsl(190 70% 58% / 0.12)' }}
      />
    );
  })() : null;

  const draggableHeader = !isMobile && !bottomStrip;

  return (
    <>
      {ghost}
      <section
        ref={ref}
        role="dialog"
        aria-label={title}
        aria-expanded
        className={cn(
          'glass-pane absolute z-40 flex flex-col overflow-hidden text-zinc-200',
          isMobile ? 'rounded-t-3xl border-t border-white/[0.08]' : 'rounded-2xl',
          dragging ? 'cursor-grabbing select-none' : '',
          reducedMotion ? '' : 'transition-shadow duration-300',
          className,
        )}
        style={style}
      >
        <header
          onPointerDown={isMobile ? onSheetPointerDown : (draggableHeader ? onPointerDown : undefined)}
          onPointerMove={isMobile ? onSheetPointerMove : (draggableHeader ? onPointerMove : undefined)}
          onPointerUp={isMobile ? finishSheetDrag : finishDrag}
          onPointerCancel={isMobile ? finishSheetDrag : finishDrag}
          className={cn(
            'flex shrink-0 items-center gap-2 px-3 border-b border-white/[0.06] touch-none',
            isMobile ? 'h-11 flex-col items-stretch py-1.5' : 'h-9',
            !isMobile && !bottomStrip ? (dragging ? 'cursor-grabbing' : 'cursor-grab') : '',
          )}
          title={isMobile ? 'Arraste para baixo para recolher' : (bottomStrip ? title : 'Arraste para mover · clique no botão para recolher')}
        >
          {isMobile && (
            <div className="mx-auto h-1 w-10 rounded-full bg-white/15 mb-1" aria-hidden />
          )}
          <div className="flex w-full items-center gap-2">
            {!bottomStrip && !isMobile && (
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
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-auto">
          {children}
        </div>
      </section>
    </>
  );
}

export const FloatingPanel = memo(FloatingPanelImpl);
