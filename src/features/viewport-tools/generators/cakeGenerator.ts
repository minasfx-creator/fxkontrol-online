/**
 * Cake Generator
 * ────────────────────────────────────────────────────────────
 * Parametric multi-shot cake (e.g. 25-shot fan): produces N TimelineItems
 * around a single anchor pyro position with controlled stagger + spread.
 *
 * Pure function — no side effects. Caller decides whether to push to store
 * (handled by the plugin command so undo/redo can capture the `addedIds`).
 */

import type { TimelineItem } from '@/types/projectTypes';

export interface CakeParams {
  anchorPositionId: string;
  anchor: { x: number; y: number; z: number };
  effectId: string;
  shots: number;        // 1..200
  staggerMs: number;    // ≥ 50 ms recommended
  spreadDeg: number;    // total fan opening, 0..180
  startTime: number;    // seconds
  caliber?: number;
  trackIndex?: number;
}

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function generateCake(params: CakeParams): TimelineItem[] {
  const shots = Math.max(1, Math.min(200, Math.floor(params.shots)));
  const stagger = Math.max(0, params.staggerMs) / 1000;
  const spread = Math.max(0, Math.min(180, params.spreadDeg));
  const half = spread / 2;
  const items: TimelineItem[] = [];

  for (let i = 0; i < shots; i++) {
    const t = shots === 1 ? 0 : i / (shots - 1); // 0..1
    const pan = shots === 1 ? 0 : -half + t * spread;
    items.push({
      id: uid('cake'),
      effectId: params.effectId,
      startTime: params.startTime + i * stagger,
      trackIndex: params.trackIndex ?? 0,
      position: { ...params.anchor },
      positionId: params.anchorPositionId,
      pan,
      tilt: 0,
      spin: 0,
    });
  }
  return items;
}
