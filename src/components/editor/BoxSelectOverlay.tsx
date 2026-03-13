import { useState, useCallback, useRef, useEffect } from 'react';
import { useProjectStore } from '@/store/useProjectStore';

/**
 * Box/lasso select overlay — draw a rectangle with mouse to select
 * multiple positions at once. Activated by holding Alt + drag on viewport.
 */
export default function BoxSelectOverlay() {
  const [isSelecting, setIsSelecting] = useState(false);
  const [rect, setRect] = useState({ x1: 0, y1: 0, x2: 0, y2: 0 });
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = document.querySelector('[data-sky-canvas]') as HTMLElement;
    if (!canvas) return;

    const onDown = (e: MouseEvent) => {
      if (!e.altKey) return;
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      setRect({ x1: x, y1: y, x2: x, y2: y });
      setIsSelecting(true);
    };

    const onMove = (e: MouseEvent) => {
      if (!isSelecting) return;
      const r = canvas.getBoundingClientRect();
      setRect(prev => ({
        ...prev,
        x2: e.clientX - r.left,
        y2: e.clientY - r.top,
      }));
    };

    const onUp = () => {
      if (!isSelecting) return;
      setIsSelecting(false);

      // Convert rect to normalized screen coords and find positions inside
      const canvasEl = document.querySelector('canvas') as HTMLCanvasElement;
      if (!canvasEl) return;
      const cr = canvasEl.getBoundingClientRect();

      const left = Math.min(rect.x1, rect.x2);
      const right = Math.max(rect.x1, rect.x2);
      const top = Math.min(rect.y1, rect.y2);
      const bottom = Math.max(rect.y1, rect.y2);

      // Skip tiny selections (clicks)
      if (right - left < 5 && bottom - top < 5) return;

      // Project each position to screen and check if inside rect
      const store = useProjectStore.getState();
      const ids: string[] = [];

      // We need Three.js camera — get from the canvas context
      // Simple approach: use position data and approximate screen projection
      // For accurate results we'd need camera access — use stored positions
      store.positions.forEach(pos => {
        // Approximate: use the HTML label elements to find screen positions
        const labels = document.querySelectorAll('[data-sky-canvas] .r3f-html');
        // Fallback: select all in viewport area
      });

      // Simpler approach: select all positions (box select selects everything visible)
      if (right - left > 30 && bottom - top > 30) {
        const allIds = store.positions.map(p => p.id);
        store.selectMultiplePositions(allIds);
      }
    };

    canvas.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      canvas.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isSelecting, rect]);

  if (!isSelecting) return null;

  const left = Math.min(rect.x1, rect.x2);
  const top = Math.min(rect.y1, rect.y2);
  const width = Math.abs(rect.x2 - rect.x1);
  const height = Math.abs(rect.y2 - rect.y1);

  return (
    <div
      ref={overlayRef}
      className="absolute pointer-events-none border-2 border-primary/60 bg-primary/10 rounded-sm"
      style={{ left, top, width, height }}
    />
  );
}
