/**
 * useScrollViewport — Subscribe to a horizontally scrollable container's
 * scrollLeft + clientWidth so children can do horizontal culling
 * (visible-window virtualization for absolutely-positioned items).
 *
 * Listener is `passive: true` and reads from the DOM directly. Component
 * re-renders only when the scroll position or width meaningfully changes.
 *
 * Why a shared hook: prior to this, 6 timeline track rows duplicated the
 * same useEffect. Centralising avoids drift and makes the optimisation
 * testable in one place.
 */
import { useEffect, useState, type RefObject } from 'react';

export interface ScrollViewport {
  scrollLeft: number;
  viewportWidth: number;
}

export function useScrollViewport(
  scrollRef: RefObject<HTMLElement | null>,
  defaultWidth = 1200,
): ScrollViewport {
  const [state, setState] = useState<ScrollViewport>({
    scrollLeft: 0,
    viewportWidth: defaultWidth,
  });

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const update = () => {
      const next = { scrollLeft: el.scrollLeft, viewportWidth: el.clientWidth };
      setState((prev) =>
        prev.scrollLeft === next.scrollLeft && prev.viewportWidth === next.viewportWidth
          ? prev
          : next,
      );
    };

    update();
    el.addEventListener('scroll', update, { passive: true });

    // ResizeObserver covers panel resize / window resize without a global listener.
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(update);
      ro.observe(el);
    }

    return () => {
      el.removeEventListener('scroll', update);
      ro?.disconnect();
    };
  }, [scrollRef]);

  return state;
}

/**
 * Compute whether an absolutely-positioned item intersects the visible
 * scroll window. `bufferPx` is rendered on each side to avoid pop-in
 * during fast scrolls.
 *
 * `labelOffsetPx` accounts for the fixed label column to the left of
 * scroll content (timeline tracks have a 96px sticky label).
 */
export function isInScrollWindow(
  itemLeftPx: number,
  itemWidthPx: number,
  scroll: ScrollViewport,
  options: { bufferPx?: number; labelOffsetPx?: number } = {},
): boolean {
  const { bufferPx = 200, labelOffsetPx = 0 } = options;
  const left = scroll.scrollLeft - labelOffsetPx - bufferPx;
  const right = scroll.scrollLeft - labelOffsetPx + scroll.viewportWidth + bufferPx;
  return itemLeftPx + itemWidthPx >= left && itemLeftPx <= right;
}
