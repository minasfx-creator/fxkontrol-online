/**
 * Cake Generator (blueprint v2)
 * ────────────────────────────────────────────────────────────
 * Multi-row parametric cake generator. Produces N TimelineItems around a
 * single anchor pyro position, with per-row stagger, multiple sweep modes
 * and optional caliber/effect rotation.
 *
 *   anchor ──┐
 *            ├── row 0  ▔▔▔▔▔ shots fanned across spreadDeg
 *            ├── row 1  ▔▔▔▔▔  (offset by rowGapMs, may flip on ping-pong)
 *            └── row k
 *
 * Pure function — no IO, no store mutation. The plugin/toolbar caller is
 * responsible for pushing items to ShowPlan and recording the audit op.
 *
 * Per project safety policy: in design/simulation we NEVER block creation,
 * we only annotate `warnings` (e.g. stagger < FireOne minimum 50 ms).
 */

import type { TimelineItem } from '@/types/projectTypes';

/** FireOne / industry-safe minimum inter-shot stagger on a single chain. */
export const FIREONE_MIN_STAGGER_MS = 50;

export type SweepMode = 'linear' | 'pingpong' | 'inout';

export interface CakeParams {
  anchorPositionId: string;
  anchor: { x: number; y: number; z: number };
  /** Primary effect id; rotates through `effectRotation` if provided. */
  effectId: string;
  /** Optional cycling library — round-robin across shots. */
  effectRotation?: string[];
  shots: number;        // 1..200 per row
  staggerMs: number;    // intra-row stagger
  spreadDeg: number;    // total fan opening, 0..180
  startTime: number;    // seconds
  /** Vertical mortar tilt offset (deg). */
  tilt?: number;
  /** Aim direction (deg, around the fan center). */
  bearingDeg?: number;
  caliber?: number;
  trackIndex?: number;

  // ── multi-row extensions (back-compatible: defaults = single row) ──
  rows?: number;          // 1..16 (default 1)
  rowGapMs?: number;      // delay between row 0 first shot and row N first shot
  sweep?: SweepMode;      // default 'linear'
}

export interface CakeReport {
  shotsTotal: number;
  rows: number;
  durationSec: number;
  effectiveStaggerMs: number;
  /** Worst-case (smallest) inter-shot delta inside any row. */
  minStaggerMs: number;
  warnings: string[];
}

export interface CakeGeneratorResult {
  items: TimelineItem[];
  report: CakeReport;
}

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function pickEffect(params: CakeParams, idx: number): string {
  const rot = params.effectRotation;
  if (!rot || rot.length === 0) return params.effectId;
  return rot[idx % rot.length];
}

/** Apply sweep to a normalized t∈[0..1] index inside one row. */
function sweepIndex(t: number, mode: SweepMode): number {
  switch (mode) {
    case 'pingpong': {
      // 0 → 1 → 0 → 1 won't help much; for cake we use 0..1..0
      const u = t * 2;
      return u <= 1 ? u : 2 - u;
    }
    case 'inout': {
      // ease-in-out — slower at edges, faster at center
      return t < 0.5
        ? 2 * t * t
        : 1 - Math.pow(-2 * t + 2, 2) / 2;
    }
    case 'linear':
    default:
      return t;
  }
}

/**
 * Detailed generator — preferred entry point for new code.
 * Returns timeline items + a CakeReport with warnings (stagger, duration).
 */
export function generateCakeDetailed(params: CakeParams): CakeGeneratorResult {
  const shots = Math.max(1, Math.min(200, Math.floor(params.shots)));
  const rows = Math.max(1, Math.min(16, Math.floor(params.rows ?? 1)));
  const stagger = Math.max(0, params.staggerMs);
  const spread = Math.max(0, Math.min(180, params.spreadDeg));
  const half = spread / 2;
  const sweep: SweepMode = params.sweep ?? 'linear';
  const rowGap = Math.max(0, params.rowGapMs ?? 0);
  const bearing = params.bearingDeg ?? 0;
  const tilt = params.tilt ?? 0;
  const trackIndex = params.trackIndex ?? 0;

  const items: TimelineItem[] = [];
  let globalIdx = 0;

  for (let r = 0; r < rows; r++) {
    // Alternate row direction on ping-pong sweep across rows.
    const rowFlipped = sweep === 'pingpong' && r % 2 === 1;
    const rowStartSec = params.startTime + (r * rowGap) / 1000;

    for (let i = 0; i < shots; i++) {
      const tRaw = shots === 1 ? 0 : i / (shots - 1);
      const tSwept = sweepIndex(rowFlipped ? 1 - tRaw : tRaw, sweep);
      const pan = bearing + (shots === 1 ? 0 : -half + tSwept * spread);

      items.push({
        id: uid('cake'),
        effectId: pickEffect(params, globalIdx),
        startTime: rowStartSec + (i * stagger) / 1000,
        trackIndex: trackIndex + r,
        position: { ...params.anchor },
        positionId: params.anchorPositionId,
        pan,
        tilt,
        spin: 0,
        rack: r + 1,
        tube: i + 1,
      });
      globalIdx++;
    }
  }

  // ── Build report ─────────────────────────────────────────────────────
  const warnings: string[] = [];
  if (stagger > 0 && stagger < FIREONE_MIN_STAGGER_MS) {
    warnings.push(
      `Stagger ${stagger}ms below FireOne safe minimum (${FIREONE_MIN_STAGGER_MS}ms). May misfire on series chains.`,
    );
  }
  if (params.shots > 200) warnings.push(`Shots clamped to 200 (was ${params.shots}).`);
  if ((params.rows ?? 1) > 16) warnings.push(`Rows clamped to 16 (was ${params.rows}).`);
  if (spread > 120) warnings.push(`Spread ${spread}° exceeds typical pyro arc (120°).`);
  if (items.length === 0) warnings.push('No shots generated.');

  const minStart = items.length > 0 ? items[0].startTime : params.startTime;
  const maxStart = items.length > 0 ? items[items.length - 1].startTime : params.startTime;
  const duration = Math.max(0, maxStart - minStart);

  return {
    items,
    report: {
      shotsTotal: items.length,
      rows,
      durationSec: duration,
      effectiveStaggerMs: stagger,
      minStaggerMs: stagger,
      warnings,
    },
  };
}

/** Back-compat thin wrapper — returns only the items (legacy callers). */
export function generateCake(params: CakeParams): TimelineItem[] {
  return generateCakeDetailed(params).items;
}
