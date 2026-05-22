/**
 * showMetaStore — localStorage helpers for ShowPlanMeta.
 *
 * Stored under `fxk:show:<showId>`. Used by /editor/:showId to hydrate
 * segments / name / duration after a hard reload.
 */
import type { ShowPlanMeta } from './types';

const KEY = (id: string) => `fxk:show:${id}`;
const INDEX_KEY = 'fxk:show:index';

function safeLs(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function saveShowMeta(meta: ShowPlanMeta): void {
  const ls = safeLs();
  if (!ls) return;
  try {
    ls.setItem(KEY(meta.showId), JSON.stringify(meta));
    const idx = loadIndex();
    if (!idx.includes(meta.showId)) {
      idx.unshift(meta.showId);
      ls.setItem(INDEX_KEY, JSON.stringify(idx.slice(0, 100)));
    }
  } catch {
    // Quota or serialization error — non-fatal.
  }
}

export function loadShowMeta(showId: string): ShowPlanMeta | null {
  const ls = safeLs();
  if (!ls) return null;
  try {
    const raw = ls.getItem(KEY(showId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ShowPlanMeta;
    if (!parsed || typeof parsed.showId !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function loadIndex(): string[] {
  const ls = safeLs();
  if (!ls) return [];
  try {
    const raw = ls.getItem(INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function listRecentShows(limit = 20): ShowPlanMeta[] {
  return loadIndex()
    .slice(0, limit)
    .map((id) => loadShowMeta(id))
    .filter((m): m is ShowPlanMeta => m !== null);
}
