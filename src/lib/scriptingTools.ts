/**
 * ─── Scripting Power Tools ──────────────────────────────────────────
 * Finale 3D compatible scripting tools:
 * - Randomize: randomize timing, position, or angles within ranges
 * - Make Into Sequence: auto-distribute items across positions in time
 * - Make Into Fan: auto-distribute pan/tilt angles in an arc
 * - Spread Out: space items based on their durations
 * - Reverse Order: reverse the timing of selected items
 */

import type { TimelineItem, Position } from '@/store/useProjectStore';

export interface RandomizeConfig {
  timeRange: number;      // ±seconds
  xRange: number;         // ±meters
  zRange: number;         // ±meters
  panRange: number;       // ±degrees
  tiltRange: number;      // ±degrees
  randomizeTime: boolean;
  randomizePosition: boolean;
  randomizeAngles: boolean;
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
};

/** Randomize selected items within configured ranges */
export function randomizeItems(
  items: TimelineItem[],
  config: RandomizeConfig,
): Partial<Omit<TimelineItem, 'id'>>[] {
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

export interface SequenceConfig {
  startTime: number;
  endTime: number;
  direction: 'left-to-right' | 'right-to-left' | 'center-out' | 'edges-in' | 'random';
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
}

export const DEFAULT_SEQUENCE: SequenceConfig = {
  startTime: 0,
  endTime: 10,
  direction: 'left-to-right',
  easing: 'linear',
};

/** Apply easing function */
function applyEasing(t: number, easing: SequenceConfig['easing']): number {
  switch (easing) {
    case 'ease-in': return t * t;
    case 'ease-out': return 1 - (1 - t) * (1 - t);
    case 'ease-in-out': return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    default: return t;
  }
}

/** Make Into Sequence: distribute items evenly in time based on position order */
export function makeIntoSequence(
  items: TimelineItem[],
  positions: Position[],
  config: SequenceConfig,
): { id: string; startTime: number }[] {
  if (items.length === 0) return [];
  
  // Sort items by position based on direction
  const sorted = [...items].map(item => {
    const pos = positions.find(p => p.name === item.positionName) || {
      x: item.position.x,
      z: item.position.z,
    };
    return { item, sortValue: 0, x: pos.x, z: pos.z };
  });

  switch (config.direction) {
    case 'left-to-right':
      sorted.sort((a, b) => a.x - b.x);
      break;
    case 'right-to-left':
      sorted.sort((a, b) => b.x - a.x);
      break;
    case 'center-out':
      sorted.forEach(s => { s.sortValue = Math.sqrt(s.x * s.x + s.z * s.z); });
      sorted.sort((a, b) => a.sortValue - b.sortValue);
      break;
    case 'edges-in':
      sorted.forEach(s => { s.sortValue = Math.sqrt(s.x * s.x + s.z * s.z); });
      sorted.sort((a, b) => b.sortValue - a.sortValue);
      break;
    case 'random':
      for (let i = sorted.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
      }
      break;
  }

  const timeSpan = config.endTime - config.startTime;
  
  return sorted.map((s, idx) => {
    const t = sorted.length > 1 ? idx / (sorted.length - 1) : 0;
    const easedT = applyEasing(t, config.easing);
    return {
      id: s.item.id,
      startTime: config.startTime + easedT * timeSpan,
    };
  });
}

export interface FanConfig {
  panStart: number;    // degrees
  panEnd: number;      // degrees
  tiltStart: number;   // degrees
  tiltEnd: number;     // degrees
  fanType: 'horizontal' | 'vertical' | 'both';
  distribution: 'even' | 'converging' | 'diverging';
}

export const DEFAULT_FAN: FanConfig = {
  panStart: 45,
  panEnd: 135,
  tiltStart: 0,
  tiltEnd: 0,
  fanType: 'horizontal',
  distribution: 'even',
};

/** Make Into Fan: distribute pan/tilt angles across items */
export function makeIntoFan(
  items: TimelineItem[],
  config: FanConfig,
): { id: string; pan: number; tilt: number }[] {
  if (items.length === 0) return [];
  
  const sorted = [...items].sort((a, b) => a.startTime - b.startTime);
  
  return sorted.map((item, idx) => {
    const t = sorted.length > 1 ? idx / (sorted.length - 1) : 0.5;
    
    let adjustedT = t;
    if (config.distribution === 'converging') {
      adjustedT = 1 - Math.abs(t * 2 - 1); // peaks in middle
    } else if (config.distribution === 'diverging') {
      adjustedT = Math.abs(t * 2 - 1); // peaks at edges
    }
    
    const pan = config.fanType !== 'vertical'
      ? config.panStart + (config.panEnd - config.panStart) * adjustedT
      : item.pan ?? 90;
    const tilt = config.fanType !== 'horizontal'
      ? config.tiltStart + (config.tiltEnd - config.tiltStart) * adjustedT
      : item.tilt ?? 0;
    
    return { id: item.id, pan, tilt };
  });
}

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
  gridSize: number, // seconds
): { id: string; startTime: number }[] {
  return items.map(item => ({
    id: item.id,
    startTime: Math.round(item.startTime / gridSize) * gridSize,
  }));
}
