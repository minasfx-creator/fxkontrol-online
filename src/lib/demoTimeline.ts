/**
 * demoTimeline — "Fire All" demonstration timeline.
 *
 * Builds a deterministic sequence that exercises every renderer in the
 * platform (pyro, drone, SFX, laser, light) so the operator can verify
 * end-to-end playback with a single Play press.
 *
 * Design rules:
 *  - Pure builder: never touches the store directly. Returns positions +
 *    timeline items. The caller commits via the project store actions.
 *  - One position per category to keep XZ layout readable in the viewport.
 *  - Items spaced by 1.5s so multiple categories overlap visually but do
 *    not all peak in the same frame (helps spot per-system regressions).
 *  - Picks the FIRST effect of each `type` in EFFECT_LIBRARY so it stays
 *    valid even if specific IDs get renamed.
 */
import type { Position, TimelineItem } from '@/types/projectTypes';
import { EFFECT_LIBRARY, type Effect } from '@/data/effectLibrary';

export interface DemoTimelinePayload {
  positions: Position[];
  items: TimelineItem[];
  /** Suggested timeline duration in seconds to fit the demo + tail. */
  duration: number;
}

const CATEGORY_LAYOUT: Array<{
  type: Effect['type'];
  posType: Position['type'];
  name: string;
  color: string;
  x: number;
  z: number;
}> = [
  { type: 'firework', posType: 'pyro',      name: 'DEMO Pyro',  color: '#FF6B35', x: -20, z: 0 },
  { type: 'drone',    posType: 'drone-pad', name: 'DEMO Drone', color: '#00B4D8', x: -10, z: 0 },
  { type: 'sfx',      posType: 'pyro',      name: 'DEMO SFX',   color: '#F4A261', x:   0, z: 0 },
  { type: 'laser',    posType: 'light',     name: 'DEMO Laser', color: '#9B5DE5', x:  10, z: 0 },
  { type: 'light',    posType: 'light',     name: 'DEMO Light', color: '#06D6A0', x:  20, z: 0 },
];

const ITEM_SPACING_SEC = 1.5;
const REPEATS_PER_CATEGORY = 4;
const TAIL_SEC = 4;

function pickEffect(type: Effect['type']): Effect | null {
  return EFFECT_LIBRARY.find((e) => e.type === type) ?? null;
}

/**
 * Build the demo positions + timeline items.
 * Returns null if the effect library is empty (paranoia — should never happen).
 */
export function buildDemoTimeline(): DemoTimelinePayload | null {
  const positions: Position[] = [];
  const items: TimelineItem[] = [];

  let trackIndex = 0;
  let lastTime = 0;

  for (const slot of CATEGORY_LAYOUT) {
    const effect = pickEffect(slot.type);
    if (!effect) continue;

    const positionId = `demo-pos-${slot.type}`;
    positions.push({
      id: positionId,
      name: slot.name,
      type: slot.posType,
      x: slot.x,
      y: 0,
      z: slot.z,
      heading: 0,
      pitch: 0,
      roll: 0,
      color: slot.color,
    });

    for (let i = 0; i < REPEATS_PER_CATEGORY; i++) {
      const startTime = trackIndex * 0.4 + i * ITEM_SPACING_SEC;
      lastTime = Math.max(lastTime, startTime + (effect.duration ?? 2));
      items.push({
        id: `demo-item-${slot.type}-${i}`,
        effectId: effect.id,
        startTime,
        trackIndex,
        position: { x: slot.x, y: 0, z: slot.z },
        positionId,
        positionName: slot.name,
        notes: 'Auto-generated demo cue',
      });
    }

    trackIndex++;
  }

  if (items.length === 0) return null;

  return {
    positions,
    items,
    duration: Math.ceil(lastTime + TAIL_SEC),
  };
}

/** Prefix used to identify demo entities in the project store. */
export const DEMO_ID_PREFIX = 'demo-';

export function isDemoTimelineItem(item: { id: string }): boolean {
  return item.id.startsWith(DEMO_ID_PREFIX);
}
