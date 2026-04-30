/**
 * useDraggableFloat — Pointer-driven drag for floating Mission Control panels.
 *
 * Why this exists: the desktop chrome is a set of glass floats (segment dock,
 * panel overlays). Operators want to move them out of the way of the viewport
 * without breaking layout. This hook provides:
 *
 *   - Pointer events (mouse + touch unified) with `setPointerCapture`.
 *   - 4px dead-zone before drag begins (so clicks/buttons inside the handle
 *     keep working).
 *   - Viewport clamping (5px margin) so floats never escape the screen.
 *   - Snap-to-edge at 16px from any edge — persisted as an anchor so the
 *     position survives window resize.
 *   - localStorage persistence per `id`.
 *   - Double-click on the handle resets to the default position.
 *
 * No business logic. Pure presentation. Never touches ShowPlan/CommandBus.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type FloatAnchor = 'tl' | 'tr' | 'bl' | 'br';

export interface FloatPosition {
  anchor: FloatAnchor;
  /** Horizontal offset (px) from the anchor's vertical edge. */
  x: number;
  /** Vertical offset (px) from the anchor's horizontal edge. */
  y: number;
}

export interface UseDraggableFloatOptions {
  /** localStorage key suffix (`fxk:float-pos:<id>`). */
  id: string;
  /** Position used when nothing is persisted (or after reset). */
  defaultPos: FloatPosition;
  /** Snap zone in px. Default 16. Set to 0 to disable snapping. */
  snapPx?: number;
  /** Minimum drag distance in px before drag starts. Default 4. */
  deadZonePx?: number;
  /** Margin in px kept inside the viewport. Default 6. */
  marginPx?: number;
}

interface PersistedPos {
  anchor: FloatAnchor;
  x: number;
  y: number;
}

const STORAGE_PREFIX = 'fxk:float-pos:';

function readPersisted(id: string): FloatPosition | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + id);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedPos;
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof parsed.x !== 'number' ||
      typeof parsed.y !== 'number' ||
      !Number.isFinite(parsed.x) ||
      !Number.isFinite(parsed.y) ||
      !['tl', 'tr', 'bl', 'br'].includes(parsed.anchor)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writePersisted(id: string, pos: FloatPosition): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_PREFIX + id, JSON.stringify(pos));
  } catch {
    /* quota / private mode — silent */
  }
}

function clearPersisted(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_PREFIX + id);
  } catch {
    /* noop */
  }
}

/**
 * Convert a viewport-coordinate point (top-left origin, the natural pointer
 * frame) into an anchored offset, snapping to the nearest edge if within
 * `snapPx`.
 */
function pointToAnchored(
  topLeftX: number,
  topLeftY: number,
  width: number,
  height: number,
  vw: number,
  vh: number,
  snapPx: number,
  marginPx: number,
): FloatPosition {
  // Clamp first so we never persist an off-screen position.
  const maxX = Math.max(marginPx, vw - width - marginPx);
  const maxY = Math.max(marginPx, vh - height - marginPx);
  const x = Math.min(Math.max(topLeftX, marginPx), maxX);
  const y = Math.min(Math.max(topLeftY, marginPx), maxY);

  // Distances to each edge.
  const dLeft = x;
  const dRight = vw - (x + width);
  const dTop = y;
  const dBottom = vh - (y + height);

  // Snap to nearest horizontal edge if within snap zone.
  let anchorH: 'l' | 'r';
  let offX: number;
  if (snapPx > 0 && dLeft <= snapPx && dLeft <= dRight) {
    anchorH = 'l';
    offX = marginPx;
  } else if (snapPx > 0 && dRight <= snapPx) {
    anchorH = 'r';
    offX = marginPx;
  } else if (dLeft <= dRight) {
    anchorH = 'l';
    offX = x;
  } else {
    anchorH = 'r';
    offX = dRight;
  }

  let anchorV: 't' | 'b';
  let offY: number;
  if (snapPx > 0 && dTop <= snapPx && dTop <= dBottom) {
    anchorV = 't';
    offY = marginPx;
  } else if (snapPx > 0 && dBottom <= snapPx) {
    anchorV = 'b';
    offY = marginPx;
  } else if (dTop <= dBottom) {
    anchorV = 't';
    offY = y;
  } else {
    anchorV = 'b';
    offY = dBottom;
  }

  return {
    anchor: `${anchorV}${anchorH}` as FloatAnchor,
    x: Math.round(offX),
    y: Math.round(offY),
  };
}

function anchoredToStyle(pos: FloatPosition): React.CSSProperties {
  const style: React.CSSProperties = { position: 'fixed' };
  switch (pos.anchor) {
    case 'tl':
      style.top = pos.y;
      style.left = pos.x;
      break;
    case 'tr':
      style.top = pos.y;
      style.right = pos.x;
      break;
    case 'bl':
      style.bottom = pos.y;
      style.left = pos.x;
      break;
    case 'br':
      style.bottom = pos.y;
      style.right = pos.x;
      break;
  }
  return style;
}

export interface DraggableFloatHandle {
  /** Ref to attach to the floating element. */
  ref: React.RefObject<HTMLDivElement>;
  /** Style with computed `position: fixed` + anchor offsets. */
  style: React.CSSProperties;
  /** Spread on the drag handle element (header/grip). */
  dragHandleProps: {
    onPointerDown: (e: React.PointerEvent) => void;
    onDoubleClick: () => void;
    style: React.CSSProperties;
    role: string;
    'aria-label': string;
  };
  /** True while the user is actively dragging. */
  dragging: boolean;
  /** Edges currently in snap zone — `null` when none. */
  snappedEdges: { h: 'l' | 'r' | null; v: 't' | 'b' | null };
  /** Programmatic reset to default position (clears persistence). */
  resetPosition: () => void;
}

export function useDraggableFloat(opts: UseDraggableFloatOptions): DraggableFloatHandle {
  const { id, defaultPos, snapPx = 16, deadZonePx = 4, marginPx = 6 } = opts;

  const [pos, setPos] = useState<FloatPosition>(() => readPersisted(id) ?? defaultPos);
  const [dragging, setDragging] = useState(false);
  const [snappedEdges, setSnappedEdges] = useState<{ h: 'l' | 'r' | null; v: 't' | 'b' | null }>({
    h: null,
    v: null,
  });
  const ref = useRef<HTMLDivElement>(null);

  // Mutable drag state — kept in a ref so handlers don't re-bind every move.
  const dragState = useRef<{
    pointerId: number | null;
    startX: number;
    startY: number;
    elStartX: number;
    elStartY: number;
    armed: boolean;
    width: number;
    height: number;
  }>({
    pointerId: null,
    startX: 0,
    startY: 0,
    elStartX: 0,
    elStartY: 0,
    armed: false,
    width: 0,
    height: 0,
  });

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const ds = dragState.current;
      if (ds.pointerId !== e.pointerId) return;
      const dx = e.clientX - ds.startX;
      const dy = e.clientY - ds.startY;
      if (!ds.armed) {
        if (Math.hypot(dx, dy) < deadZonePx) return;
        ds.armed = true;
        setDragging(true);
      }
      const newTopLeftX = ds.elStartX + dx;
      const newTopLeftY = ds.elStartY + dy;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const next = pointToAnchored(
        newTopLeftX,
        newTopLeftY,
        ds.width,
        ds.height,
        vw,
        vh,
        snapPx,
        marginPx,
      );
      setPos(next);
    },
    [deadZonePx, marginPx, snapPx],
  );

  const onPointerUp = useCallback(
    (e: PointerEvent) => {
      const ds = dragState.current;
      if (ds.pointerId !== e.pointerId) return;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      ds.pointerId = null;
      if (ds.armed) {
        ds.armed = false;
        setDragging(false);
        // Persist final position.
        setPos((p) => {
          writePersisted(id, p);
          return p;
        });
      }
    },
    [id, onPointerMove],
  );

  // Cleanup any in-flight listeners on unmount (defensive).
  useEffect(() => {
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [onPointerMove, onPointerUp]);

  // Re-clamp on viewport resize so the float never escapes after a window resize.
  useEffect(() => {
    const onResize = () => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const next = pointToAnchored(
        rect.left,
        rect.top,
        rect.width,
        rect.height,
        vw,
        vh,
        0, // do not re-snap on resize, just clamp
        marginPx,
      );
      setPos(next);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [marginPx]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Ignore right-click and clicks on nested controls (buttons/inputs etc.)
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (target.closest('button, input, select, textarea, [data-no-drag]')) {
        return;
      }
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      dragState.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        elStartX: rect.left,
        elStartY: rect.top,
        armed: false,
        width: rect.width,
        height: rect.height,
      };
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
    },
    [onPointerMove, onPointerUp],
  );

  const resetPosition = useCallback(() => {
    clearPersisted(id);
    setPos(defaultPos);
  }, [id, defaultPos]);

  const style = useMemo(() => {
    const s = anchoredToStyle(pos);
    if (dragging) {
      s.userSelect = 'none';
      s.cursor = 'grabbing';
    }
    return s;
  }, [pos, dragging]);

  const dragHandleProps = useMemo(
    () => ({
      onPointerDown,
      onDoubleClick: resetPosition,
      style: { cursor: dragging ? 'grabbing' : 'grab', touchAction: 'none' as const },
      role: 'button',
      'aria-label': 'Drag to move (double-click to reset)',
    }),
    [onPointerDown, resetPosition, dragging],
  );

  return { ref, style, dragHandleProps, dragging, resetPosition };
}
