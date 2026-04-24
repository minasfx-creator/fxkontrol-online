/**
 * ─── Bridge Command Policy (public SDK surface) ────────────────────
 * Single source of truth for command classification + retry/safety
 * policy, exposed at the SDK layer so any caller (UI, HUD, scripting,
 * automation, third-party integrations) reasons about the wire in
 * exactly the same terms as the bridge does internally.
 *
 * Design invariant — DO NOT WEAKEN:
 *   PHYSICAL/DESTRUCTIVE commands (FIRE / BATCH / GPIO / ESTOP) are
 *   NEVER eligible for automatic retry. Re-issuing one is an operator
 *   decision, not a transport-layer decision.
 *
 * The bridge already enforces this internally; this module makes the
 * rule explicit, callable, and testable from the outside so callers
 * can:
 *   - Classify a raw frame before sending (`inferCommandType`)
 *   - Read the policy (`COMMAND_POLICY`) to drive UI affordances
 *     (e.g. hide a "retry" button for FIRE)
 *   - Hard-assert the invariant in app code (`assertSafeRetry`) so
 *     accidental retry plumbing throws loudly in dev/test instead of
 *     silently sending a duplicate FIRE in the field.
 */

import type {
  BridgeCommandType,
  BridgeRetryRule,
} from './fireoneModuleHardwareBridge';
import {
  RETRYABLE_COMMAND_TYPES,
  NON_RETRYABLE_COMMAND_TYPES,
  DEFAULT_RETRY_POLICY,
  isRetryableCommandType,
} from './fireoneModuleHardwareBridge';

export type {
  BridgeCommandType,
  BridgeRetryRule,
} from './fireoneModuleHardwareBridge';
export {
  RETRYABLE_COMMAND_TYPES,
  NON_RETRYABLE_COMMAND_TYPES,
  isRetryableCommandType,
};

/** Risk class — drives UI affordances (warning banners, hold-to-confirm, etc). */
export type BridgeCommandRisk = 'safe' | 'sensitive' | 'destructive';

/** Per-command policy entry. */
export interface BridgeCommandPolicyEntry {
  /** Whether the bridge may auto-retry this command class. */
  retry: boolean;
  /** Risk class — UI uses this to escalate confirmation requirements. */
  risk: BridgeCommandRisk;
  /** Retry rule (only meaningful when `retry === true`). */
  rule?: BridgeRetryRule;
  /** Human-readable description for tooling/inspectors. */
  description: string;
}

/**
 * Authoritative policy table. Changing an entry from `retry: false` to
 * `retry: true` for a destructive class is a SAFETY-CRITICAL change and
 * must be reviewed by the safety lead. The unit tests in
 * `bridgeCommandPolicy.test.ts` will fail if you weaken the invariant.
 */
export const COMMAND_POLICY: Readonly<Record<BridgeCommandType, BridgeCommandPolicyEntry>> = Object.freeze({
  // ── Read-only / lifecycle (safe to auto-retry) ────────────────
  HANDSHAKE: { retry: false, risk: 'safe', description: 'Initial link handshake — single-shot by protocol' },
  HEARTBEAT: { retry: true,  risk: 'safe', rule: { maxRetries: 1, perAttemptTimeoutMs: 1000 }, description: 'Liveness ping' },
  VERSION:   { retry: true,  risk: 'safe', rule: { maxRetries: 1, perAttemptTimeoutMs: 1000 }, description: 'Firmware/protocol version probe' },
  STATUS:    { retry: true,  risk: 'safe', rule: { maxRetries: 2, perAttemptTimeoutMs: 1500 }, description: 'Module status snapshot' },
  CONT:      { retry: true,  risk: 'safe', rule: DEFAULT_RETRY_POLICY.CONT, description: 'Continuity check (read-only)' },
  CDS:       { retry: true,  risk: 'safe', rule: DEFAULT_RETRY_POLICY.CDS,  description: 'Cue/channel diagnostic snapshot' },

  // ── Confirmations (sensitive — no retry, but not destructive) ─
  CONFIRM:   { retry: false, risk: 'sensitive', description: 'Operator confirmation — single intent, never replayed' },

  // ── DESTRUCTIVE — NEVER retry. Invariant guarded by tests. ────
  FIRE:      { retry: false, risk: 'destructive', description: 'Physical ignition — operator decision only' },
  BATCH:     { retry: false, risk: 'destructive', description: 'Batched ignition — operator decision only' },
  GPIO:      { retry: false, risk: 'destructive', description: 'Direct GPIO write — physical side-effect' },
  ESTOP:     { retry: false, risk: 'destructive', description: 'Emergency stop — single-shot, latched at module' },

  // ── Fallback ──────────────────────────────────────────────────
  UNKNOWN:   { retry: false, risk: 'sensitive', description: 'Unrecognised command — refuse to retry by default' },
});

/**
 * Parse a raw outbound frame (string form, e.g. "FIRE:7\n") into its
 * command class. Robust to leading whitespace, terminator newline,
 * upper/lower case, and binary-ish frames (returns 'UNKNOWN' instead
 * of throwing). Pure / side-effect-free.
 */
export function inferCommandType(rawCommand: string | Uint8Array): BridgeCommandType {
  let s: string;
  if (typeof rawCommand === 'string') s = rawCommand;
  else {
    try { s = new TextDecoder('utf-8', { fatal: false }).decode(rawCommand); }
    catch { return 'UNKNOWN'; }
  }
  const head = s.trim().split(/[:\s]/, 1)[0]?.toUpperCase() ?? '';
  if (!head) return 'UNKNOWN';
  // Direct match
  if (head in COMMAND_POLICY) return head as BridgeCommandType;
  // Common aliases observed on the wire
  switch (head) {
    case 'PING': return 'HEARTBEAT';
    case 'HB':   return 'HEARTBEAT';
    case 'VER':  return 'VERSION';
    case 'STAT': return 'STATUS';
    case 'CONTINUITY': return 'CONT';
    case 'EMERGENCY':
    case 'EMERG':
    case 'STOP':
    case 'ABORT':
      return 'ESTOP';
    default: return 'UNKNOWN';
  }
}

/** True iff the command class is allowed to be auto-retried. */
export function isCommandRetryable(t: BridgeCommandType): boolean {
  return COMMAND_POLICY[t].retry === true;
}

/**
 * Hard runtime assertion. Throws synchronously if a caller attempts
 * to retry a non-retryable command. Use this at every retry boundary
 * (queue handlers, scheduler tick, automation scripts) to guarantee
 * the safety invariant is enforced even when the bridge object is
 * bypassed (e.g. mock transports, third-party integrations, tests).
 *
 * Throwing here is *intentional*: a silent no-op would mask the bug
 * exactly when it matters most (a destructive duplicate in the field).
 */
export function assertSafeRetry(t: BridgeCommandType): void {
  if (!isCommandRetryable(t)) {
    throw new Error(
      `[BridgeCommandPolicy] refusing to retry "${t}" (risk=${COMMAND_POLICY[t].risk}). ` +
      `Re-issuing this command is an operator decision, not a transport decision.`,
    );
  }
}

/** Convenience: classify and assert in one call. */
export function assertSafeRetryFromRaw(raw: string | Uint8Array): BridgeCommandType {
  const t = inferCommandType(raw);
  assertSafeRetry(t);
  return t;
}

/** Stable list of every command class — useful for UI iteration / docs. */
export const ALL_COMMAND_TYPES: ReadonlyArray<BridgeCommandType> =
  Object.freeze(Object.keys(COMMAND_POLICY) as BridgeCommandType[]);
