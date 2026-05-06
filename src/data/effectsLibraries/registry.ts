/**
 * ─── Effects Library Registry ──────────────────────────────────────
 * Central runtime registry for imported Finale 3D part libraries.
 * Bundles the 5 canonical seed libraries (Showven / Lidu / Magic /
 * Winda / Amazon — 527 parts total) and exposes search + adapt helpers.
 */

import showvenJson from './showven.json';
import liduJson from './lidu.json';
import magicJson from './magic.json';
import windaJson from './winda.json';
import amazonJson from './amazon.json';
import type { FinaleLibrary, FinalePart } from './finalePart';
import type { Effect } from '@/data/effectLibrary';
import { finalePartToEffect } from './adapter';

const RAW_LIBS: FinaleLibrary[] = [
  showvenJson as FinaleLibrary,
  liduJson as FinaleLibrary,
  magicJson as FinaleLibrary,
  windaJson as FinaleLibrary,
  amazonJson as FinaleLibrary,
];

const _byPart = new Map<string, { lib: FinaleLibrary; part: FinalePart }>();
for (const lib of RAW_LIBS) {
  for (const p of lib.parts) _byPart.set(`${lib.slug}:${p.partNumber}`, { lib, part: p });
}

export function listFinaleLibraries(): FinaleLibrary[] {
  return RAW_LIBS;
}

export function getFinaleLibrary(slug: string): FinaleLibrary | undefined {
  return RAW_LIBS.find((l) => l.slug === slug);
}

export function getFinalePart(id: string): FinalePart | undefined {
  return _byPart.get(id)?.part;
}

export interface SearchOpts {
  query?: string;
  manufacturers?: string[];
  partTypes?: string[];
  minCaliberIn?: number;
  maxCaliberIn?: number;
  limit?: number;
}

export function searchFinaleParts(opts: SearchOpts = {}): Array<{ part: FinalePart; lib: FinaleLibrary }> {
  const q = opts.query?.trim().toLowerCase();
  const mfrs = opts.manufacturers?.length ? new Set(opts.manufacturers.map((m) => m.toLowerCase())) : null;
  const types = opts.partTypes?.length ? new Set(opts.partTypes.map((t) => t.toLowerCase())) : null;
  const out: Array<{ part: FinalePart; lib: FinaleLibrary }> = [];
  const limit = opts.limit ?? 1000;

  for (const lib of RAW_LIBS) {
    if (mfrs && !mfrs.has(lib.manufacturer.toLowerCase())) continue;
    for (const part of lib.parts) {
      if (types && !types.has(String(part.partType ?? '').toLowerCase())) continue;
      if (q) {
        const hay = `${part.partNumber} ${part.description ?? ''} ${part.vdl ?? ''} ${part.manufacturer ?? ''}`.toLowerCase();
        if (!hay.includes(q)) continue;
      }
      out.push({ part, lib });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

let _adaptedCache: Effect[] | null = null;
/** Adapt every part in every library into runtime Effects (memoized). */
export function buildImportedEffects(): Effect[] {
  if (_adaptedCache) return _adaptedCache;
  const out: Effect[] = [];
  for (const lib of RAW_LIBS) {
    for (const part of lib.parts) out.push(finalePartToEffect(part, { librarySlug: lib.slug }));
  }
  _adaptedCache = out;
  return out;
}

export interface RegistrySummary {
  totalLibraries: number;
  totalParts: number;
  byManufacturer: Array<{ manufacturer: string; slug: string; count: number }>;
}

export function getRegistrySummary(): RegistrySummary {
  return {
    totalLibraries: RAW_LIBS.length,
    totalParts: RAW_LIBS.reduce((a, l) => a + l.parts.length, 0),
    byManufacturer: RAW_LIBS.map((l) => ({ manufacturer: l.manufacturer, slug: l.slug, count: l.parts.length })),
  };
}
