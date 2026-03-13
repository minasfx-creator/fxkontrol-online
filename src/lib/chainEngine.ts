/**
 * ─── Chain Effects (Cadenas) Engine ──────────────────────────────────
 * Finale 3D compatible chain system:
 * - Links multiple shells into a single firing sequence
 * - Auto-calculates timing between shots
 * - Supports chain-as-one and chain-as-N counting
 * - Visual representation in timeline
 */

import { type TimelineItem } from '@/store/useProjectStore';

export interface ChainConfig {
  id: string;
  name: string;
  items: string[];          // TimelineItem IDs in sequence
  gap: number;              // seconds between each shot
  countAsOne: boolean;      // inventory: count entire chain as 1 or N items
  color: string;
  totalDuration: number;    // computed
}

/** Generate a chain ID */
export function generateChainId(): string {
  return `chain-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Create a chain from selected timeline items */
export function createChain(
  items: TimelineItem[],
  gap: number = 0.2,
  countAsOne: boolean = true,
): ChainConfig {
  const sorted = [...items].sort((a, b) => a.startTime - b.startTime);
  const id = generateChainId();
  const totalDuration = sorted.length > 1
    ? (sorted[sorted.length - 1].startTime - sorted[0].startTime) + gap
    : gap;

  return {
    id,
    name: `Chain ${id.slice(-5)}`,
    items: sorted.map(i => i.id),
    gap,
    countAsOne,
    color: '#FF6B35',
    totalDuration,
  };
}

/** Apply chain timing: space items evenly by gap */
export function applyChainTiming(
  items: TimelineItem[],
  chainRef: string,
  startTime: number,
  gap: number,
): TimelineItem[] {
  const sorted = [...items].sort((a, b) => a.startTime - b.startTime);
  return sorted.map((item, idx) => ({
    ...item,
    startTime: startTime + idx * gap,
    chainRef,
    chainGap: gap,
  }));
}

/** Get all items belonging to a chain */
export function getChainItems(
  allItems: TimelineItem[],
  chainRef: string,
): TimelineItem[] {
  return allItems
    .filter(i => i.chainRef === chainRef)
    .sort((a, b) => a.startTime - b.startTime);
}

/** Break a chain: remove chainRef from all items */
export function breakChainItems(
  allItems: TimelineItem[],
  chainRef: string,
): TimelineItem[] {
  return allItems.map(i =>
    i.chainRef === chainRef
      ? { ...i, chainRef: undefined, chainGap: undefined }
      : i
  );
}

/** Get unique chain refs from items */
export function getUniqueChains(items: TimelineItem[]): string[] {
  const refs = new Set<string>();
  items.forEach(i => { if (i.chainRef) refs.add(i.chainRef); });
  return Array.from(refs);
}

/** Compute chain statistics */
export function getChainStats(items: TimelineItem[], chainRef: string) {
  const chainItems = getChainItems(items, chainRef);
  if (chainItems.length === 0) return null;
  const first = chainItems[0];
  const last = chainItems[chainItems.length - 1];
  return {
    count: chainItems.length,
    startTime: first.startTime,
    endTime: last.startTime,
    totalDuration: last.startTime - first.startTime,
    avgGap: chainItems.length > 1
      ? (last.startTime - first.startTime) / (chainItems.length - 1)
      : 0,
  };
}

/** Validate chain: check for overlaps and timing issues */
export function validateChain(items: TimelineItem[], chainRef: string): string[] {
  const chainItems = getChainItems(items, chainRef);
  const issues: string[] = [];
  
  for (let i = 1; i < chainItems.length; i++) {
    const gap = chainItems[i].startTime - chainItems[i - 1].startTime;
    if (gap < 0.05) {
      issues.push(`Items ${i} and ${i + 1} are too close (${gap.toFixed(3)}s)`);
    }
    if (gap > 10) {
      issues.push(`Large gap between items ${i} and ${i + 1} (${gap.toFixed(1)}s)`);
    }
  }
  
  return issues;
}
