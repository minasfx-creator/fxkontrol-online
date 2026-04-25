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
import { generateFireOneScript, downloadFireOneScript } from './FireOneExporter';
import { generateArtNetPatchCSV, downloadArtNetPatch } from './ArtNetPatchExporter';
import { generateDroneCSV, downloadDroneCSV } from './DroneCSVExporter';
import { generateMegafireScript, downloadMegafireScript } from './MegafireExporter';
import { generateRJEquipamentosScript, downloadRJEquipamentosScript } from './RJEquipamentosExporter';
import { generateGalaxisGS2Script, downloadGalaxisGS2Script } from './GalaxisGS2Exporter';

export type ExportTarget = 'fireone' | 'artnet' | 'drone' | 'megafire' | 'rj-traditional' | 'rj-timecode' | 'galaxis-gs2';

export interface ExportAttemptResult {
  target: ExportTarget;
  success: boolean;
  timestamp: number;
  issues: string[];
  cueCount: number;
}

class ExportCoordinator {
  private _history: ExportAttemptResult[] = [];

  /** Attempt an export through the full pipeline */
  execute(target: ExportTarget): ExportAttemptResult {
    const timestamp = Date.now();

    // 1. Check operational mode allows export
    const modeCheck = operationalModeGuard.check('export');
    if (!modeCheck.allowed) {
      const result: ExportAttemptResult = {
        target, success: false, timestamp,
        issues: [`Mode guard blocked: ${modeCheck.reason}`], cueCount: 0,
      };
      this._log(result);
      return result;
    }

    // 2. Run verification and log it
    const vResult = verificationEngine.run();
    verificationLog.record(vResult);

    // 3. Check readiness
    const readiness = readinessEvaluator.evaluate();
    if (!readiness.allowed_operations.includes('export')) {
      const result: ExportAttemptResult = {
        target, success: false, timestamp,
        issues: [`Readiness blocked (${readiness.status}): ${readiness.issues.map(i => i.message).join('; ')}`],
        cueCount: 0,
      };
      this._log(result);
      return result;
    }

    // 4. Execute target exporter
    try {
      switch (target) {
        case 'fireone': {
          const r = generateFireOneScript();
          if (!r.verified || r.errors.length > 0) {
            const result: ExportAttemptResult = { target, success: false, timestamp, issues: r.errors, cueCount: r.cueCount };
            this._log(result);
            return result;
          }
          downloadFireOneScript();
          const result: ExportAttemptResult = { target, success: true, timestamp, issues: [], cueCount: r.cueCount };
          this._log(result);
          return result;
        }
        case 'artnet': {
          const r = generateArtNetPatchCSV();
          if (!r.verified || r.errors.length > 0) {
            const result: ExportAttemptResult = { target, success: false, timestamp, issues: r.errors, cueCount: r.cueCount };
            this._log(result);
            return result;
          }
          downloadArtNetPatch();
          const result: ExportAttemptResult = { target, success: true, timestamp, issues: [], cueCount: r.cueCount };
          this._log(result);
          return result;
        }
        case 'drone': {
          const r = generateDroneCSV();
          if (!r.verified || r.errors.length > 0) {
            const result: ExportAttemptResult = { target, success: false, timestamp, issues: r.errors, cueCount: r.droneCount };
            this._log(result);
            return result;
          }
          downloadDroneCSV();
          const result: ExportAttemptResult = { target, success: true, timestamp, issues: [], cueCount: r.droneCount };
          this._log(result);
          return result;
        }
        case 'megafire': {
          const r = generateMegafireScript();
          if (!r.verified || r.errors.length > 0) {
            const result: ExportAttemptResult = { target, success: false, timestamp, issues: r.errors, cueCount: r.cueCount };
            this._log(result);
            return result;
          }
          downloadMegafireScript();
          const result: ExportAttemptResult = { target, success: true, timestamp, issues: [], cueCount: r.cueCount };
          this._log(result);
          return result;
        }
        case 'rj-traditional':
        case 'rj-timecode': {
          const variant = target === 'rj-traditional' ? 'traditional' : 'timecode';
          const r = generateRJEquipamentosScript(variant);
          if (!r.verified || r.errors.length > 0) {
            const result: ExportAttemptResult = { target, success: false, timestamp, issues: r.errors, cueCount: r.cueCount };
            this._log(result);
            return result;
          }
          downloadRJEquipamentosScript(variant);
          const result: ExportAttemptResult = { target, success: true, timestamp, issues: [], cueCount: r.cueCount };
          this._log(result);
          return result;
        }
      }
    } catch (err) {
      const result: ExportAttemptResult = {
        target, success: false, timestamp,
        issues: [`Export error: ${err instanceof Error ? err.message : String(err)}`], cueCount: 0,
      };
      this._log(result);
      return result;
    }
  }

  getHistory(): ExportAttemptResult[] { return [...this._history]; }
  getLastAttempt(target: ExportTarget): ExportAttemptResult | null {
    return [...this._history].reverse().find(a => a.target === target) ?? null;
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
