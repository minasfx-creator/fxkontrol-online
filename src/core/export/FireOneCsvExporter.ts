/**
 * ─── FireOne UltraFire CSV Exporter ────────────────────────────────
 * Generates the OFFICIAL UltraFire-importable CSV from the canonical
 * ShowPlan.  This is the file that operators load via:
 *   File ▸ Import ▸ CSV File   (UltraFire desktop, FireOne XLII+ / XL4-3)
 *
 * Header (exact, order-sensitive):
 *   Launch Time,Event,Slat,Cue,Length,Description,Comment,Priority,
 *   Position,Quantity,Product Number,Vendor Number
 *
 * Rules (validated against UltraFire .sem MDB inspection + user guide):
 *  • Launch Time    HH:MM:SS.X  (1 decimal)
 *  • Slat           1..40       (cue.module + 1)
 *  • Cue            1..32       (cue.channel + 1)
 *  • Length         clamp 20..1000 ms
 *  • Priority       >= 1        (UltraFire rejects 0)
 *  • Total firings  <= FIREONE_MAX_FIRINGS (4000)
 *
 * Safety:
 *  • verificationEngine.run() is consulted; in design/simulation the
 *    result is **advisory** (simulationGuard.shouldEnforce).
 *  • Every export call is stamped in safetyBlackBox.
 */

import { showPlanManager } from '@/core/showplan/ShowPlanManager';
import { verificationEngine } from '@/core/verification/VerificationEngine';
import { recordSafetyNote } from '@/core/safety/safetyBlackBox';
import { isSimulating } from '@/core/safety/simulationGuard';
import { canonicalizeShowPlan } from '@/core/showplan/showPlanHash';

function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return ('00000000' + h.toString(16)).slice(-8);
}
import {
  FIREONE_MAX_MODULES,
  FIREONE_MIN_FIRE_DURATION,
  FIREONE_MAX_FIRE_DURATION,
  FIREONE_MAX_FIRINGS,
} from '@/lib/fireoneProtocol';

const FIREONE_MAX_CUES_PER_SLAT = 32;
const CSV_HEADER =
  'Launch Time,Event,Slat,Cue,Length,Description,Comment,Priority,Position,Quantity,Product Number,Vendor Number';

export interface FireOneCsvResult {
  csv: string;
  cueCount: number;
  slats: number[];
  errors: string[];          // hard errors (block in real_operation)
  warnings: string[];        // advisory only (clamping etc.)
  verified: boolean;         // verificationEngine.canExport
  blocked: boolean;          // true when errors.length > 0 AND !isSimulating()
  filename: string;
  planHash: string;
}

export function formatLaunchTime(timeSec: number): string {
  const t = Math.max(0, timeSec);
  const totalDeci = Math.round(t * 10);
  const tenth = totalDeci % 10;
  const totalSec = Math.floor(totalDeci / 10);
  const hh = Math.floor(totalSec / 3600);
  const mm = Math.floor((totalSec % 3600) / 60);
  const ss = totalSec % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}.${tenth}`;
}

function csvEscape(v: string | number): string {
  const s = String(v ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function safeFilename(name: string): string {
  return (name || 'fxk_show').replace(/[^\w\-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

export function generateFireOneCsv(): FireOneCsvResult {
  const sp = showPlanManager.current;
  const planHash = `fnv1a:${fnv1a(canonicalizeShowPlan(sp))}`;
  const errors: string[] = [];
  const warnings: string[] = [];

  const v = verificationEngine.run();
  const verified = v.level === 'READY_FOR_EXPORT' || v.level === 'READY_FOR_FIELD';
  if (!verified) {
    const blocking = (v.issues ?? []).filter(c => !c.passed && c.severity === 'error');
    blocking.forEach(c => errors.push(`[VERIFY] ${c.label}: ${c.detail}`));
  }

  const sorted = [...sp.pyroCues].sort((a, b) => a.time - b.time);
  if (sorted.length > FIREONE_MAX_FIRINGS) {
    errors.push(`[LIMIT] ${sorted.length} firings exceed UltraFire max ${FIREONE_MAX_FIRINGS}.`);
  }

  const lines: string[] = [CSV_HEADER];
  const slatSet = new Set<number>();
  const perSlatCount: Record<number, number> = {};

  sorted.forEach((cue, idx) => {
    const slat = (cue.module ?? 0) + 1;
    const cueNum = (cue.channel ?? 0) + 1;
    if (slat < 1 || slat > FIREONE_MAX_MODULES) {
      errors.push(`Cue ${idx + 1}: slat ${slat} out of range 1..${FIREONE_MAX_MODULES}`);
      return;
    }
    if (cueNum < 1 || cueNum > FIREONE_MAX_CUES_PER_SLAT) {
      errors.push(`Cue ${idx + 1}: cue ${cueNum} out of range 1..${FIREONE_MAX_CUES_PER_SLAT}`);
      return;
    }
    perSlatCount[slat] = (perSlatCount[slat] ?? 0) + 1;
    slatSet.add(slat);

    const rawLen = Math.round(cue.fuseDelay || 50);
    const length = Math.min(Math.max(rawLen || 50, FIREONE_MIN_FIRE_DURATION), FIREONE_MAX_FIRE_DURATION);
    if (length !== rawLen) {
      warnings.push(`Cue ${idx + 1}: length clamped ${rawLen}→${length}ms`);
    }
    const priority = 1; // UltraFire rejects 0; we keep a single auto group by default.
    const pos = sp.positions.find(p => p.id === cue.positionId);
    const description = cue.effectId || '';
    const comment = cue.section ?? '';
    const positionName = pos?.name ?? cue.positionId ?? '';
    const quantity = 1;
    const productNumber = `${cue.caliber}mm`;
    const vendorNumber = '';

    lines.push([
      csvEscape(formatLaunchTime(cue.time)),
      csvEscape(1),                      // Event 1 = Auto cue
      csvEscape(slat),
      csvEscape(cueNum),
      csvEscape(length),
      csvEscape(description),
      csvEscape(comment),
      csvEscape(priority),
      csvEscape(positionName),
      csvEscape(quantity),
      csvEscape(productNumber),
      csvEscape(vendorNumber),
    ].join(','));
  });

  Object.entries(perSlatCount).forEach(([slat, n]) => {
    if (n > FIREONE_MAX_CUES_PER_SLAT) {
      errors.push(`Slat ${slat}: ${n} cues exceed ${FIREONE_MAX_CUES_PER_SLAT}.`);
    }
  });

  const blocked = errors.length > 0 && !isSimulating();

  void recordSafetyNote('fireone-csv-export', {
    planHash,
    cueCount: sorted.length,
    slats: [...slatSet].sort((a, b) => a - b),
    errors: errors.length,
    warnings: warnings.length,
    blocked,
    sim: isSimulating(),
  });

  return {
    csv: lines.join('\r\n') + '\r\n',
    cueCount: sorted.length,
    slats: [...slatSet].sort((a, b) => a - b),
    errors,
    warnings,
    verified,
    blocked,
    filename: `${safeFilename(sp.metadata.name)}.csv`,
    planHash,
  };
}

export function downloadFireOneCsv(): FireOneCsvResult {
  const r = generateFireOneCsv();
  const blob = new Blob([r.csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = r.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return r;
}

export const __fireoneCsvInternals = { CSV_HEADER, FIREONE_MAX_CUES_PER_SLAT };
