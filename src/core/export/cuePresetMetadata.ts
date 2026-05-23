/**
 * ─── Cue Preset Metadata Adapter ────────────────────────────────────
 * Resolves Mine / Cake-shot canonical Finale presets from a cue's
 * effectId / name / notes.  Used by every export channel
 * (JSON, CSV, .fir, VVIZ, firing CSV) so the same wiring rules
 * (rev9) apply everywhere — single source of truth.
 *
 * Inputs are intentionally loose (anything stringy on the cue is
 * inspected) so the adapter works for both `PyroCue` (ShowPlan) and
 * `TimelineItem` (legacy).
 */

import {
  resolveMinePresetId,
  resolveMinePresetProps,
  resolveCakeShotPresetId,
  resolveCakeShotPresetProps,
  type ResolvedCakeShotProps,
} from '@/data/finalePresets';

export interface CuePresetMetadata {
  /** Canonical Mine preset id (rev6/7), if the cue maps to one. */
  minePresetId?: string;
  /** Canonical Cake-shot preset id (rev8), if the cue maps to one. */
  cakePresetId?: string;
  /** Body / inner color (HEX) — Mine body OR Cake inner. */
  bodyColorHex?: string;
  /** Trail color (HEX), if defined by preset. */
  trailColorHex?: string;
  /** Tail strobe frequency (Hz) — drives MineEffect spray modulation. */
  strobeHz?: number;
  /** For cake-shots only: inner head count + speed (m/s). */
  innerCount?: number;
  innerSpeedMS?: number;
  /** Cake wrappedKind: 'shell' | 'mine'. */
  cakeWrappedKind?: ResolvedCakeShotProps['wrappedKind'];
  /** Family discriminator ('mine'|'cake'|undefined). */
  family?: 'mine' | 'cake';
}

/**
 * Resolve the canonical Mine/Cake preset metadata for any cue-like object.
 * Accepts strings (effectId, name, notes) — first hit wins.
 * Returns an empty object when no preset applies.
 */
export function resolveCuePresetMetadata(
  hints: ReadonlyArray<string | undefined | null>,
): CuePresetMetadata {
  for (const raw of hints) {
    if (!raw) continue;
    const mineId = resolveMinePresetId(raw);
    if (mineId) {
      const p = resolveMinePresetProps(mineId);
      return {
        minePresetId: mineId,
        bodyColorHex: p?.color,
        trailColorHex: p?.trailColor,
        strobeHz: p?.strobeHz ?? 0,
        family: 'mine',
      };
    }
    const cakeId = resolveCakeShotPresetId(raw);
    if (cakeId) {
      const p = resolveCakeShotPresetProps(cakeId);
      return {
        cakePresetId: cakeId,
        bodyColorHex: p?.innerColor,
        trailColorHex: p?.trailColor,
        innerCount: p?.innerCount,
        innerSpeedMS: p?.innerSpeedMS,
        cakeWrappedKind: p?.wrappedKind,
        family: 'cake',
      };
    }
  }
  return {};
}

/** True when the metadata carries any preset wiring. */
export function hasPresetMetadata(m: CuePresetMetadata): boolean {
  return Boolean(m.minePresetId || m.cakePresetId);
}

/** CSV-safe string (escapes commas/quotes/newlines per RFC 4180). */
export function csvCell(v: string | number | undefined | null): string {
  if (v === undefined || v === null) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
