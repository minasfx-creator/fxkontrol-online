/**
 * ─── Verification Types — Shared Contracts ──────────────────────────
 * Canonical types for the verification pipeline.
 * Used by VerificationPass, exporters, and UI consoles.
 */

export type VerificationStatus =
  | 'READY_FOR_SIMULATION'
  | 'READY_FOR_EXPORT'
  | 'READY_FOR_FIELD'
  | 'BLOCKED';

export type IssueSeverity = 'error' | 'warning' | 'info';

export interface VerificationIssue {
  id: string;
  label: string;
  passed: boolean;
  severity: IssueSeverity;
  detail: string;
  category: 'metadata' | 'pyro' | 'dmx' | 'drone' | 'timing' | 'safety' | 'hardware' | 'integrity';
}

export interface VerificationResult {
  level: VerificationStatus;
  issues: VerificationIssue[];
  timestamp: number;
  summary: {
    total: number;
    passed: number;
    errors: number;
    warnings: number;
  };
}

/** Check if a result allows export operations. */
export function canExportFromResult(result: VerificationResult): boolean {
  return result.level === 'READY_FOR_EXPORT' || result.level === 'READY_FOR_FIELD';
}

/** Check if a result allows simulation. */
export function canSimulateFromResult(result: VerificationResult): boolean {
  return result.level !== 'BLOCKED';
}
