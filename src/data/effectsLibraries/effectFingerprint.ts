/**
 * effectFingerprint — deterministic, idempotent dedupe key for Effect entries.
 *
 * Buckets used:
 *   partType | caliber(in, integer) | colorBucket | duration(0.5s) | height(5m)
 *
 * The colorBucket is built from the hex color reduced to a coarse RGB lattice
 * (32-step) so that "Red" variants from different vendors collapse to the same
 * key while truly different colors remain distinct. This avoids depending on
 * the (currently absent) `vdlColorPipeline` canonical module while staying
 * forward-compatible — when that pipeline lands, this function is a one-line
 * swap.
 *
 * Output is a short stable string (no crypto needed; 22 ASCII chars).
 */

import type { Effect } from '@/data/effectLibrary';

function colorBucket(hex: string | undefined): string {
  if (!hex) return '------';
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return '------';
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  // 8 levels per channel = 512 buckets; collapses near-duplicates.
  const q = (v: number) => (v >> 5).toString(16);
  return `${q(r)}${q(g)}${q(b)}`;
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
