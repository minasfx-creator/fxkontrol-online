/**
 * ─── inspectShowPlan — BoM + Sequencing + Pinout (pure) ─────────────
 *
 * Lê um ShowPlan canônico e produz três artefatos determinísticos:
 *
 *   1. BillOfMaterials       — lista de SKUs por effectId/calibre, com
 *                              contagem total e tag de seção.
 *   2. SequencingRows        — tabela tempo-ordenada para conferência
 *                              em campo (CSV-friendly).
 *   3. ProposedPinout        — mapping module/channel → posição/efeito,
 *                              ordenado por módulo e canal, pensado
 *                              para FXK16 (16ch) + 74HC595 chain.
 *
 * Pure function — nenhum acesso a stores, hardware ou I/O. Estes
 * artefatos alimentam o PDF técnico e o checklist de campo.
 */

import type { ShowPlan, PyroCue } from '@/core/showplan/ShowPlan';

// ── BoM ──────────────────────────────────────────────────────────────

export interface BoMRow {
  effectId: string;
  caliber: number;        // mm
  count: number;
  sections: string[];     // unique sections this SKU is fired in
  /** Conservative weight estimate (g) per shell — coarse, marketing_hypothesis */
  estimatedUnitWeightG: number;
  estimatedTotalWeightG: number;
}

export interface BillOfMaterials {
  rows: BoMRow[];
  totalCues: number;
  totalUnits: number;
  totalEstimatedWeightG: number;
  /** Highest caliber present (mm) — drives NFPA exclusion zone math */
  maxCaliber: number;
}

/**
 * Coarse weight estimate for finished display shells. Numbers are
 * conservative and meant for transport/storage planning, NOT for
 * regulatory submissions. Tagged `marketing_hypothesis`.
 */
function estimateUnitWeightG(caliber: number): number {
  if (caliber <= 25) return 50;
  if (caliber <= 40) return 120;
  if (caliber <= 50) return 200;
  if (caliber <= 75) return 450;
  if (caliber <= 100) return 900;
  return 1500;
}

export function buildBillOfMaterials(sp: ShowPlan): BillOfMaterials {
  const byKey = new Map<string, BoMRow>();
  for (const c of sp.pyroCues) {
    const key = `${c.effectId}|${c.caliber}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.count += 1;
      if (c.section && !existing.sections.includes(c.section)) {
        existing.sections.push(c.section);
      }
    } else {
      const unit = estimateUnitWeightG(c.caliber);
      byKey.set(key, {
        effectId: c.effectId,
        caliber: c.caliber,
        count: 1,
        sections: c.section ? [c.section] : [],
        estimatedUnitWeightG: unit,
        estimatedTotalWeightG: unit,
      });
    }
  }
  // Recompute totals + sort.
  const rows = Array.from(byKey.values()).map((r) => ({
    ...r,
    estimatedTotalWeightG: r.estimatedUnitWeightG * r.count,
    sections: [...r.sections].sort(),
  }));
  rows.sort((a, b) =>
    b.caliber - a.caliber ||
    a.effectId.localeCompare(b.effectId),
  );
  const maxCaliber = rows.reduce((m, r) => Math.max(m, r.caliber), 0);
  const totalUnits = rows.reduce((s, r) => s + r.count, 0);
  const totalEstimatedWeightG = rows.reduce((s, r) => s + r.estimatedTotalWeightG, 0);
  return {
    rows,
    totalCues: sp.pyroCues.length,
    totalUnits,
    totalEstimatedWeightG,
    maxCaliber,
  };
}

// ── Sequencing ───────────────────────────────────────────────────────

export interface SequencingRow {
  index: number;
  timeS: number;
  timeMs: number;
  module: number;
  channel: number;
  positionId: string;
  effectId: string;
  caliber: number;
  elevation: number;
  section: string;
}

export function buildSequencing(sp: ShowPlan): SequencingRow[] {
  const sorted = [...sp.pyroCues].sort(
    (a, b) => a.time - b.time || a.module - b.module || a.channel - b.channel,
  );
  return sorted.map((c, i) => ({
    index: i + 1,
    timeS: Math.round(c.time * 1000) / 1000,
    timeMs: Math.round(c.time * 1000),
    module: c.module,
    channel: c.channel,
    positionId: c.positionId,
    effectId: c.effectId,
    caliber: c.caliber,
    elevation: c.elevation,
    section: c.section ?? '',
  }));
}

export function sequencingToCsv(rows: SequencingRow[]): string {
  const header = [
    'index', 'time_s', 'time_ms', 'module', 'channel',
    'position_id', 'effect_id', 'caliber_mm', 'elevation_deg', 'section',
  ].join(',');
  const body = rows
    .map((r) =>
      [
        r.index, r.timeS.toFixed(3), r.timeMs, r.module, r.channel,
        r.positionId, r.effectId, r.caliber, r.elevation.toFixed(1),
        r.section,
      ].join(','),
    )
    .join('\n');
  return `${header}\n${body}\n`;
}

// ── Pinout ───────────────────────────────────────────────────────────

export interface PinoutRow {
  module: number;
  moduleLabel: string;
  channel: number;
  positionId: string;
  positionName: string;
  effectId: string;          // last/representative effect
  caliber: number;
  /** Number of cues that reuse this (module,channel) pair across the show */
  fireCount: number;
  /** Smallest gap between firings on this channel (s) — interlock check */
  minGapS: number | null;
}

export function buildPinout(sp: ShowPlan): PinoutRow[] {
  // Group cues by module|channel and compute representative + min gap.
  const byKey = new Map<string, PyroCue[]>();
  for (const c of sp.pyroCues) {
    const k = `${c.module}|${c.channel}`;
    const arr = byKey.get(k) ?? [];
    arr.push(c);
    byKey.set(k, arr);
  }
  const moduleLabel = new Map(
    sp.hardwareConfig.modules.map((m, i) => [i, m.label]),
  );
  const positionById = new Map(sp.positions.map((p) => [p.id, p]));

  const rows: PinoutRow[] = [];
  for (const [k, cues] of byKey.entries()) {
    const sorted = [...cues].sort((a, b) => a.time - b.time);
    let minGap: number | null = null;
    for (let i = 1; i < sorted.length; i++) {
      const gap = sorted[i].time - sorted[i - 1].time;
      if (minGap == null || gap < minGap) minGap = gap;
    }
    const representative = sorted[0];
    const [moduleStr, channelStr] = k.split('|');
    const moduleIdx = Number(moduleStr);
    const pos = positionById.get(representative.positionId);
    rows.push({
      module: moduleIdx,
      moduleLabel: moduleLabel.get(moduleIdx) ?? `module ${moduleIdx}`,
      channel: Number(channelStr),
      positionId: representative.positionId,
      positionName: pos?.name ?? representative.positionId,
      effectId: representative.effectId,
      caliber: representative.caliber,
      fireCount: sorted.length,
      minGapS: minGap == null ? null : Math.round(minGap * 1000) / 1000,
    });
  }
  rows.sort((a, b) => a.module - b.module || a.channel - b.channel);
  return rows;
}

// ── Aggregate inspector ─────────────────────────────────────────────

export interface InspectShowPlanResult {
  bom: BillOfMaterials;
  sequencing: SequencingRow[];
  pinout: PinoutRow[];
  /** Channel-reuse interlock summary — must stay >= 1.0s for safety */
  minChannelReuseS: number | null;
  /** Any (module,channel) reusing under 1.0s — list for warnings */
  tightReuseChannels: { module: number; channel: number; gapS: number }[];
}

export function inspectShowPlan(sp: ShowPlan): InspectShowPlanResult {
  const bom = buildBillOfMaterials(sp);
  const sequencing = buildSequencing(sp);
  const pinout = buildPinout(sp);

  let minReuse: number | null = null;
  const tight: InspectShowPlanResult['tightReuseChannels'] = [];
  for (const p of pinout) {
    if (p.minGapS == null) continue;
    if (minReuse == null || p.minGapS < minReuse) minReuse = p.minGapS;
    if (p.minGapS < 1.0) {
      tight.push({ module: p.module, channel: p.channel, gapS: p.minGapS });
    }
  }
  return {
    bom,
    sequencing,
    pinout,
    minChannelReuseS: minReuse,
    tightReuseChannels: tight,
  };
}
