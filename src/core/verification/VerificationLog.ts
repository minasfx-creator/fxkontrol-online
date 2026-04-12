/**
 * ─── Verification Log — Run History ────────────────────────────────
 * Stores history of verification runs for audit and traceability.
 * Queryable by time range. Used by Audit/BlackBox console.
 */

import type { VerificationResult, VerificationStatus } from './types';

export interface VerificationLogEntry {
  id: string;
  timestamp: number;
  level: VerificationStatus;
  totalChecks: number;
  passed: number;
  failed: number;
  errors: number;
  warnings: number;
  issues: string[];
}

class VerificationLog {
  private _entries: VerificationLogEntry[] = [];

  record(result: VerificationResult): VerificationLogEntry {
    const entry: VerificationLogEntry = {
      id: `vlog-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      timestamp: Date.now(),
      level: result.level,
      totalChecks: result.summary.total,
      passed: result.summary.passed,
      failed: result.summary.total - result.summary.passed,
      errors: result.summary.errors,
      warnings: result.summary.warnings,
      issues: result.issues.filter(i => !i.passed).map(i => `[${i.severity}] ${i.label}: ${i.detail}`),
    };
    this._entries.push(entry);
    if (this._entries.length > 500) this._entries = this._entries.slice(-250);
    return entry;
  }

  getAll(): VerificationLogEntry[] { return [...this._entries]; }

  getRecent(count: number = 20): VerificationLogEntry[] {
    return this._entries.slice(-count);
  }

  getByTimeRange(from: number, to: number): VerificationLogEntry[] {
    return this._entries.filter(e => e.timestamp >= from && e.timestamp <= to);
  }

  getLastEntry(): VerificationLogEntry | null {
    return this._entries.length > 0 ? this._entries[this._entries.length - 1] : null;
  }

  clear(): void { this._entries = []; }
}

export const verificationLog = new VerificationLog();
