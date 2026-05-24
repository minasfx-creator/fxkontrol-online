/**
 * Mortar Fan Generator
 * ────────────────────────────────────────────────────────────
 * Parametric mortar fan: spawns N pyro Positions in a straight line
 * (perpendicular to a heading), each firing once with optional stagger.
 *
 * Returns BOTH new positions and timeline items so the plugin command can
 * commit them atomically and capture undo state.
 */

import type { Position, TimelineItem } from '@/types/projectTypes';

export interface MortarFanParams {
  origin: { x: number; y: number; z: number };
  headingDeg: number;     // 0 = +X, 90 = +Z
  count: number;          // 2..32
  spacingM: number;       // metres between mortars
  staggerMs: number;
  startTime: number;
  effectId: string;
  caliber?: number;       // mm, informative
  baseName?: string;
  baseColor?: string;
}

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export interface MortarFanResult {
  positions: Position[];
  items: TimelineItem[];
}

export function generateMortarFan(params: MortarFanParams): MortarFanResult {
  const count = Math.max(2, Math.min(32, Math.floor(params.count)));
  const spacing = Math.max(0.1, params.spacingM);
  const stagger = Math.max(0, params.staggerMs) / 1000;
  const headingRad = (params.headingDeg * Math.PI) / 180;
  // Perpendicular axis to heading (line spreads sideways).
  const perpX = -Math.sin(headingRad);
  const perpZ = Math.cos(headingRad);
  const half = (count - 1) / 2;

  const positions: Position[] = [];
  const items: TimelineItem[] = [];
  const baseName = params.baseName ?? 'Mortar';

  for (let i = 0; i < count; i++) {
    const offset = (i - half) * spacing;
    const px = params.origin.x + perpX * offset;
    const pz = params.origin.z + perpZ * offset;
    const py = params.origin.y;
    const positionId = uid('pos');

    positions.push({
      id: positionId,
      name: `${baseName} ${i + 1}`,
      type: 'pyro',
      x: px,
      y: py,
      z: pz,
      heading: params.headingDeg,
      pitch: 0,
      roll: 0,
      color: params.baseColor ?? '#ff8800',
    });

    items.push({
      id: uid('cue'),
      effectId: params.effectId,
      startTime: params.startTime + i * stagger,
      trackIndex: 0,
      position: { x: px, y: py, z: pz },
      positionId,
      pan: 0,
      tilt: 0,
      spin: 0,
    });
  }
  return { positions, items };
}
