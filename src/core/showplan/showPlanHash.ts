/**
 * ─── ShowPlan Integrity Hash ───────────────────────────────────────
 *
 * Deterministic SHA-256 fingerprint of a ShowPlan's *operational*
 * content. The hash is used to detect drift between:
 *
 *   1. The plan that was validated by Phase 1 / Phase 2.
 *   2. The plan present on disk at the moment a real_operation
 *      transition is requested OR a FIRE command is dispatched.
 *
 * Volatile metadata that does NOT affect what the hardware actually
 * does (`metadata.updatedAt`, `metadata.author`, `metadata.notes`) is
 * intentionally excluded so a re-save of the SAME plan keeps the same
 * hash. EVERY field that influences hardware writes (cues, channels,
 * timing, hardware config, safety constraints) IS included.
 *
 * Pure module — no side effects, no I/O, no React, no singletons.
 * Async only because Web Crypto's digest API is async.
 */

import type { ShowPlan } from './ShowPlan';

/** Operational subset of ShowPlan that participates in the hash. */
export interface CanonicalShowPlan {
  metadata: {
    id: string;
    name: string;
    venue: string;
    gps: ShowPlan['metadata']['gps'];
    duration: number;
    version: number;
    createdAt: number;
  };
  pyroCues: ShowPlan['pyroCues'];
  dmxCues: ShowPlan['dmxCues'];
  dronePaths: ShowPlan['dronePaths'];
  safetyConstraints: ShowPlan['safetyConstraints'];
  hardwareConfig: ShowPlan['hardwareConfig'];
  positions: ShowPlan['positions'];
}

/**
 * Project the ShowPlan onto its canonical operational shape and
 * deeply sort object keys so JSON.stringify is deterministic across
 * runs / browsers.
 */
export function canonicalizeShowPlan(plan: ShowPlan): string {
  const subset: CanonicalShowPlan = {
    metadata: {
      id: plan.metadata.id,
      name: plan.metadata.name,
      venue: plan.metadata.venue,
      gps: plan.metadata.gps,
      duration: plan.metadata.duration,
      version: plan.metadata.version,
      createdAt: plan.metadata.createdAt,
    },
    pyroCues: plan.pyroCues,
    dmxCues: plan.dmxCues,
    dronePaths: plan.dronePaths,
    safetyConstraints: plan.safetyConstraints,
    hardwareConfig: plan.hardwareConfig,
    positions: plan.positions,
  };
  return stableStringify(subset);
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map(stableStringify).join(',') + ']';
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const entries = keys.map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k]));
  return '{' + entries.join(',') + '}';
}

function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

/**
 * SHA-256 fingerprint of the canonical ShowPlan. Same content → same
 * hash, irrespective of property order or non-operational re-saves.
 *
 * Falls back to a simple FNV-1a 32-bit hex when WebCrypto is missing
 * (test runners without `crypto.subtle`). The fallback is prefixed
 * with `fnv1a:` so callers can detect/refuse it in production gates.
 */
export async function hashShowPlan(plan: ShowPlan): Promise<string> {
  const canonical = canonicalizeShowPlan(plan);
  return hashCanonical(canonical);
}

export async function hashCanonical(canonical: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(canonical);
  const subtle =
    typeof crypto !== 'undefined' && (crypto as Crypto).subtle ? crypto.subtle : null;
  if (subtle) {
    const digest = await subtle.digest('SHA-256', data);
    return 'sha256:' + bytesToHex(new Uint8Array(digest));
  }
  // Deterministic fallback (NOT cryptographic). Marked so production
  // code can refuse it.
  let h = 0x811c9dc5;
  for (let i = 0; i < data.length; i++) {
    h ^= data[i];
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return 'fnv1a:' + h.toString(16).padStart(8, '0');
}

/** True iff the hash is a real cryptographic SHA-256. */
export function isCryptographicHash(hash: string): boolean {
  return hash.startsWith('sha256:');
}
