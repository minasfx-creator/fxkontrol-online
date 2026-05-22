/**
 * Tail Component Catalog — lookup over the 159 .fwc tail/insert components.
 *
 * Source: `public/finale-presets/standard-effects/Effect Components/**` extracted
 * by `scripts/parse-fwc-components.py` → `generated/tailComponents.json`.
 *
 * The renderer consumes this when an Effect declares a `tailRef` (e.g.
 * `[Brocade Tail Medium]`). Honest: real XML facts only.
 */
import bundle from './effectsLibraries/generated/tailComponents.json';
import type { FwcTailKind, FwcTailLength, FwcTailSize } from '@/lib/fwcTailParser';

export interface TailComponentPart {
  id: string;
  fileName: string;
  collection: string;
  displayName: string;
  kind: FwcTailKind;
  color: string[];
  density: number | null;
  width: number | null;
  life: number | null;
  length: FwcTailLength | null;
  size: FwcTailSize | null;
  strobe: boolean;
  strobeFreqHz: number | null;
  deprecated: boolean;
}

interface Bundle {
  version: number;
  generatedAt: string;
  total: number;
  byKind: Record<string, number>;
  parts: TailComponentPart[];
}

const BUNDLE = bundle as unknown as Bundle;

let _byNorm: Map<string, TailComponentPart> | null = null;
let _byKind: Map<FwcTailKind, TailComponentPart[]> | null = null;

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function buildIndexes() {
  _byNorm = new Map();
  _byKind = new Map();
  for (const p of BUNDLE.parts) {
    if (p.deprecated) continue;
    const n = norm(p.displayName);
    if (!_byNorm.has(n)) _byNorm.set(n, p);
    const list = _byKind.get(p.kind) ?? [];
    list.push(p);
    _byKind.set(p.kind, list);
  }
}

function ensure() {
  if (!_byNorm) buildIndexes();
}

/** Get all tail components. */
export function getAllTailComponents(): TailComponentPart[] {
  return BUNDLE.parts;
}

/** Lookup by exact normalized display name, e.g. "Brocade Tail Medium". */
export function findTailComponent(ref: string): TailComponentPart | null {
  if (!ref || ref.toLowerCase() === 'none') return null;
  ensure();
  // Strip trailing density qualifier like ", Dense"
  const cleaned = ref.replace(/,\s*(dense|sparse|thin|thick)\s*$/i, '').trim();
  const n = norm(cleaned);
  const exact = _byNorm!.get(n);
  if (exact) return exact;
  // Fuzzy: try to find any tail whose normalized name is a substring/prefix.
  for (const [k, v] of _byNorm!) {
    if (k.startsWith(n) || n.startsWith(k)) return v;
  }
  // Fall back to kind heuristic from the ref text itself.
  return resolveTailRefByKind(ref);
}

function resolveTailRefByKind(ref: string): TailComponentPart | null {
  ensure();
  const s = ref.toLowerCase();
  const kindMap: Array<[RegExp, FwcTailKind]> = [
    [/criss[- ]cross/, 'crissCross'],
    [/glitter/, 'glitter'],
    [/crackling/, 'crackling'],
    [/spider/, 'spider'],
    [/brocade/, 'brocade'],
    [/silver/, 'silver'],
    [/gold/, 'gold'],
  ];
  for (const [re, k] of kindMap) {
    if (re.test(s)) {
      const list = _byKind!.get(k);
      if (list && list.length) return list[0];
    }
  }
  return null;
}

/** Get all tails of a given kind (non-deprecated). */
export function getTailsByKind(kind: FwcTailKind): TailComponentPart[] {
  ensure();
  return _byKind!.get(kind) ?? [];
}

export const TAIL_COMPONENTS_META = {
  version: BUNDLE.version,
  generatedAt: BUNDLE.generatedAt,
  total: BUNDLE.total,
  byKind: BUNDLE.byKind,
} as const;
