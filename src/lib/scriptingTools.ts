/**
 * ─── Scripting Power Tools — Finale 3D Compatible ───────────────────
 * Full Finale 3D scripting feature set:
 * - Randomize: "looks random" algorithm (no consecutive repeats)
 * - Make Into Sequence: sort by position/angle/time, cycles, bounce
 * - Make Into Fan: sort by time/angle, inward/outward
 * - Spread Out: space items based on durations
 * - Reverse Order: reverse timing
 * - Quantize: snap to grid
 */

import type { TimelineItem, Position } from '@/store/useProjectStore';

// ═══════════════════════════════════════════════════════════════════════
// Randomize — Finale's "looks random" algorithm
// ═══════════════════════════════════════════════════════════════════════

export interface RandomizeConfig {
  timeRange: number;
  xRange: number;
  zRange: number;
  panRange: number;
  tiltRange: number;
  randomizeTime: boolean;
  randomizePosition: boolean;
  randomizeAngles: boolean;
  /** Use "looks random" permutation (avoids consecutive repeats) */
  looksRandom: boolean;
  /** Seed counter for deterministic results (increments on each call) */
  seedCounter: number;
}

export const DEFAULT_RANDOMIZE: RandomizeConfig = {
  timeRange: 0.2,
  xRange: 1,
  zRange: 1,
  panRange: 15,
  tiltRange: 5,
  randomizeTime: true,
  randomizePosition: false,
  randomizeAngles: false,
  looksRandom: true,
  seedCounter: 0,
};

/** Simple seeded PRNG for deterministic results */
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/** Hash items into a seed for deterministic randomization */
function computeSeed(items: TimelineItem[], counter: number): number {
  let hash = counter * 7919;
  for (const item of items) {
    hash = (hash * 31 + Math.round(item.startTime * 1000)) & 0x7fffffff;
    hash = (hash * 31 + Math.round(item.position.x * 100)) & 0x7fffffff;
  }
  return hash;
}

/**
 * Finale's "looks random" shuffle: constraint-based permutation
 * that avoids consecutive items from the same position/effect.
 */
function looksRandomShuffle<T>(
  items: T[],
  getKey: (item: T) => string,
  rng: () => number,
): T[] {
  if (items.length <= 2) return [...items].sort(() => rng() - 0.5);

  const result: T[] = [];
  const remaining = [...items];
  let lastKey = '';
  let attempts = 0;
  const maxAttempts = remaining.length * 10;

  while (remaining.length > 0 && attempts < maxAttempts) {
    const idx = Math.floor(rng() * remaining.length);
    const candidate = remaining[idx];
    const key = getKey(candidate);

    if (key !== lastKey || remaining.length === 1) {
      result.push(candidate);
      remaining.splice(idx, 1);
      lastKey = key;
      attempts = 0;
    } else {
      attempts++;
    }
  }

  // If overconstrained, just append remaining
  result.push(...remaining);
  return result;
}

/** Randomize selected items within configured ranges */
export function randomizeItems(
  items: TimelineItem[],
  config: RandomizeConfig,
): Partial<Omit<TimelineItem, 'id'>>[] {
  if (config.looksRandom && config.randomizeTime) {
    // Finale "looks random": permute the time slots
    const seed = computeSeed(items, config.seedCounter);
    const rng = seededRandom(seed);
    const sorted = [...items].sort((a, b) => a.startTime - b.startTime);
    const times = sorted.map(i => i.startTime);
    const shuffled = looksRandomShuffle(
      sorted,
      item => item.positionName || `${item.position.x.toFixed(1)}_${item.position.z.toFixed(1)}`,
      rng,
    );
    return items.map(item => {
      const newIdx = shuffled.findIndex(s => s.id === item.id);
      const updates: Partial<Omit<TimelineItem, 'id'>> = {};
      if (config.randomizeTime && newIdx >= 0) {
        updates.startTime = times[newIdx];
      }
      if (config.randomizePosition) {
        updates.position = {
          x: item.position.x + (rng() * 2 - 1) * config.xRange,
          y: item.position.y,
          z: item.position.z + (rng() * 2 - 1) * config.zRange,
        };
      }
      if (config.randomizeAngles) {
        updates.pan = (item.pan ?? 90) + (rng() * 2 - 1) * config.panRange;
        updates.tilt = (item.tilt ?? 0) + (rng() * 2 - 1) * config.tiltRange;
      }
      return updates;
    });
  }

  // Legacy pure random
  return items.map(item => {
    const updates: Partial<Omit<TimelineItem, 'id'>> = {};
    if (config.randomizeTime) {
      updates.startTime = Math.max(0, item.startTime + (Math.random() * 2 - 1) * config.timeRange);
    }
    if (config.randomizePosition) {
      updates.position = {
        x: item.position.x + (Math.random() * 2 - 1) * config.xRange,
        y: item.position.y,
        z: item.position.z + (Math.random() * 2 - 1) * config.zRange,
      };
    }
    if (config.randomizeAngles) {
      updates.pan = (item.pan ?? 90) + (Math.random() * 2 - 1) * config.panRange;
      updates.tilt = (item.tilt ?? 0) + (Math.random() * 2 - 1) * config.tiltRange;
    }
    return updates;
  });
}

// ═══════════════════════════════════════════════════════════════════════
// Make Into Sequence — Finale 3D compatible
// ═══════════════════════════════════════════════════════════════════════

export type SequenceSortMode =
  | 'position-name' | 'position-ltr' | 'position-clockwise'
  | 'angle' | 'angle-center-out' | 'angle-edges-in'
  | 'effect-time'
  // Legacy aliases
  | 'left-to-right' | 'right-to-left' | 'center-out' | 'edges-in' | 'random';

export type SequenceGroupMode =
  | 'individual'            // Each item is a separate time point
  | 'stick-subsequences'    // Groups of same position/angle stick together
  | 'multiple-cycles'       // Multiple cycles (no bounce)
  | 'bouncing-cycles';      // Bouncing zig-zag cycles

export interface SequenceConfig {
  startTime: number;
  endTime: number;
  direction: SequenceSortMode;
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
  /** Number of cycles (for multiple-cycles / bouncing modes) */
  cycles: number;
  /** Bounce: reverse direction each cycle */
  bounce: boolean;
  /** Remove doubled turnarounds on bounce ends */
  removeTurnarounds: boolean;
  /** Group mode */
  groupMode: SequenceGroupMode;
  /** Treat chains atomically */
  preserveChains: boolean;
}

export const DEFAULT_SEQUENCE: SequenceConfig = {
  startTime: 0,
  endTime: 10,
  direction: 'left-to-right',
  easing: 'linear',
  cycles: 1,
  bounce: false,
  removeTurnarounds: true,
  groupMode: 'individual',
  preserveChains: true,
};

function applyEasing(t: number, easing: SequenceConfig['easing']): number {
  switch (easing) {
    case 'ease-in': return t * t;
    case 'ease-out': return 1 - (1 - t) * (1 - t);
    case 'ease-in-out': return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    default: return t;
  }
}

/** Get position sort value based on sort mode */
function getPositionSortValue(
  item: TimelineItem,
  positions: Position[],
  mode: SequenceSortMode,
): number {
  const pos = positions.find(p => p.name === item.positionName) || {
    x: item.position.x, z: item.position.z, name: '',
  };

  switch (mode) {
    case 'position-ltr':
    case 'left-to-right':
      return pos.x;
    case 'right-to-left':
      return -pos.x;
    case 'position-clockwise':
      return Math.atan2(pos.z, pos.x);
    case 'position-name':
      return 0; // sorted by name separately
    case 'center-out':
      return Math.sqrt(pos.x * pos.x + (pos as any).z * (pos as any).z);
    case 'edges-in':
      return -Math.sqrt(pos.x * pos.x + (pos as any).z * (pos as any).z);
    case 'angle':
      return item.pan ?? 90;
    case 'angle-center-out':
      return Math.abs((item.pan ?? 90) - 90);
    case 'angle-edges-in':
      return -Math.abs((item.pan ?? 90) - 90);
    case 'effect-time':
      return item.startTime;
    case 'random':
      return Math.random();
    default:
      return pos.x;
  }
}

/** Make Into Sequence: distribute items evenly in time */
export function makeIntoSequence(
  items: TimelineItem[],
  positions: Position[],
  config: SequenceConfig,
): { id: string; startTime: number }[] {
  if (items.length === 0) return [];

  // Sort items
  const sorted = [...items].map(item => ({
    item,
    sortValue: getPositionSortValue(item, positions, config.direction),
    name: item.positionName || '',
  }));

  if (config.direction === 'position-name') {
    sorted.sort((a, b) => a.name.localeCompare(b.name));
  } else if (config.direction === 'random') {
    for (let i = sorted.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
    }
  } else {
    sorted.sort((a, b) => a.sortValue - b.sortValue);
  }

  // Handle cycles and bounce
  let sequence = sorted;
  if (config.cycles > 1 || config.bounce) {
    const singleCycle = [...sorted];
    sequence = [];
    for (let c = 0; c < config.cycles; c++) {
      if (config.bounce && c % 2 === 1) {
        const reversed = [...singleCycle].reverse();
        if (config.removeTurnarounds && sequence.length > 0) {
          reversed.shift(); // remove doubled turnaround
        }
        sequence.push(...reversed);
      } else {
        if (config.removeTurnarounds && c > 0 && sequence.length > 0) {
          const withoutFirst = [...singleCycle];
          withoutFirst.shift();
          sequence.push(...withoutFirst);
        } else {
          sequence.push(...singleCycle);
        }
      }
    }
  }

  const timeSpan = config.endTime - config.startTime;

  return sequence.map((s, idx) => {
    const t = sequence.length > 1 ? idx / (sequence.length - 1) : 0;
    const easedT = applyEasing(t, config.easing);
    return {
      id: s.item.id,
      startTime: config.startTime + easedT * timeSpan,
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════
// Make Into Fan — Finale 3D compatible
// ═══════════════════════════════════════════════════════════════════════

export type FanSortMode = 'time' | 'time-center-out' | 'time-edges-in' | 'position-ltr' | 'position-name';

export interface FanConfig {
  panStart: number;
  panEnd: number;
  tiltStart: number;
  tiltEnd: number;
  fanType: 'horizontal' | 'vertical' | 'both';
  distribution: 'even' | 'converging' | 'diverging';
  /** Sort mode for fan ordering */
  sortMode: FanSortMode;
  /** Inward fan (converge toward center position) */
  inward: boolean;
}

export const DEFAULT_FAN: FanConfig = {
  panStart: 45,
  panEnd: 135,
  tiltStart: 0,
  tiltEnd: 0,
  fanType: 'horizontal',
  distribution: 'even',
  sortMode: 'time',
  inward: false,
};

/** Make Into Fan: distribute pan/tilt angles across items */
export function makeIntoFan(
  items: TimelineItem[],
  config: FanConfig,
): { id: string; pan: number; tilt: number }[] {
  if (items.length === 0) return [];

  // Sort based on mode
  let sorted: TimelineItem[];
  switch (config.sortMode) {
    case 'time-center-out': {
      const byST = [...items].sort((a, b) => a.startTime - b.startTime);
      // Reorder: first→center, spreading outward
      const result: TimelineItem[] = [];
      const mid = Math.floor(byST.length / 2);
      for (let i = 0; i < byST.length; i++) {
        if (i % 2 === 0) result.push(byST[mid + Math.floor(i / 2)] || byST[byST.length - 1]);
        else result.push(byST[mid - Math.ceil(i / 2)] || byST[0]);
      }
      sorted = result;
      break;
    }
    case 'time-edges-in': {
      const byST = [...items].sort((a, b) => a.startTime - b.startTime);
      const result: TimelineItem[] = [];
      let lo = 0, hi = byST.length - 1;
      while (lo <= hi) {
        result.push(byST[lo++]);
        if (lo <= hi) result.push(byST[hi--]);
      }
      sorted = result;
      break;
    }
    case 'position-ltr':
      sorted = [...items].sort((a, b) => a.position.x - b.position.x);
      break;
    case 'position-name':
      sorted = [...items].sort((a, b) => (a.positionName || '').localeCompare(b.positionName || ''));
      break;
    default:
      sorted = [...items].sort((a, b) => a.startTime - b.startTime);
  }

  // Apply inward fan (swap start/end to converge)
  const pStart = config.inward ? config.panEnd : config.panStart;
  const pEnd = config.inward ? config.panStart : config.panEnd;
  const tStart = config.inward ? config.tiltEnd : config.tiltStart;
  const tEnd = config.inward ? config.tiltStart : config.tiltEnd;

  return sorted.map((item, idx) => {
    const t = sorted.length > 1 ? idx / (sorted.length - 1) : 0.5;

    let adjustedT = t;
    if (config.distribution === 'converging') {
      adjustedT = 1 - Math.abs(t * 2 - 1);
    } else if (config.distribution === 'diverging') {
      adjustedT = Math.abs(t * 2 - 1);
    }

    const pan = config.fanType !== 'vertical'
      ? pStart + (pEnd - pStart) * adjustedT
      : item.pan ?? 90;
    const tilt = config.fanType !== 'horizontal'
      ? tStart + (tEnd - tStart) * adjustedT
      : item.tilt ?? 0;

    return { id: item.id, pan, tilt };
  });
}

// ═══════════════════════════════════════════════════════════════════════
// Spread Out / Reverse / Quantize
// ═══════════════════════════════════════════════════════════════════════

/** Spread Out: space items based on their durations so they don't overlap */
export function spreadOut(
  items: TimelineItem[],
  effects: { id: string; duration: number }[],
  gap: number = 0.1,
): { id: string; startTime: number }[] {
  const sorted = [...items].sort((a, b) => a.startTime - b.startTime);
  const result: { id: string; startTime: number }[] = [];
  let currentTime = sorted[0]?.startTime ?? 0;

  for (const item of sorted) {
    result.push({ id: item.id, startTime: currentTime });
    const effect = effects.find(e => e.id === item.effectId);
    currentTime += (effect?.duration ?? 2) + gap;
  }

  return result;
}

/** Reverse Order: reverse timing of selected items */
export function reverseOrder(
  items: TimelineItem[],
): { id: string; startTime: number }[] {
  const sorted = [...items].sort((a, b) => a.startTime - b.startTime);
  const times = sorted.map(i => i.startTime);
  const reversed = [...times].reverse();

  return sorted.map((item, idx) => ({
    id: item.id,
    startTime: reversed[idx],
  }));
}

/** Quantize: snap all items to nearest beat/grid */
export function quantizeToGrid(
  items: TimelineItem[],
  gridSize: number,
): { id: string; startTime: number }[] {
  return items.map(item => ({
    id: item.id,
    startTime: Math.round(item.startTime / gridSize) * gridSize,
  }));
}

// ═══════════════════════════════════════════════════════════════════════
// Finale ASCII Angle Preview
// ═══════════════════════════════════════════════════════════════════════

/** Generate ASCII art angle preview like Finale's \|/ notation */
export function getAngleAscii(panDegrees: number): string {
  if (panDegrees < 30) return '\\\\';
  if (panDegrees < 60) return '\\';
  if (panDegrees < 80) return '\\|';
  if (panDegrees <= 100) return '|';
  if (panDegrees < 120) return '|/';
  if (panDegrees < 150) return '/';
  return '//';
}

/** Generate combined angle preview for a list of items */
export function getAnglesPreview(items: { pan?: number }[]): string {
  return items.map(i => getAngleAscii(i.pan ?? 90)).join('');
}
