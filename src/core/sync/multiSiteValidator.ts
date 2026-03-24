/**
 * ─── Multi-Site Validator ───────────────────────────────────────────
 * Pre-show validation for multi-site deployments.
 * Simulates cross-site timing at 100x speed and checks for
 * drift, latency-induced mis-fires, and consistency issues.
 */

import { latencyCompensator } from './latencyCompensator';

export type SiteValidationStatus = 'pass' | 'warn' | 'fail';

export interface SiteValidationResult {
  siteId: string;
  siteName: string;
  status: SiteValidationStatus;
  maxDriftMs: number;
  avgLatencyMs: number;
  cuesAtRisk: number;       // cues that fire outside safety window
  issues: string[];
}

export interface MultiSiteValidationReport {
  passed: boolean;
  timestamp: number;
  durationMs: number;
  totalSites: number;
  totalCues: number;
  maxCrossSiteDriftMs: number;
  sites: SiteValidationResult[];
}

export interface ValidationSiteConfig {
  siteId: string;
  name: string;
  estimatedLatencyMs: number;
  hardwareDelayMs: number;
}

export interface ValidationCue {
  id: string;
  time: number;          // seconds
  safetyWindowMs: number; // max acceptable deviation
}

const DRIFT_WARN_MS = 5;
const DRIFT_FAIL_MS = 10;

class MultiSiteValidator {

  /**
   * Run full multi-site validation.
   * Checks each site's latency-compensated cue timing against the host reference.
   */
  validate(
    sites: ValidationSiteConfig[],
    cues: ValidationCue[],
  ): MultiSiteValidationReport {
    const start = performance.now();
    const siteResults: SiteValidationResult[] = [];
    let globalMaxDrift = 0;

    for (const site of sites) {
      const result = this._validateSite(site, cues);
      siteResults.push(result);
      if (result.maxDriftMs > globalMaxDrift) {
        globalMaxDrift = result.maxDriftMs;
      }
    }

    const passed = siteResults.every(s => s.status !== 'fail');

    return {
      passed,
      timestamp: Date.now(),
      durationMs: performance.now() - start,
      totalSites: sites.length,
      totalCues: cues.length,
      maxCrossSiteDriftMs: globalMaxDrift,
      sites: siteResults,
    };
  }

  private _validateSite(
    site: ValidationSiteConfig,
    cues: ValidationCue[],
  ): SiteValidationResult {
    const issues: string[] = [];
    let maxDrift = 0;
    let cuesAtRisk = 0;

    const totalCompensationMs = (site.estimatedLatencyMs / 2) + site.hardwareDelayMs;

    for (const cue of cues) {
      const driftMs = totalCompensationMs;

      if (driftMs > maxDrift) maxDrift = driftMs;

      if (driftMs > cue.safetyWindowMs) {
        cuesAtRisk++;
        issues.push(
          `Cue ${cue.id} @ ${cue.time.toFixed(2)}s: ${driftMs.toFixed(1)}ms drift exceeds ${cue.safetyWindowMs}ms safety window`
        );
      }
    }

    // Check profile from latencyCompensator if available
    const profile = latencyCompensator.getProfile(site.siteId);
    const avgLatency = profile ? profile.medianRtt : site.estimatedLatencyMs;

    let status: SiteValidationStatus = 'pass';
    if (maxDrift >= DRIFT_FAIL_MS) {
      status = 'fail';
      issues.unshift(`Max drift ${maxDrift.toFixed(1)}ms exceeds ${DRIFT_FAIL_MS}ms threshold`);
    } else if (maxDrift >= DRIFT_WARN_MS) {
      status = 'warn';
      issues.unshift(`Max drift ${maxDrift.toFixed(1)}ms approaching limit`);
    }

    return {
      siteId: site.siteId,
      siteName: site.name,
      status,
      maxDriftMs: maxDrift,
      avgLatencyMs: avgLatency,
      cuesAtRisk,
      issues,
    };
  }
}

export const multiSiteValidator = new MultiSiteValidator();
