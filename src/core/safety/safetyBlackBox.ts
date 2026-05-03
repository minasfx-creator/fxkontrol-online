/**
 * ─── Unified Safety Black Box (P2) ─────────────────────────────────
 *
 * Single, append-only, hash-chained audit log for every "go/no-go"
 * verdict that gates physical operation. It consumes the P0 trio
 * (showPlanHash, productionSafetyOath, pyroTransportPolicy) and the
 * Phase 2 audit log, and emits ONE structured verdict per request —
 * the same verdict the operator sees on the UI.
 *
 * Why a separate module:
 *   • `realOperationRequest` and the (future) pyro dispatcher each
 *     compute a partial verdict. The black box is the only place that
 *     correlates them, gives them a stable id, and chains them by
 *     hash so tampering with any prior entry breaks the chain.
 *   • `blackBoxRecorder` records *operational* telemetry at 10Hz
 *     during a show (commands, errors, drone events). This module is
 *     orthogonal: it records a small number of *gate decisions* with
 *     cryptographic continuity.
 *
 * Pure module — no React, no singletons created at module load
 * besides the recorder instance itself; storage is best-effort
 * localStorage with an in-memory fallback so unit tests don't need
 * jsdom shims.
 *
 * Hash chain: `entryHash = sha256(prevHash || canonicalJSON(payload))`
 * where the very first entry uses prevHash = "GENESIS". Verifying the
 * chain only requires the recorder's `verifyChain()` helper.
 */

import { hashCanonical, isCryptographicHash } from '@/core/showplan/showPlanHash';
import {
  requestRealOperation,
  type RealOperationRequestOpts,
  type RealOperationRequestResult,
} from './realOperationRequest';
import {
  verdictForPyroFire,
  type PyroDispatchVerdict,
} from '@/core/transport/pyroTransportPolicy';
import type { DiscoveryTransport } from '@/core/discovery/types';
import type { WorkMode } from './workMode';

// ─── Types ─────────────────────────────────────────────────────────

export type SafetyBlackBoxEventKind =
  | 'real_operation_request'
  | 'pyro_dispatch_verdict'
  | 'phase2_grant_link'
  | 'note';

export interface SafetyBlackBoxEntry {
  /** Monotonic 1-based index in the chain. */
  seq: number;
  /** Stable id (timestamp-derived; not security-critical). */
  id: string;
  /** ISO timestamp at record time. */
  at: string;
  /** Event class. */
  kind: SafetyBlackBoxEventKind;
  /** Final verdict — true means the gate authorised the action. */
  ok: boolean;
  /** Short machine-readable refusal reason; absent on `ok=true`. */
  reason?: string;
  /** Free-form payload (already canonicalised JSON-safely by caller). */
  payload: Readonly<Record<string, unknown>>;
  /** Hash of the previous entry, or 'GENESIS' for seq=1. */
  prevHash: string;
  /** sha256(prevHash || canonical(payloadEnvelope)) — the chain link. */
  entryHash: string;
}

const STORAGE_KEY = 'fxk.safety.blackbox.v1';
const CAP = 500;
const GENESIS = 'GENESIS';

// ─── Canonical JSON (deterministic stringify) ──────────────────────

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}

function safeStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

// ─── Recorder ──────────────────────────────────────────────────────

class SafetyBlackBox {
  private _entries: SafetyBlackBoxEntry[] = [];
  private _hydrated = false;

  private _hydrate(): void {
    if (this._hydrated) return;
    this._hydrated = true;
    const s = safeStorage();
    if (!s) return;
    try {
      const raw = s.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        this._entries = parsed.filter(
          (e): e is SafetyBlackBoxEntry =>
            !!e && typeof e === 'object' && typeof (e as SafetyBlackBoxEntry).entryHash === 'string',
        );
      }
    } catch {
      /* corrupted log → start fresh */
    }
  }

  private _persist(): void {
    const s = safeStorage();
    if (!s) return;
    try {
      const trimmed = this._entries.slice(-CAP);
      this._entries = trimmed;
      s.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      /* best-effort */
    }
  }

  /** Append a new entry, chained by hash to the previous one. */
  async record(
    kind: SafetyBlackBoxEventKind,
    ok: boolean,
    payload: Record<string, unknown>,
    reason?: string,
  ): Promise<SafetyBlackBoxEntry> {
    this._hydrate();
    const prev = this._entries[this._entries.length - 1];
    const prevHash = prev ? prev.entryHash : GENESIS;
    const seq = (prev?.seq ?? 0) + 1;
    const at = new Date().toISOString();
    const id = `sbb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const envelope = { seq, at, kind, ok, reason, payload, prevHash };
    const entryHash = await hashCanonical(prevHash + '|' + stableStringify(envelope));

    const entry: SafetyBlackBoxEntry = { ...envelope, payload, entryHash };
    this._entries.push(entry);
    this._persist();
    return entry;
  }

  getAll(): SafetyBlackBoxEntry[] { this._hydrate(); return [...this._entries]; }

  getRecent(n: number = 50): SafetyBlackBoxEntry[] {
    return this.getAll().slice(-n);
  }

  /** Verify that every entry's prevHash matches the previous entry's entryHash. */
  async verifyChain(): Promise<{ ok: boolean; brokenAt?: number }> {
    this._hydrate();
    let prevHash = GENESIS;
    for (let i = 0; i < this._entries.length; i++) {
      const e = this._entries[i];
      if (e.prevHash !== prevHash) return { ok: false, brokenAt: i };
      const envelope = {
        seq: e.seq, at: e.at, kind: e.kind, ok: e.ok,
        reason: e.reason, payload: e.payload, prevHash: e.prevHash,
      };
      const expected = await hashCanonical(prevHash + '|' + stableStringify(envelope));
      if (expected !== e.entryHash) return { ok: false, brokenAt: i };
      prevHash = e.entryHash;
    }
    return { ok: true };
  }

  reset(): void {
    this._entries = [];
    this._hydrated = true;
    const s = safeStorage();
    if (s) try { s.removeItem(STORAGE_KEY); } catch { /* noop */ }
  }
}

export const safetyBlackBox = new SafetyBlackBox();

// ─── Unified verdicts (the public surface) ─────────────────────────

export interface RealOperationVerdict extends RealOperationRequestResult {
  /** The black-box entry that recorded this verdict. */
  entry: SafetyBlackBoxEntry;
}

/**
 * Run `requestRealOperation` AND record the structured verdict to the
 * black box in one shot. UI call sites should use THIS instead of the
 * raw `requestRealOperation` so every attempt — granted OR refused —
 * is captured in the chained audit trail.
 */
export async function evaluateRealOperationVerdict(
  opts: RealOperationRequestOpts = {},
): Promise<RealOperationVerdict> {
  const result = requestRealOperation(opts);
  const cryptoOk = opts.currentPlanHash ? isCryptographicHash(opts.currentPlanHash) : undefined;
  const entry = await safetyBlackBox.record(
    'real_operation_request',
    result.ok,
    {
      grantId: result.grant?.id,
      grantSeed: result.grant?.seedId,
      grantAgeMs: result.grantAgeMs,
      oathReason: result.oathReason,
      expectedPlanHash: result.expectedPlanHash,
      actualPlanHash: result.actualPlanHash ?? opts.currentPlanHash,
      planHashIsCryptographic: cryptoOk,
    },
    result.reason,
  );
  return { ...result, entry };
}

export interface PyroDispatchInputs {
  available: readonly DiscoveryTransport[];
  mode: WorkMode;
  /** Optional hash of the plan being dispatched — recorded for trail correlation. */
  planHash?: string;
  /** Optional cue id for trail correlation. */
  cueId?: string;
}

export interface PyroDispatchAuditedVerdict extends PyroDispatchVerdict {
  entry: SafetyBlackBoxEntry;
}

/**
 * Compute the pyro dispatch verdict via `verdictForPyroFire` AND
 * record it. The contractual ban (BLE for pyro in real_operation) is
 * captured here so the black box reflects EXACTLY what the dispatcher
 * decided — no shadow logic.
 */
export async function evaluatePyroDispatchVerdict(
  inputs: PyroDispatchInputs,
): Promise<PyroDispatchAuditedVerdict> {
  const v = verdictForPyroFire(inputs.available, inputs.mode);
  const entry = await safetyBlackBox.record(
    'pyro_dispatch_verdict',
    v.ok,
    {
      mode: inputs.mode,
      cueId: inputs.cueId,
      planHash: inputs.planHash,
      planHashIsCryptographic: inputs.planHash ? isCryptographicHash(inputs.planHash) : undefined,
      available: [...inputs.available],
      allowed: v.selection.allowed,
      banned: v.selection.banned,
    },
    v.reason,
  );
  return { ...v, entry };
}

/** Free-form note (operator annotations, edge cases). */
export async function recordSafetyNote(
  msg: string,
  data?: Record<string, unknown>,
): Promise<SafetyBlackBoxEntry> {
  return safetyBlackBox.record('note', true, { msg, ...(data ?? {}) });
}
