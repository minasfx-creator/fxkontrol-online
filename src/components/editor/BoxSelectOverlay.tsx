import { useState, useRef, useEffect } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { isLassoActive } from './SelectionModeBar';

/**
 * R3F-aware box selection — projects all positions to screen space
 * and selects those within the drawn rectangle.
 */
export function BoxSelectR3F() {
  const { camera } = useThree();
  const { positions, selectMultiplePositions, editorMode } = useProjectStore();

  useEffect(() => {
    const handler = (e: CustomEvent) => {
      if (editorMode !== 'select') return;
      const { left, right, top, bottom, canvasWidth, canvasHeight } = e.detail;

      const ndcLeft = (left / canvasWidth) * 2 - 1;
      const ndcRight = (right / canvasWidth) * 2 - 1;
      const ndcTop = -(top / canvasHeight) * 2 + 1;
      const ndcBottom = -(bottom / canvasHeight) * 2 + 1;

      const minNdcX = Math.min(ndcLeft, ndcRight);
      const maxNdcX = Math.max(ndcLeft, ndcRight);
      const minNdcY = Math.min(ndcTop, ndcBottom);
      const maxNdcY = Math.max(ndcTop, ndcBottom);

      const selected: string[] = [];
      const projected = new THREE.Vector3();

      positions.forEach(pos => {
        projected.set(pos.x, pos.y + 0.4, pos.z);
        projected.project(camera);

        if (
          projected.x >= minNdcX && projected.x <= maxNdcX &&
          projected.y >= minNdcY && projected.y <= maxNdcY &&
          projected.z > 0 && projected.z < 1
        ) {
          selected.push(pos.id);
        }
      });

      if (selected.length > 0) {
        const store = useProjectStore.getState();
        if (store.selectionMode === 'both') {
          store.selectMultiplePositionsAndLinkedEvents(selected);
        } else {
          selectMultiplePositions(selected);
        }
      }
    };

    window.addEventListener('box-select-complete' as any, handler as any);
    return () => window.removeEventListener('box-select-complete' as any, handler as any);
  }, [camera, positions, selectMultiplePositions, editorMode]);

  return null;
}

/**
 * HTML overlay that draws the selection rectangle.
 * Click+Drag on empty canvas area — 8px dead-zone before activating.
 * Dispatches box-select-active to disable OrbitControls during drag.
 */
export default function BoxSelectOverlay() {
  const [isSelecting, setIsSelecting] = useState(false);
  const [rect, setRect] = useState({ x1: 0, y1: 0, x2: 0, y2: 0 });
  const pendingRef = useRef<{ x: number; y: number; active: boolean }>({ x: 0, y: 0, active: false });
  const selectingRef = useRef(false);
  const rectRef = useRef({ x1: 0, y1: 0, x2: 0, y2: 0 });
  const canvasRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // Use MutationObserver to wait for canvas element to appear
    const findCanvas = () => document.querySelector('[data-sky-canvas]') as HTMLElement | null;

    const setup = (canvas: HTMLElement) => {
      canvasRef.current = canvas;
    };

    const existing = findCanvas();
    if (existing) {
      setup(existing);
    } else {
      const observer = new MutationObserver(() => {
        const el = findCanvas();
        if (el) {
          setup(el);
          observer.disconnect();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      return () => observer.disconnect();
    }
  }, []);

  useEffect(() => {
    const DEAD_ZONE = 8;

    const onDown = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      if (e.button !== 0) return;
      const store = useProjectStore.getState();
      if (store.editorMode !== 'select') return;

      // Only start on canvas area (not UI overlays)
      const target = e.target as HTMLElement;
      if (target !== canvas && !canvas.contains(target)) return;

      // Alt+click = orbit camera (standard 3D convention)
      if (e.altKey) return;

      const r = canvas.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;

      pendingRef.current = { x, y, active: true };

      // Immediately disable OrbitControls to prevent any rotation
      window.dispatchEvent(new CustomEvent('box-select-active', { detail: true }));
    };

    const onMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      if (selectingRef.current) {
        const r = canvas.getBoundingClientRect();
        const updated = {
          ...rectRef.current,
          x2: e.clientX - r.left,
          y2: e.clientY - r.top,
        };
        rectRef.current = updated;
        setRect(updated);
        return;
      }

      if (pendingRef.current.active) {
        const r = canvas.getBoundingClientRect();
        const cx = e.clientX - r.left;
        const cy = e.clientY - r.top;
        const dx = cx - pendingRef.current.x;
        const dy = cy - pendingRef.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist >= DEAD_ZONE) {
          const x = pendingRef.current.x;
          const y = pendingRef.current.y;
          const newRect = { x1: x, y1: y, x2: cx, y2: cy };
          rectRef.current = newRect;
          setRect(newRect);
          selectingRef.current = true;
          setIsSelecting(true);
          pendingRef.current.active = false;

          // Clear previous selection unless Shift is held (additive)
          if (!e.shiftKey) {
            const store = useProjectStore.getState();
            store.selectMultiplePositions([]);
          }
        }
      }
    };

    const onUp = () => {
      const wasPending = pendingRef.current.active;
      pendingRef.current.active = false;

      // Re-enable OrbitControls
      window.dispatchEvent(new CustomEvent('box-select-active', { detail: false }));

      if (!selectingRef.current) return;
      selectingRef.current = false;
      setIsSelecting(false);

      const r = rectRef.current;
      const left = Math.min(r.x1, r.x2);
      const right = Math.max(r.x1, r.x2);
      const top = Math.min(r.y1, r.y2);
      const bottom = Math.max(r.y1, r.y2);

      if (right - left < 8 && bottom - top < 8) return;

      const canvasEl = canvasRef.current;
      if (!canvasEl) return;
      const cr = canvasEl.getBoundingClientRect();

      window.dispatchEvent(new CustomEvent('box-select-complete', {
        detail: {
          left, right, top, bottom,
          canvasWidth: cr.width,
          canvasHeight: cr.height,
        }
      }));
    };

    window.addEventListener('mousedown', onDown, true);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousedown', onDown, true);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  if (!isSelecting) return null;

  const left = Math.min(rect.x1, rect.x2);
  const top = Math.min(rect.y1, rect.y2);
  const width = Math.abs(rect.x2 - rect.x1);
  const height = Math.abs(rect.y2 - rect.y1);

  return (
    <div
      className="absolute pointer-events-none border-2 border-primary/60 bg-primary/10 rounded-sm z-50"
      style={{ left, top, width, height }}
    >
      <div className="absolute -top-5 left-1 text-[9px] font-mono text-primary bg-surface-0/80 px-1.5 rounded">
        {Math.round(width)}×{Math.round(height)}px
      </div>
    </div>
  );
}
