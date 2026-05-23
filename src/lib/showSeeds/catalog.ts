/**
 * ─── Golden Show Catalog ────────────────────────────────────────────
 *
 * Central registry of canonical golden seeds used by Phase 1 to
 * validate that the simulation→verification→export pipeline is
 * generic (not coupled to a specific show).
 *
 * To add a new seed:
 *   1. Implement `createXxxShowPlan()` (pure, deterministic).
 *   2. Add an entry below.
 *   3. Add tests mirroring `maracanaHino.test.ts`.
 *
 * Honesty: this module is a pure catalog. It does NOT instantiate
 * ShowPlans at import time — `build()` is lazy.
 */

import type { ShowPlan } from '@/core/showplan/ShowPlan';
import { createLibertadoresShowPlan } from './libertadores';
import { createMaracanaHinoShowPlan } from './maracanaHino';

export interface GoldenShowEntry {
  /** Stable id used in URLs and exports. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** One-line description (what this seed proves). */
  description: string;
  /** Programme duration in seconds. */
  durationS: number;
  /** Number of FXK16 modules used. */
  modules: number;
  /** Lazy builder — same input ⇒ same output. */
  build: () => ShowPlan;
}

export const GOLDEN_SHOW_CATALOG: readonly GoldenShowEntry[] = [
  {
    id: 'libertadores',
    name: 'Libertadores · Final',
    description:
      'Stadium reference. 90s, 32 highs + 32 lows + 8 cometas, 4 × FXK16 (64 ch).',
    durationS: 90,
    modules: 4,
    build: createLibertadoresShowPlan,
  },
  {
    id: 'maracana-hino',
    name: 'Maracanã · Hino Nacional',
    description:
      'Solenidade 60s, 16 highs + 16 lows + 8 closing mines, 2 × FXK16 (32 ch).',
    durationS: 60,
    modules: 2,
    build: createMaracanaHinoShowPlan,
  },
] as const;

export function getGoldenShow(id: string): GoldenShowEntry | undefined {
  return GOLDEN_SHOW_CATALOG.find((s) => s.id === id);
}
