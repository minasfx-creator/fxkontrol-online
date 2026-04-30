/**
 * Viewport Tools — Selection Engine
 * ────────────────────────────────────────────────────────────
 * Thin adapter on top of the existing useProjectStore selection. The store
 * remains the single source of truth for selectedPositionIds — this file
 * only adds segment-aware helpers.
 *
 * Mapping (current ProjectState.Position.type → SegmentType):
 *   pyro       → PYRO
 *   drone-pad  → DRONES
 *   light      → LIGHT
 *   <none>     → SFX, DMX  (no per-position type yet; selectAll returns [])
 */

import { useProjectStore } from '@/store/useProjectStore';
import type { SegmentType } from './types';

const POSITION_TYPE_BY_SEGMENT: Partial<Record<SegmentType, string>> = {
  PYRO: 'pyro',
  DRONES: 'drone-pad',
  LIGHT: 'light',
  // SFX / DMX have no Position.type yet — handled honestly as empty.
};

function getStore() {
  return useProjectStore.getState();
}

export function getPositionIdsForSegment(segment: SegmentType): string[] {
  const wantedType = POSITION_TYPE_BY_SEGMENT[segment];
  if (!wantedType) return [];
  const { positions } = getStore();
  const out: string[] = [];
  for (const p of positions) {
    if (p.type === wantedType) out.push(p.id);
  }
  return out;
}

export function selectAllBySegment(segment: SegmentType): number {
  const ids = getPositionIdsForSegment(segment);
  getStore().selectMultiplePositions(ids);
  return ids.length;
}

export function filterSelectionBySegment(segment: SegmentType): number {
  const wantedType = POSITION_TYPE_BY_SEGMENT[segment];
  if (!wantedType) {
    getStore().selectMultiplePositions([]);
    return 0;
  }
  const { positions, selectedPositionIds } = getStore();
  const allowed = new Set(
    positions.filter((p) => p.type === wantedType).map((p) => p.id)
  );
  const next = selectedPositionIds.filter((id) => allowed.has(id));
  getStore().selectMultiplePositions(next);
  return next.length;
}

export function clearSegmentSelection(_segment: SegmentType): void {
  // Selection in the store is global, not per-segment. Clearing the
  // segment slice is equivalent to dropping any id of that segment.
  const wantedType = _segment ? POSITION_TYPE_BY_SEGMENT[_segment] : undefined;
  if (!wantedType) {
    getStore().clearSelection();
    return;
  }
  const { positions, selectedPositionIds } = getStore();
  const drop = new Set(
    positions.filter((p) => p.type === wantedType).map((p) => p.id)
  );
  getStore().selectMultiplePositions(
    selectedPositionIds.filter((id) => !drop.has(id))
  );
}

export interface SelectionSegmentSummary {
  total: number;
  bySegment: Record<SegmentType, number>;
  hasMixed: boolean;
}

export function getSelectionSegmentSummary(): SelectionSegmentSummary {
  const { positions, selectedPositionIds } = getStore();
  const byType = new Map<string, number>();
  const idIndex = new Map(positions.map((p) => [p.id, p.type] as const));
  for (const id of selectedPositionIds) {
    const t = idIndex.get(id);
    if (!t) continue;
    byType.set(t, (byType.get(t) ?? 0) + 1);
  }
  const bySegment: Record<SegmentType, number> = {
    PYRO: byType.get('pyro') ?? 0,
    DRONES: byType.get('drone-pad') ?? 0,
    LIGHT: byType.get('light') ?? 0,
    SFX: 0,
    DMX: 0,
  };
  const nonZero = Object.values(bySegment).filter((n) => n > 0).length;
  return {
    total: selectedPositionIds.length,
    bySegment,
    hasMixed: nonZero > 1,
  };
}
