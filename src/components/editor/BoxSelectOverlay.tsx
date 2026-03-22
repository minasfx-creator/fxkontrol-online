import { useState, useCallback, useRef, useEffect } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * R3F-aware box selection — projects all positions to screen space
 * and selects those within the drawn rectangle.
 * Activated by Click+Drag on empty area of the viewport.
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
 * Click+Drag on empty canvas area (no modifier key needed).
 * Uses an 8px dead-zone before activating to avoid blocking OrbitControls.
 */
export default function BoxSelectOverlay() {
  const [isSelecting, setIsSelecting] = useState(false);
  const [rect, setRect] = useState({ x1: 0, y1: 0, x2: 0, y2: 0 });
  const pendingRef = useRef<{ x: number; y: number; active: boolean }>({ x: 0, y: 0, active: false });
  const selectingRef = useRef(false);
  const rectRef = useRef({ x1: 0, y1: 0, x2: 0, y2: 0 });

  useEffect(() => {
    const canvas = document.querySelector('[data-sky-canvas]') as HTMLElement;
    if (!canvas) return;

    const DEAD_ZONE = 8;

    const onDown = (e: MouseEvent) => {
      // Only left click, only in select mode, don't intercept if clicking on interactive elements
      if (e.button !== 0) return;
      const store = useProjectStore.getState();
      if (store.editorMode !== 'select') return;

      // Check if click target is the canvas itself (not a mesh/button/interactive)
      const target = e.target as HTMLElement;
      if (target !== canvas && !canvas.contains(target)) return;

      const r = canvas.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;

      // Enter pending state — don't activate yet, wait for dead-zone
      pendingRef.current = { x, y, active: true };
    };

    const onMove = (e: MouseEvent) => {
      // If already selecting, update rect
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

      // If pending, check dead-zone
      if (pendingRef.current.active) {
        const r = canvas.getBoundingClientRect();
        const cx = e.clientX - r.left;
        const cy = e.clientY - r.top;
        const dx = cx - pendingRef.current.x;
        const dy = cy - pendingRef.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist >= DEAD_ZONE) {
          // Activate box select
          const x = pendingRef.current.x;
          const y = pendingRef.current.y;
          const newRect = { x1: x, y1: y, x2: cx, y2: cy };
          rectRef.current = newRect;
          setRect(newRect);
          selectingRef.current = true;
          setIsSelecting(true);
          pendingRef.current.active = false;

          if (!e.shiftKey) {
            const store = useProjectStore.getState();
            store.selectMultiplePositions([]);
          }
        }
      }
    };

    const onUp = () => {
      pendingRef.current.active = false;

      if (!selectingRef.current) return;
      selectingRef.current = false;
      setIsSelecting(false);

      const r = rectRef.current;
      const left = Math.min(r.x1, r.x2);
      const right = Math.max(r.x1, r.x2);
      const top = Math.min(r.y1, r.y2);
      const bottom = Math.max(r.y1, r.y2);

      if (right - left < 8 && bottom - top < 8) return;

      const canvasEl = document.querySelector('[data-sky-canvas]') as HTMLElement;
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

    canvas.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      canvas.removeEventListener('mousedown', onDown);
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
