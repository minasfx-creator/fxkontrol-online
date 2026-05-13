/**
 * effectFingerprint — deterministic, idempotent dedupe key for Effect entries.
 *
 * Buckets used:
 *   partType | caliber(in, integer) | vdlBucket | duration(0.5s) | height(5m)
 *
 * The colour bucket is anchored on the canonical VDL palette name
 * (`@/lib/vdlQuantizer`). This collapses vendor "Red" variants that map to the
 * same VDL entry while keeping truly different palette entries distinct, and
 * stays consistent with `colorResolver` (single source of truth).
 *
 * Output is a short stable string (no crypto needed).
 */

import type { Effect } from '@/data/effectLibrary';
import { resolveEffectColor } from './colorResolver';

function colorBucket(hex: string | undefined): string {
  const r = resolveEffectColor(hex);
  // Lowercase, no spaces — keeps the fingerprint compact.
  return r.vdl.toLowerCase().replace(/\s+/g, '_');
}

function bucket(value: number | undefined, step: number): string {
  if (!Number.isFinite(value as number) || (value as number) <= 0) return '0';
  return Math.round((value as number) / step).toString(36);
}

export function effectFingerprint(e: Effect): string {
  const partType = (e.partType ?? e.type ?? 'unknown').toString();
  const caliber = e.caliber ?? 0;
  const dur = bucket(e.duration, 0.5);
  const ht = bucket(e.heightMeters, 5);
  const col = colorBucket(e.color);
  return `${partType}|${caliber}|${col}|${dur}|${ht}`;
}
