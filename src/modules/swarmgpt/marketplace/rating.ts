/**
 * In-memory rating store.
 * Each effect's ratings are clamped to [0, 5]. Persistence is the host app's
 * responsibility; this module exposes pure read/write helpers.
 */
const RATINGS = new Map<string, number[]>();

function clamp05(n: number): number {
  if (Number.isNaN(n)) return 0;
  return n < 0 ? 0 : n > 5 ? 5 : n;
}

export function rateEffect(id: string, value: number): void {
  const list = RATINGS.get(id) ?? [];
  list.push(clamp05(value));
  RATINGS.set(id, list);
}

export function getRating(id: string): number {
  const list = RATINGS.get(id);
  if (!list || list.length === 0) return 0;
  let sum = 0;
  for (const v of list) sum += v;
  return sum / list.length;
}

export function getRatingCount(id: string): number {
  return RATINGS.get(id)?.length ?? 0;
}

export function clearRatings(): void {
  RATINGS.clear();
}
