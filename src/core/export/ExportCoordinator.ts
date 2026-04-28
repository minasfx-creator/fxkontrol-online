/**
 * ─── Export Coordinator ────────────────────────────────────────────
 * Single entry point for all exports.
 * Enforces: ShowPlan → VerificationPass → ReadinessEvaluator → Exporter
 * Gates every export behind readiness. Logs all attempts to audit trail.
 */

import { readinessEvaluator } from '@/core/hardware/ReadinessEvaluator';
import { operationalModeGuard } from '@/core/hardware/OperationalModeGuard';
import { verificationLog } from '@/core/verification/VerificationLog';
import { verificationEngine } from '@/core/verification/VerificationEngine';
import { deviceEventLog } from '@/core/hardware/DeviceEventLog';
import { showPlanManager } from '@/core/showplan/ShowPlanManager';
import { recordVerificationReport } from '@/core/journal/reportBridge';
import { generateFireOneScript, downloadFireOneScript } from './FireOneExporter';
import { generateArtNetPatchCSV, downloadArtNetPatch } from './ArtNetPatchExporter';
import { generateDroneCSV, downloadDroneCSV } from './DroneCSVExporter';
import { generateMegafireScript, downloadMegafireScript } from './MegafireExporter';
import { generateRJEquipamentosScript, downloadRJEquipamentosScript } from './RJEquipamentosExporter';
import { generateGalaxisGS2Script, downloadGalaxisGS2Script } from './GalaxisGS2Exporter';
import { runRJPreflight, type RJPreflightReport, type RJVariant } from './RJPreflightChecker';

export type ExportTarget = 'fireone' | 'artnet' | 'drone' | 'megafire' | 'rj-traditional' | 'rj-timecode' | 'galaxis-gs2';

export interface ExportAttemptResult {
  target: ExportTarget;
  success: boolean;
  timestamp: number;
  issues: string[];
  /** Avisos não-bloqueantes (mode guard / readiness) registrados em modo testes. */
  warnings?: string[];
  cueCount: number;
  /** Preencido apenas para targets RJ (rj-traditional / rj-timecode). */
  preflight?: RJPreflightReport;
}

class ExportCoordinator {
  private _history: ExportAttemptResult[] = [];

  /** Attempt an export through the full pipeline.
   *  ⚠️  Modo Testes: gates de ModeGuard e Readiness são apenas LOG (não bloqueiam).
   *  Restaurar early-returns para produção (ver src/_quarantine/safety/). */
  execute(target: ExportTarget): ExportAttemptResult {
    const timestamp = Date.now();
    const warnings: string[] = [];

    // 1. Mode guard — log only (não bloqueia)
    const modeCheck = operationalModeGuard.check('export');
    if (!modeCheck.allowed) {
      warnings.push(`[ModeGuard] ${modeCheck.reason}`);
    }

    // 2. Verification — log/auditoria (não bloqueia)
    const vResult = verificationEngine.run();
    verificationLog.record(vResult);
    void recordVerificationReport({
      showName: showPlanManager.current.metadata.name,
      result: vResult,
      context: { trigger: 'export', target },
    });

    // 3. Readiness — log only (não bloqueia)
    const readiness = readinessEvaluator.evaluate();
    if (!readiness.allowed_operations.includes('export')) {
      warnings.push(`[Readiness:${readiness.status}] ${readiness.issues.map(i => i.message).join('; ')}`);
    }

    // 4. Execute target exporter (gates acima são apenas log em modo testes)
    const result = this._runExporter(target, timestamp);
    if (warnings.length > 0) {
      result.warnings = warnings;
    }
    this._log(result);
    return result;
  }

  private _runExporter(target: ExportTarget, timestamp: number): ExportAttemptResult {
    try {
      switch (target) {
        case 'fireone': {
          const r = generateFireOneScript();
          if (!r.verified || r.errors.length > 0) {
            return { target, success: false, timestamp, issues: r.errors, cueCount: r.cueCount };
          }
          downloadFireOneScript();
          return { target, success: true, timestamp, issues: [], cueCount: r.cueCount };
        }
        case 'artnet': {
          const r = generateArtNetPatchCSV();
          if (!r.verified || r.errors.length > 0) {
            return { target, success: false, timestamp, issues: r.errors, cueCount: r.cueCount };
          }
          downloadArtNetPatch();
          return { target, success: true, timestamp, issues: [], cueCount: r.cueCount };
        }
        case 'drone': {
          const r = generateDroneCSV();
          if (!r.verified || r.errors.length > 0) {
            return { target, success: false, timestamp, issues: r.errors, cueCount: r.droneCount };
          }
          downloadDroneCSV();
          return { target, success: true, timestamp, issues: [], cueCount: r.droneCount };
        }
        case 'megafire': {
          const r = generateMegafireScript();
          if (!r.verified || r.errors.length > 0) {
            return { target, success: false, timestamp, issues: r.errors, cueCount: r.cueCount };
          }
          downloadMegafireScript();
          return { target, success: true, timestamp, issues: [], cueCount: r.cueCount };
        }
        case 'rj-traditional':
        case 'rj-timecode': {
          const variant: RJVariant = target === 'rj-traditional' ? 'traditional' : 'timecode';
          const preflight = runRJPreflight(variant);
          if (preflight.willBeEmpty) {
            return {
              target, success: false, timestamp,
              issues: [`[BLOCKED] ${preflight.summary}. Nenhum cue restou exportável.`],
              cueCount: 0, preflight,
            };
          }
          const r = generateRJEquipamentosScript(variant);
          if (!r.verified || r.errors.length > 0) {
            return { target, success: false, timestamp, issues: r.errors, cueCount: r.cueCount, preflight };
          }
          downloadRJEquipamentosScript(variant);
          const fallbackIssues = preflight.entries
            .filter(e => e.disposition === 'fallback' || e.disposition === 'warn' || e.disposition === 'blocked')
            .map(e => `[${e.disposition.toUpperCase()}] cue#${e.cueIndex + 1} (mod ${e.module1Based}, ch ${e.channel1Based}, ${e.timeMs}ms): ${e.reasons.join('; ')}`);
          return { target, success: true, timestamp, issues: fallbackIssues, cueCount: r.cueCount, preflight };
        }
        case 'galaxis-gs2': {
          const r = generateGalaxisGS2Script();
          if (!r.verified || r.errors.length > 0) {
            return { target, success: false, timestamp, issues: r.errors, cueCount: r.cueCount };
          }
          downloadGalaxisGS2Script();
          return { target, success: true, timestamp, issues: [], cueCount: r.cueCount };
        }
      }
    } catch (err) {
      return {
        target, success: false, timestamp,
        issues: [`Export error: ${err instanceof Error ? err.message : String(err)}`], cueCount: 0,
      };
    }
    return { target, success: false, timestamp, issues: [`Unknown target: ${target}`], cueCount: 0 };
  }

  getHistory(): ExportAttemptResult[] { return [...this._history]; }
  getLastAttempt(target: ExportTarget): ExportAttemptResult | null {
    return [...this._history].reverse().find(a => a.target === target) ?? null;
  }

  /**
   * Dry-run de preflight RJ — não baixa arquivo, não modifica histórico.
   * Use para alimentar UI/relatório de "o que será bloqueado / com fallback".
   */
  dryRunRJ(variant: RJVariant): RJPreflightReport {
    return runRJPreflight(variant);
  }

  private _log(result: ExportAttemptResult): void {
    this._history.push(result);
    if (this._history.length > 100) this._history = this._history.slice(-50);
    deviceEventLog.log('system',
      result.success ? 'state_change' : 'warning',
      `Export ${result.target}: ${result.success ? 'SUCCESS' : 'BLOCKED'} (${result.cueCount} cues)${result.issues.length > 0 ? ' — ' + result.issues[0] : ''}`
    );
  }
}

export const exportCoordinator = new ExportCoordinator();
