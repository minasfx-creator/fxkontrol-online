/**
 * Timeline ECS/DOD Engine — Contiguous TypedArray-based entity system.
 * Optimized for cache-local iteration over thousands of timeline items.
 *
 * Memory layout (~42KB for 2000 items):
 *   startTimes: Float64Array (16KB)
 *   durations:  Float64Array (16KB)
 *   effectIdx:  Uint16Array  (4KB)
 *   posIdx:     Uint16Array  (4KB)
 *   flags:      Uint8Array   (2KB)
 *
 * Flag bits: 0=selected, 1=locked, 2=muted, 3=linked
 */

import type { TimelineItem } from '@/types/projectTypes';

// ── Flags ──
export const FLAG_SELECTED = 1 << 0;
export const FLAG_LOCKED   = 1 << 1;
export const FLAG_MUTED    = 1 << 2;
export const FLAG_LINKED   = 1 << 3;

// ── Visible item result (returned by renderSystem) ──
export interface VisibleItem {
  index: number;
  entityId: string;
  left: number;   // px from viewport left
  width: number;  // px width
}

// ── ECS World ──
export class TimelineECSWorld {
  capacity: number;
  count: number = 0;

  // Component arrays (contiguous)
  startTimes: Float64Array;
  durations: Float64Array;
  effectIdx: Uint16Array;
  posIdx: Uint16Array;
  flags: Uint8Array;

  // String ID map (index ↔ entity ID)
  private entityIds: string[];
  private idToIndex: Map<string, number>;

  // External ID maps (effectId string → index, positionId string → index)
  private effectIdMap: Map<string, number> = new Map();
  private positionIdMap: Map<string, number> = new Map();
  private effectIdReverse: string[] = [];
  private positionIdReverse: string[] = [];

  constructor(capacity = 4096) {
    this.capacity = capacity;
    this.startTimes = new Float64Array(capacity);
    this.durations = new Float64Array(capacity);
    this.effectIdx = new Uint16Array(capacity);
    this.posIdx = new Uint16Array(capacity);
    this.flags = new Uint8Array(capacity);
    this.entityIds = new Array(capacity).fill('');
    this.idToIndex = new Map();
  }

  // ── Ingest from Zustand store ──
  ingestFromStore(items: TimelineItem[], effectIds: string[], positionIds: string[]): void {
    // Build lookup maps
    this.effectIdMap.clear();
    this.positionIdMap.clear();
    this.effectIdReverse = effectIds;
    this.positionIdReverse = positionIds;
    effectIds.forEach((id, i) => this.effectIdMap.set(id, i));
    positionIds.forEach((id, i) => this.positionIdMap.set(id, i));

    // Grow if needed
    if (items.length > this.capacity) this.grow(items.length * 2);

    this.count = items.length;
    this.idToIndex.clear();

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      this.entityIds[i] = item.id;
      this.idToIndex.set(item.id, i);
      this.startTimes[i] = item.startTime;
      this.durations[i] = item.durationOverride || 3.0;
      this.effectIdx[i] = this.effectIdMap.get(item.effectId) ?? 0;
      this.posIdx[i] = item.positionId ? (this.positionIdMap.get(item.positionId) ?? 0) : 0;
      this.flags[i] = 0;
    }
  }

  // ── Grow arrays ──
  private grow(newCapacity: number): void {
    const copy = <T extends Float64Array | Uint16Array | Uint8Array>(
      src: T, cap: number
    ): T => {
      const Ctor = src.constructor as new (length: number) => T;
      const dst = new Ctor(cap);
      dst.set(src);
      return dst;
    };
    this.startTimes = copy(this.startTimes, newCapacity);
    this.durations = copy(this.durations, newCapacity);
    this.effectIdx = copy(this.effectIdx, newCapacity);
    this.posIdx = copy(this.posIdx, newCapacity);
    this.flags = copy(this.flags, newCapacity);
    this.entityIds.length = newCapacity;
    this.capacity = newCapacity;
  }

  // ── Systems ──

  /** Translate selected items by deltaTime (batch move) */
  translateSystem(deltaTime: number): void {
    for (let i = 0; i < this.count; i++) {
      if (this.flags[i] & FLAG_SELECTED) {
        this.startTimes[i] = Math.max(0, this.startTimes[i] + deltaTime);
      }
    }
  }

  /** Snap all times to beat grid */
  snapSystem(bpm: number): void {
    const beatDuration = 60 / bpm;
    for (let i = 0; i < this.count; i++) {
      this.startTimes[i] = Math.round(this.startTimes[i] / beatDuration) * beatDuration;
    }
  }

  /** Detect collisions — returns pairs of overlapping indices on same position */
  collisionSystem(): [number, number][] {
    const collisions: [number, number][] = [];
    // Sort indices by startTime for sweep-line
    const indices = new Uint32Array(this.count);
    for (let i = 0; i < this.count; i++) indices[i] = i;
    indices.sort((a, b) => this.startTimes[a] - this.startTimes[b]);

    for (let i = 0; i < indices.length; i++) {
      const ai = indices[i];
      const aEnd = this.startTimes[ai] + this.durations[ai];
      for (let j = i + 1; j < indices.length; j++) {
        const bi = indices[j];
        if (this.startTimes[bi] >= aEnd) break; // sorted → no more overlaps
        if (this.posIdx[ai] === this.posIdx[bi]) {
          collisions.push([ai, bi]);
        }
      }
    }
    return collisions;
  }

  /** Return only visible items for a given viewport scroll/zoom */
  renderSystem(scrollLeft: number, viewportWidth: number, pxPerSec: number): VisibleItem[] {
    const timeLeft = scrollLeft / pxPerSec;
    const timeRight = (scrollLeft + viewportWidth) / pxPerSec;
    const result: VisibleItem[] = [];

    for (let i = 0; i < this.count; i++) {
      const start = this.startTimes[i];
      const end = start + this.durations[i];
      if (end < timeLeft || start > timeRight) continue;
      result.push({
        index: i,
        entityId: this.entityIds[i],
        left: (start - timeLeft) * pxPerSec,
        width: Math.max(this.durations[i] * pxPerSec, 4),
      });
    }
    return result;
  }

  /** Select items by index */
  select(indices: number[]): void {
    // Clear all
    for (let i = 0; i < this.count; i++) this.flags[i] &= ~FLAG_SELECTED;
    for (const idx of indices) {
      if (idx >= 0 && idx < this.count) this.flags[idx] |= FLAG_SELECTED;
    }
  }

  /** Select by entity ID */
  selectByIds(ids: string[]): void {
    for (let i = 0; i < this.count; i++) this.flags[i] &= ~FLAG_SELECTED;
    for (const id of ids) {
      const idx = this.idToIndex.get(id);
      if (idx != null) this.flags[idx] |= FLAG_SELECTED;
    }
  }

  /** Get selected entity IDs */
  getSelectedIds(): string[] {
    const result: string[] = [];
    for (let i = 0; i < this.count; i++) {
      if (this.flags[i] & FLAG_SELECTED) result.push(this.entityIds[i]);
    }
    return result;
  }

  /** Sync modifications back to Zustand-compatible objects */
  syncToStore(): Partial<TimelineItem>[] {
    const updates: Partial<TimelineItem>[] = [];
    for (let i = 0; i < this.count; i++) {
      updates.push({
        id: this.entityIds[i],
        startTime: this.startTimes[i],
        durationOverride: this.durations[i],
        effectId: this.effectIdReverse[this.effectIdx[i]] || '',
        positionId: this.positionIdReverse[this.posIdx[i]] || undefined,
      });
    }
    return updates;
  }

  /** Get entity index by ID */
  getIndex(id: string): number | undefined {
    return this.idToIndex.get(id);
  }

  /** Get entity ID by index */
  getId(index: number): string {
    return this.entityIds[index] || '';
  }

  /** Stats for performance monitoring */
  getStats() {
    return {
      count: this.count,
      capacity: this.capacity,
      memoryBytes: (this.startTimes.byteLength + this.durations.byteLength +
        this.effectIdx.byteLength + this.posIdx.byteLength + this.flags.byteLength),
    };
  }
}

// ── Singleton instance ──
export const timelineECS = new TimelineECSWorld(4096);
