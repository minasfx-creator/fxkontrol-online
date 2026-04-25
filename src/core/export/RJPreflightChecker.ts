/**
 * ─── RJPreflightChecker ────────────────────────────────────────────
 * Pre-flight de export para RJ Equipamentos. Classifica cada cue do
 * ShowPlan em uma das 4 categorias por variante (Traditional / Timecode):
 *
 *   - exported : cue passa sem alteração
 *   - fallback : cue será exportado, mas com transformação (logada)
 *   - warn     : cue exportado integral, com aviso informativo
 *   - blocked  : cue NÃO será exportado nesta variante
 *
 * Regras (alinhadas 1:1 com RJEquipamentosExporter.ts e Finale 3D spec):
 *
 *  Comuns:
 *    • module < 0          → blocked  (invalid module)
 *    • channel < 0         → blocked  (invalid channel)
 *    • !finite(time) || t<0→ blocked  (invalid time)
 *    • module 1-based ≥100 → fallback (mod 100: 101→1, 201→1, …)
 *
 *  Traditional:
 *    • SFX (F/C/S por section/notes) → blocked (Traditional não suporta)
 *    • duration override em notes    → warn (ABERTURA é ignorada nesta variante)
 *
 *  Timecode (30fps non-drop):
 *    • SFX                             → exported (com ABERTURA)
 *    • |t·30 − round(t·30)| > 0.5/30·k → warn (snap para 1 frame, drift>1ms)
 *      onde k = 0.001 (>=1ms de erro)
 *
 *  Determinação SFX (mesma heurística do exporter):
 *    section/notes ~ flame|fogo|chama → F
 *    section/notes ~ cryo|co2|cryojet → C
 *    section/notes ~ stadium|shotgun  → S
 */

import type { PyroCue, ShowPlan } from '@/core/showplan/ShowPlan';
import { showPlanManager } from '@/core/showplan/ShowPlanManager';

export type RJVariant = 'traditional' | 'timecode';
export type CueDisposition = 'exported' | 'fallback' | 'warn' | 'blocked';

export interface CuePreflightEntry {
  cueIndex: number;          // 0-based no array pyroCues
  positionId: string;
  module1Based: number;      // module + 1 (legível pro operador)
  channel1Based: number;     // channel + 1
  timeMs: number;
  disposition: CueDisposition;
  reasons: string[];         // mensagens humanas (uma ou mais)
  /** Substituições aplicadas quando disposition === 'fallback' */
  fallbacks?: {
    moduleRemapped?: { from: number; to: number };
    timeSnappedMs?: { from: number; to: number };
  };
}

export interface RJPreflightReport {
  variant: RJVariant;
  totalCues: number;
  countByDisposition: Record<CueDisposition, number>;
  entries: CuePreflightEntry[];
  /** Cues efetivamente exportáveis (exported + fallback + warn). */
  exportableCount: number;
  /** True se nenhum cue exportável remanesce — export deve ser abortado. */
  willBeEmpty: boolean;
  /** Resumo human-readable, útil pra logs e UI futura. */
  summary: string;
}

// ────────────────────────────────────────────────────────────────────────
//  Heurísticas (espelham exatamente o exporter)
// ────────────────────────────────────────────────────────────────────────

const RX_FLAME = /(^|\b)(flame|fogo|chama)\b/i;
const RX_CRYO = /(^|\b)(cryo|co2|cryojet)\b/i;
const RX_STADIUM = /(^|\b)(stadium|shotgun|stadium-shot)\b/i;
const RX_DURATION = /dur(?:ation)?\s*[:=]\s*(\d{2,5})\s*ms/i;

function detectSfxType(cue: PyroCue, sectionHint?: string): 'F' | 'C' | 'S' | null {
  const hint = (sectionHint ?? cue.section ?? '');
  if (RX_FLAME.test(hint)) return 'F';
  if (RX_CRYO.test(hint)) return 'C';
  if (RX_STADIUM.test(hint)) return 'S';
  // notes pode também sinalizar SFX
  const notes = cue.notes ?? '';
  if (RX_FLAME.test(notes)) return 'F';
  if (RX_CRYO.test(notes)) return 'C';
  if (RX_STADIUM.test(notes)) return 'S';
  return null;
}

/** Module ≥100 é remapeado mod 100 (sempre 1..100, 0 vira 100). */
function remapModule1Based(module1Based: number): number {
  if (module1Based < 100) return module1Based;
  return (module1Based % 100) || 100;
}

/** Calcula snap de tempo para grid 30fps. Retorna ms snapped + erro absoluto. */
function snap30fps(timeSec: number): { snappedSec: number; errorMs: number } {
  const totalFrames = Math.round(timeSec * 30);
  const snappedSec = totalFrames / 30;
  const errorMs = Math.abs(timeSec - snappedSec) * 1000;
  return { snappedSec, errorMs };
}

// ────────────────────────────────────────────────────────────────────────
//  Engine principal
// ────────────────────────────────────────────────────────────────────────

const EMPTY_COUNTS: Record<CueDisposition, number> = {
  exported: 0, fallback: 0, warn: 0, blocked: 0,
};

export function runRJPreflight(
  variant: RJVariant,
  showPlan: ShowPlan = showPlanManager.current,
): RJPreflightReport {
  const counts: Record<CueDisposition, number> = { ...EMPTY_COUNTS };
  const entries: CuePreflightEntry[] = [];

  for (let i = 0; i < showPlan.pyroCues.length; i++) {
    const cue = showPlan.pyroCues[i];
    const reasons: string[] = [];
    const fallbacks: CuePreflightEntry['fallbacks'] = {};
    let disposition: CueDisposition = 'exported';

    // ── 1. Validações duras (comuns às duas variantes) ──
    if (cue.module < 0) {
      disposition = 'blocked';
      reasons.push(`invalid module ${cue.module}`);
    }
    if (cue.channel < 0) {
      disposition = 'blocked';
      reasons.push(`invalid channel ${cue.channel}`);
    }
    if (!Number.isFinite(cue.time) || cue.time < 0) {
      disposition = 'blocked';
      reasons.push(`invalid time ${cue.time}`);
    }

    if (disposition !== 'blocked') {
      const pos = showPlan.positions.find(p => p.id === cue.positionId);
      const sfx = detectSfxType(cue, pos?.section);

      // ── 2. Variant-specific ──
      if (variant === 'traditional') {
        if (sfx) {
          disposition = 'blocked';
          reasons.push(`SFX channel '${sfx}' não suportado em RJ Traditional — use variant 'timecode'`);
        } else if (RX_DURATION.test(cue.notes ?? '')) {
          disposition = 'warn';
          reasons.push('duration override em notes será ignorado (Traditional não usa ABERTURA)');
        }
      } else {
        // timecode: snap para grid de 30fps
        const snap = snap30fps(cue.time);
        if (snap.errorMs >= 1) {
          // só promovendo a warn se ainda não há disposition mais severa
          if (disposition === 'exported') disposition = 'warn';
          reasons.push(
            `tempo ${cue.time.toFixed(4)}s não está em grid 30fps; será snapped (drift ${snap.errorMs.toFixed(2)}ms)`
          );
          fallbacks.timeSnappedMs = {
            from: Math.round(cue.time * 1000),
            to: Math.round(snap.snappedSec * 1000),
          };
        }
      }

      // ── 3. Module remap (comum) ──
      const module1Based = cue.module + 1;
      if (module1Based >= 100) {
        const to = remapModule1Based(module1Based);
        if (disposition === 'exported' || disposition === 'warn') {
          disposition = 'fallback';
        }
        reasons.push(`module ${module1Based} será remapeado para ${to} (regra mod 100)`);
        fallbacks.moduleRemapped = { from: module1Based, to };
      }
    }

    counts[disposition]++;
    entries.push({
      cueIndex: i,
      positionId: cue.positionId,
      module1Based: cue.module + 1,
      channel1Based: cue.channel + 1,
      timeMs: Number.isFinite(cue.time) ? Math.round(cue.time * 1000) : -1,
      disposition,
      reasons,
      fallbacks: Object.keys(fallbacks).length > 0 ? fallbacks : undefined,
    });
  }

  const exportableCount = counts.exported + counts.fallback + counts.warn;
  const willBeEmpty = exportableCount === 0 && showPlan.pyroCues.length > 0;

  const summary = [
    `RJ ${variant.toUpperCase()} preflight:`,
    `${showPlan.pyroCues.length} cues total →`,
    `${counts.exported} exported,`,
    `${counts.fallback} fallback,`,
    `${counts.warn} warn,`,
    `${counts.blocked} BLOCKED`,
    willBeEmpty ? '· EMPTY EXPORT' : '',
  ].filter(Boolean).join(' ');

  return {
    variant,
    totalCues: showPlan.pyroCues.length,
    countByDisposition: counts,
    entries,
    exportableCount,
    willBeEmpty,
    summary,
  };
}

/** Retorna apenas as entradas com disposition !== 'exported' (útil para UI/logs). */
export function getNonTrivialEntries(report: RJPreflightReport): CuePreflightEntry[] {
  return report.entries.filter(e => e.disposition !== 'exported');
}
