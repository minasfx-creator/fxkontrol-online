/**
 * ─── Timeline Drop FX ───────────────────────────────────────────────
 * Lightweight helpers shared across all timeline track drop targets:
 *
 *   - resolveDropTime(): clamp → beat snap → adjacent-item edge snap →
 *     playhead snap. Returns both the snapped time and the snap reason
 *     so the UI can colour the drop-preview guide accordingly.
 *
 *   - markRecentDrop() / useRecentDrop(): a featherweight subscription
 *     that lets a freshly dropped timeline item render a one-shot CSS
 *     drop-flash (fxk-drop-flash) at exactly the snapped timestamp.
 */
import { useSyncExternalStore } from 'react';
import { EFFECT_LIBRARY } from '@/data/effectLibrary';

export type SnapReason = 'free' | 'beat' | 'edge' | 'playhead';

export interface ResolvedDropTime {
  time: number;
  snap: SnapReason;
}

export interface ResolveDropTimeArgs {
  rawTime: number;
  duration: number;
  pixelsPerSecond: number;
  bpm: number | null;
  snapToBeat: boolean;
  currentTime: number;
  /** Same shape as items in useProjectStore.timelineItems, optional. */
  neighbours?: ReadonlyArray<{
    id?: string;
    startTime: number;
    effectId?: string;
    durationOverride?: number;
  }>;
  /** Item being placed (effectId/durationOverride), used for end-edge snapping. */
  placing?: {
    effectId?: string;
    durationOverride?: number;
  };
}

const PLAYHEAD_SNAP_PX = 8;
const EDGE_SNAP_PX = 6;
const BEAT_SNAP_PX = 8;

function effectDurationFor(effectId?: string, durationOverride?: number): number {
  if (typeof durationOverride === 'number') return durationOverride;
  if (!effectId) return 2;
  const e = EFFECT_LIBRARY.find((ef) => ef.id === effectId);
  return e?.duration ?? 2;
}

/** Combined snap resolver. Last winner: playhead > edge > beat > free. */
export function resolveDropTime(args: ResolveDropTimeArgs): ResolvedDropTime {
  const { duration, pixelsPerSecond, bpm, snapToBeat, currentTime, neighbours, placing } = args;
  let time = Math.max(0, Math.min(args.rawTime, duration));
  let snap: SnapReason = 'free';

  // 1) Beat snap (cheapest, lowest priority)
  if (snapToBeat && bpm && bpm > 0) {
    const beat = 60 / bpm;
    const nearest = Math.round(time / beat) * beat;
    if (Math.abs(time - nearest) < BEAT_SNAP_PX / pixelsPerSecond) {
      time = nearest;
      snap = 'beat';
    }
  }

  // 2) Adjacent-item edge snap (start↔end)
  if (neighbours && neighbours.length) {
    const placingDur = effectDurationFor(placing?.effectId, placing?.durationOverride);
    const edgeThreshold = EDGE_SNAP_PX / pixelsPerSecond;
    for (const n of neighbours) {
      const nDur = effectDurationFor(n.effectId, n.durationOverride);
      const nEnd = n.startTime + nDur;
      if (Math.abs(time - nEnd) < edgeThreshold) {
        time = nEnd;
        snap = 'edge';
        break;
      }
      if (Math.abs(time + placingDur - n.startTime) < edgeThreshold) {
        time = Math.max(0, n.startTime - placingDur);
        snap = 'edge';
        break;
      }
    }
  }

  // 3) Playhead snap (highest priority — operators expect this)
  if (Number.isFinite(currentTime)) {
    const threshold = PLAYHEAD_SNAP_PX / pixelsPerSecond;
    if (Math.abs(time - currentTime) < threshold) {
      time = Math.max(0, Math.min(currentTime, duration));
      snap = 'playhead';
    }
  }

  return { time, snap };
}

/** Format a drop-preview timestamp as MM:SS.cc. */
export function formatDropTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.floor((seconds % 1) * 100);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
}

/** Tailwind-ready color tokens for the snap-reason marker pill. */
export function snapAccent(reason: SnapReason): { ring: string; text: string; label: string } {
  switch (reason) {
    case 'playhead': return { ring: 'ring-accent/70',  text: 'text-accent',  label: 'PLAYHEAD' };
    case 'edge':     return { ring: 'ring-primary/70', text: 'text-primary', label: 'EDGE' };
    case 'beat':     return { ring: 'ring-warning/70', text: 'text-warning', label: 'BEAT' };
    default:         return { ring: 'ring-muted-foreground/40', text: 'text-muted-foreground', label: 'FREE' };
  }
}

// ── Recently-dropped event bus (for one-shot drop-flash on the new item) ──
const FLASH_TTL_MS = 600;
let recentDropId: string | null = null;
let recentDropExpiresAt = 0;
const listeners = new Set<() => void>();

function emit() { listeners.forEach((l) => l()); }

export function markRecentDrop(id: string): void {
  recentDropId = id;
  recentDropExpiresAt = Date.now() + FLASH_TTL_MS;
  emit();
  setTimeout(() => {
    if (recentDropId === id) {
      recentDropId = null;
      recentDropExpiresAt = 0;
      emit();
    }
  }, FLASH_TTL_MS);
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function getSnapshot(): string | null {
  if (recentDropId && Date.now() > recentDropExpiresAt) return null;
  return recentDropId;
}

/** Hook: returns the currently-flashing item id (null if none). */
export function useRecentDropId(): string | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}
