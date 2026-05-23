/**
 * Effect Variants — runtime, user-authored copies of EFFECT_LIBRARY entries.
 *
 * EFFECT_LIBRARY is a frozen industrial catalog. Operators frequently want
 * a tweaked version of an existing effect (different caliber, color,
 * prefire, VDL) without touching the canonical library. Variants live here,
 * persist to localStorage, and are merged via `resolveEffect` so the rest
 * of the app sees a unified lookup surface.
 *
 * Lookup precedence: variants first, then library.
 */

import type { Effect } from '@/data/effectLibrary';
import { getEffectById as getLibraryEffect } from '@/data/effectLibraryMap';

const STORAGE_KEY = 'fxk.effect-variants.v1';

type Listener = () => void;

class EffectVariantStore {
  private _variants = new Map<string, Effect>();
  private _listeners = new Set<Listener>();

  constructor() {
    this._load();
  }

  list(): Effect[] {
    return Array.from(this._variants.values());
  }

  get(id: string): Effect | undefined {
    return this._variants.get(id);
  }

  /** Insert or replace a variant. Always persisted. */
  upsert(variant: Effect): void {
    this._variants.set(variant.id, variant);
    this._persist();
    this._emit();
  }

  remove(id: string): boolean {
    const ok = this._variants.delete(id);
    if (ok) {
      this._persist();
      this._emit();
    }
    return ok;
  }

  subscribe(fn: Listener): () => void {
    this._listeners.add(fn);
    return () => {
      this._listeners.delete(fn);
    };
  }

  private _load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const arr = JSON.parse(raw) as Effect[];
      if (Array.isArray(arr)) {
        for (const v of arr) {
          if (v && typeof v.id === 'string') this._variants.set(v.id, v);
        }
      }
    } catch {
      /* corrupted storage — ignore */
    }
  }

  private _persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.list()));
    } catch {
      /* quota / private mode — silent */
    }
  }

  private _emit(): void {
    for (const fn of this._listeners) {
      try {
        fn();
      } catch {
        /* */
      }
    }
  }
}

export const effectVariantStore = new EffectVariantStore();

/**
 * Resolve an effect id against variants first, then the canonical library.
 * Variants ALWAYS win — they were authored by the operator on purpose.
 */
export function resolveEffect(id: string | undefined | null): Effect | undefined {
  if (!id) return undefined;
  return effectVariantStore.get(id) ?? getLibraryEffect(id);
}

/**
 * Build a derived variant id from a base effect. Increments a numeric
 * suffix until unique against both library and existing variants.
 */
export function deriveVariantId(baseId: string): string {
  let n = 1;
  while (true) {
    const candidate = `${baseId}-v${n}`;
    if (!effectVariantStore.get(candidate) && !getLibraryEffect(candidate)) {
      return candidate;
    }
    n++;
    if (n > 9999) {
      // Pathological fallback — should never happen.
      return `${baseId}-v${Date.now().toString(36)}`;
    }
  }
}
