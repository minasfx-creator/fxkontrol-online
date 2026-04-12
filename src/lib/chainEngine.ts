/**
 * ─── Chain Effects (Cadenas) Engine ──────────────────────────────────
 * Finale 3D compatible chain system:
 * - Links multiple shells into a single firing sequence
 * - Auto-calculates timing between shots
 */

import { type TimelineItem } from '@/types/projectTypes';

/** Get all items belonging to a chain */
function getChainItems(
  allItems: TimelineItem[],
  chainRef: string,
): TimelineItem[] {
  return allItems
    .filter(i => i.chainRef === chainRef)
    .sort((a, b) => a.startTime - b.startTime);
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
