/**
 * libraryFilters — pure search/filter helpers for the user asset library.
 * Zero React dependency; consumed by useMyLibrary + LibrarySearchBar.
 */

import type { LibraryAssetCategory } from './libraryDragDrop';
import { categorizeByFormat } from './libraryDragDrop';

export interface FilterableAsset {
  id: string;
  name: string;
  file_format: string;
  tags?: string[] | null;
  /** Optional — may not exist on older rows until migration runs. */
  category?: LibraryAssetCategory | string | null;
  description?: string | null;
}

export interface LibraryFilter {
  query?: string;
  tags?: string[];
  category?: LibraryAssetCategory | 'all';
}

/** Returns the effective category, falling back to extension-derived. */
export function effectiveCategory(a: FilterableAsset): LibraryAssetCategory {
  if (a.category && a.category !== 'other') return a.category as LibraryAssetCategory;
  return categorizeByFormat(a.file_format);
}

export function filterAssets<T extends FilterableAsset>(assets: T[], filter: LibraryFilter): T[] {
  const q = (filter.query || '').trim().toLowerCase();
  const wantTags = (filter.tags || []).map((t) => t.toLowerCase());
  const cat = filter.category ?? 'all';

  return assets.filter((a) => {
    if (cat !== 'all' && effectiveCategory(a) !== cat) return false;

    if (wantTags.length > 0) {
      const have = new Set((a.tags || []).map((t) => String(t).toLowerCase()));
      for (const t of wantTags) if (!have.has(t)) return false;
    }

    if (q) {
      const hay = [
        a.name,
        a.description ?? '',
        a.file_format ?? '',
        ...(a.tags || []),
      ].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

/** Distinct tags across the library, sorted by frequency desc then alpha. */
export function collectTags(assets: FilterableAsset[]): { tag: string; count: number }[] {
  const map = new Map<string, number>();
  for (const a of assets) {
    for (const t of a.tags || []) {
      const k = String(t).trim();
      if (!k) continue;
      map.set(k, (map.get(k) ?? 0) + 1);
    }
  }
  return Array.from(map.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => (b.count - a.count) || a.tag.localeCompare(b.tag));
}

/** Counts per category for the tabs. */
export function countByCategory(assets: FilterableAsset[]): Record<LibraryAssetCategory | 'all', number> {
  const out: Record<string, number> = { all: assets.length, prop: 0, texture: 0, particle: 0, model3d: 0, audio: 0, other: 0 };
  for (const a of assets) out[effectiveCategory(a)] = (out[effectiveCategory(a)] || 0) + 1;
  return out as Record<LibraryAssetCategory | 'all', number>;
}
