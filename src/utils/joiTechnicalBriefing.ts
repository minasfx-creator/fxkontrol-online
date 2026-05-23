/**
 * joiTechnicalBriefing — Technical layer enrichment for Joi briefings.
 *
 * Computes:
 *  - BoM (Bill of Materials) per launch point: caliber, count, role.
 *  - ICET sync window: UTC anchor + offset budget per beat.
 *  - Prefire matrix (Finale 3D style): lift time, PFT, delay, measured time.
 *
 * Pure / data-in-data-out. No CommandBus / FieldBus contact.
 * Used by joiDossierExport.briefingStub when no custom briefing is supplied.
 */
import type { VenueShowPreset, LaunchPointGeo, NarrativeBeat } from '@/lib/showVenuePresets';

export interface BoMRow {
  pointId: string;
  pointName: string;
  role: LaunchPointGeo['role'];
  calibreMm: number;
  estShells: number;
  notes: string;
}

export interface IcetWindow {
  utcAnchor: string;       // ISO; T0 of the show in UTC
  preRollSec: number;      // ICET hot-armed countdown window
  totalSec: number;
  beatOffsetsSec: { mood: NarrativeBeat['mood']; tStart: number; tEnd: number }[];
  driftBudgetMs: number;   // allowed clock drift across nodes
}

export interface PrefireRow {
  pointId: string;
  calibreMm: number;
  liftTimeSec: number;    // approximate apex time
  pftSec: number;         // pre-fire time (Finale 3D default lift inferred from caliber)
  delaySec: number;       // operator-defined delay (placeholder 0)
  measuredSec: number;    // delay + lift
}

/** Empirical Finale 3D lift time by inner caliber (mm). Indicative. */
function liftTimeForCaliberMm(mm: number): number {
  // Rough industry curve: 50mm≈3.0s, 75mm≈3.5s, 100mm≈4.0s, 125mm≈4.6s,
  // 150mm≈5.0s, 200mm≈6.0s, 250mm≈6.8s, 300mm≈7.5s.
  if (mm <= 50) return 3.0;
  if (mm <= 75) return 3.5;
  if (mm <= 100) return 4.0;
  if (mm <= 125) return 4.6;
  if (mm <= 150) return 5.0;
  if (mm <= 200) return 6.0;
  if (mm <= 250) return 6.8;
  return 7.5;
}

/** Rough density → shell-count multiplier; tuned for "indicative BoM". */
function estimateShellCount(point: LaunchPointGeo, durationSec: number, totalPoints: number): number {
  const ratePerMin =
    point.role === 'barge' ? 28 :
    point.role === 'rooftop' ? 12 :
    point.role === 'rig' ? 18 :
    point.role === 'ground' ? 14 :
    point.role === 'stage' ? 8 :
    /* drone-pad */ 0;
  const minutes = durationSec / 60;
  const raw = ratePerMin * minutes;
  // Scale down slightly when many similar points share the load.
  const scale = totalPoints > 6 ? 0.85 : 1.0;
  return Math.round(raw * scale);
}

export function buildBoM(preset: VenueShowPreset): BoMRow[] {
  const total = preset.venue.launchPoints.length;
  return preset.venue.launchPoints.map((p): BoMRow => {
    const cal = p.calibreMaxMm ?? 75;
    const shells = estimateShellCount(p, preset.durationSec, total);
    return {
      pointId: p.id,
      pointName: p.name,
      role: p.role,
      calibreMm: cal,
      estShells: shells,
      notes: p.role === 'drone-pad' ? 'drone takeoff/landing only' : `≤ ${cal}mm`,
    };
  });
}

export function buildIcetWindow(preset: VenueShowPreset, utcAnchor?: string): IcetWindow {
  return {
    utcAnchor: utcAnchor ?? new Date().toISOString(),
    preRollSec: 60,
    totalSec: preset.durationSec,
    beatOffsetsSec: preset.narrativeBeats.map((b) => ({ mood: b.mood, tStart: b.tStart, tEnd: b.tEnd })),
    driftBudgetMs: 30, // ICET inter-node sync tolerance
  };
}

export function buildPrefireMatrix(preset: VenueShowPreset): PrefireRow[] {
  return preset.venue.launchPoints
    .filter((p) => p.role !== 'drone-pad')
    .map((p): PrefireRow => {
      const cal = p.calibreMaxMm ?? 75;
      const lift = liftTimeForCaliberMm(cal);
      const pft = Math.max(0.5, lift); // Finale 3D PFT default = lift
      const delay = 0;
      return {
        pointId: p.id,
        calibreMm: cal,
        liftTimeSec: lift,
        pftSec: pft,
        delaySec: delay,
        measuredSec: +(delay + lift).toFixed(2),
      };
    });
}

/** Returns a Markdown block to be appended to the default briefing. */
export function renderTechnicalLayerMarkdown(preset: VenueShowPreset): string {
  const bom = buildBoM(preset);
  const icet = buildIcetWindow(preset);
  const prefire = buildPrefireMatrix(preset);

  const totalShells = bom.reduce((s, r) => s + r.estShells, 0);

  const lines: string[] = [];
  lines.push('## Camada Técnica');
  lines.push('');
  lines.push('### Bill of Materials (BoM) — indicativo');
  lines.push('| Ponto | Função | Calibre máx | Shells (est.) | Notas |');
  lines.push('|:---|:---|---:|---:|:---|');
  for (const r of bom) {
    lines.push(`| ${r.pointName} | ${r.role} | ${r.calibreMm}mm | ${r.estShells} | ${r.notes} |`);
  }
  lines.push(`| **TOTAL** |  |  | **${totalShells}** | claim: marketing_hypothesis |`);
  lines.push('');

  lines.push('### Janela de Sincronização ICET');
  lines.push(`- **T0 (UTC):** ${icet.utcAnchor}`);
  lines.push(`- **Pre-roll hot-armed:** ${icet.preRollSec}s`);
  lines.push(`- **Duração total:** ${icet.totalSec}s`);
  lines.push(`- **Drift budget inter-nó:** ±${icet.driftBudgetMs}ms`);
  lines.push('');
  lines.push('| Beat | t_start | t_end |');
  lines.push('|:---|---:|---:|');
  for (const b of icet.beatOffsetsSec) {
    lines.push(`| ${b.mood} | ${b.tStart}s | ${b.tEnd}s |`);
  }
  lines.push('');

  if (prefire.length > 0) {
    lines.push('### Prefire Matrix (Finale 3D)');
    lines.push('| Ponto | Calibre | Lift | PFT | Delay | Measured |');
    lines.push('|:---|---:|---:|---:|---:|---:|');
    for (const r of prefire) {
      lines.push(
        `| ${r.pointId} | ${r.calibreMm}mm | ${r.liftTimeSec.toFixed(2)}s | ` +
        `${r.pftSec.toFixed(2)}s | ${r.delaySec.toFixed(2)}s | ${r.measuredSec.toFixed(2)}s |`,
      );
    }
    lines.push('');
    lines.push('> Lift estimado pela curva Finale 3D por calibre interno. PFT default = lift. ' +
      'Delay operacional sempre 0 nesta projeção — ajuste por queue no editor antes da operação.');
    lines.push('');
  }

  return lines.join('\n');
}
