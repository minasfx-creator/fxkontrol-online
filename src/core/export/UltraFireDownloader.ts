/**
 * UltraFireDownloader — orchestrate ShowPlan → per-module UltraFire download.
 *
 * Responsibilities:
 *   1. Group `ShowPlan.pyroCues` by module address.
 *   2. Validate channel (1..32), duration (20..1000ms), and per-module
 *      capacity (≤4000 firings, ≤999 events).
 *   3. Compute a deterministic verifyCode for the whole show (CRC16 over
 *      a canonical concatenation of every module's payload bytes).
 *   4. Download per-module: `downloadUltraFire` → `verifyUltraFire` and
 *      retry up to 2× with backoff. NEVER calls `startUltraFire` (that is
 *      reserved for the Show Commander via uiCommandGateway).
 *
 * Pure orchestration: no SafetyStateMachine, no FieldBus, no fire path.
 */

import {
  type UltraFireCueData,
  clampFireDuration,
  FIREONE_MAX_FIRINGS,
  FIREONE_MAX_EVENTS,
  buildDownloadToModule,
} from '@/lib/fireoneProtocol';
import { crc16Ccitt } from '@/lib/twoWireProtocol';
import { showPlanManager } from '@/core/showplan/ShowPlanManager';
import type { PyroCue } from '@/core/showplan/ShowPlan';
import { blackbox } from '@/core/reliability/blackBoxRecorder';

// Re-export because tests import via this module.
export type { UltraFireCueData };

export interface CompiledShow {
  /** addr → cue list */
  byModule: Map<number, UltraFireCueData[]>;
  verifyCode: number;
  totalCues: number;
  errors: string[];
}

export type ModuleDownloadStatus =
  | 'idle' | 'sending' | 'verifying' | 'ok' | 'fail' | 'aborted';

export interface ModuleDownloadProgress {
  addr: number;
  status: ModuleDownloadStatus;
  attempts: number;
  cueCount: number;
  bytes: number;
  error?: string;
}

export interface DownloadAllOptions {
  onProgress?: (p: ModuleDownloadProgress) => void;
  signal?: AbortSignal;
  /** Mocked transport for tests; injects a `send`/`waitStatus` pair. */
  transport: UltraFireTransportLike;
  /** ShowPlan hash for audit (not required for op). */
  planHash?: string;
}

export interface UltraFireTransportLike {
  /** Send raw frame bytes. */
  send: (frame: Uint8Array) => Promise<void>;
  /** Wait for an ACK/STATUS or verify reply for `addr`. Resolves with verifyCode it received, or rejects on timeout. */
  waitVerify: (addr: number, expectedVerifyCode: number, timeoutMs: number) => Promise<boolean>;
  /** Send a verify-broadcast and gather replies; for the tests we keep it per-addr. */
  sendVerify: (verifyCode: number) => Promise<void>;
}

export interface DownloadAllResult {
  modulesOk: number[];
  modulesFail: number[];
  verifyCode: number;
  durationMs: number;
}

const RETRY_BACKOFF_MS = [250, 750];

// ── Compilation ─────────────────────────────────────────────────────
function pyroCueToUltraFire(cue: PyroCue): UltraFireCueData {
  // module/channel are 0-based in ShowPlan; firmware is 1-based for igniterPos.
  return {
    igniterPos: cue.channel + 1,
    timecodeMs: Math.round(cue.time * 1000),
    durationMs: clampFireDuration(cue.fuseDelay > 0 ? Math.max(50, cue.fuseDelay) : 50),
    priority: 0,
  };
}

export function compileShowToModules(
  pyroCues: PyroCue[] = showPlanManager.current.pyroCues,
): CompiledShow {
  const byModule = new Map<number, UltraFireCueData[]>();
  const errors: string[] = [];

  for (const cue of pyroCues) {
    if (!Number.isFinite(cue.module) || cue.module < 0) {
      errors.push(`cue ${cue.id}: invalid module ${cue.module}`); continue;
    }
    if (cue.channel < 0 || cue.channel > 31) {
      errors.push(`cue ${cue.id}: channel ${cue.channel} out of range 0..31`); continue;
    }
    const list = byModule.get(cue.module) ?? [];
    list.push(pyroCueToUltraFire(cue));
    byModule.set(cue.module, list);
  }

  // Per-module capacity check
  for (const [addr, list] of byModule) {
    if (list.length > FIREONE_MAX_EVENTS) {
      errors.push(`module ${addr}: ${list.length} events > FIREONE_MAX_EVENTS (${FIREONE_MAX_EVENTS})`);
    }
    if (list.length > FIREONE_MAX_FIRINGS) {
      errors.push(`module ${addr}: ${list.length} firings > FIREONE_MAX_FIRINGS (${FIREONE_MAX_FIRINGS})`);
    }
    list.sort((a, b) => a.timecodeMs - b.timecodeMs);
  }

  const verifyCode = verifyCodeFor(byModule);
  let totalCues = 0;
  for (const [, list] of byModule) totalCues += list.length;

  return { byModule, verifyCode, totalCues, errors };
}

/**
 * Deterministic verify code: CRC16-CCITT over concatenated canonical bytes
 * of every module (sorted by addr). Same input → same code, always.
 */
export function verifyCodeFor(byModule: Map<number, UltraFireCueData[]>): number {
  const addrs = Array.from(byModule.keys()).sort((a, b) => a - b);
  const chunks: number[] = [];
  for (const addr of addrs) {
    chunks.push(addr & 0xff);
    const list = byModule.get(addr)!;
    chunks.push((list.length >> 8) & 0xff, list.length & 0xff);
    for (const c of list) {
      chunks.push(c.igniterPos & 0xff);
      chunks.push((c.timecodeMs >>> 24) & 0xff, (c.timecodeMs >>> 16) & 0xff,
                  (c.timecodeMs >>> 8) & 0xff, c.timecodeMs & 0xff);
      const dur = clampFireDuration(c.durationMs);
      chunks.push((dur >> 8) & 0xff, dur & 0xff);
      chunks.push(c.priority & 0x0f);
    }
  }
  return crc16Ccitt(new Uint8Array(chunks));
}

// ── Execution ───────────────────────────────────────────────────────

export async function downloadAll(
  compiled: CompiledShow,
  opts: DownloadAllOptions,
): Promise<DownloadAllResult> {
  const startedAt = Date.now();
  const modulesOk: number[] = [];
  const modulesFail: number[] = [];
  const addrs = Array.from(compiled.byModule.keys()).sort((a, b) => a - b);

  const emit = (p: ModuleDownloadProgress) => opts.onProgress?.(p);

  for (const addr of addrs) {
    if (opts.signal?.aborted) {
      emit({ addr, status: 'aborted', attempts: 0, cueCount: 0, bytes: 0 });
      modulesFail.push(addr);
      continue;
    }
    const cues = compiled.byModule.get(addr)!;
    const frame = buildDownloadToModule(addr, compiled.verifyCode, cues);
    let attempts = 0;
    let okay = false;
    let lastError: string | undefined;
    while (attempts <= RETRY_BACKOFF_MS.length) {
      attempts++;
      emit({ addr, status: 'sending', attempts, cueCount: cues.length, bytes: frame.length });
      try {
        await opts.transport.send(frame);
        emit({ addr, status: 'verifying', attempts, cueCount: cues.length, bytes: frame.length });
        await opts.transport.sendVerify(compiled.verifyCode);
        okay = await opts.transport.waitVerify(addr, compiled.verifyCode, 500);
        if (okay) break;
        lastError = `verify mismatch addr=${addr}`;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
      if (attempts <= RETRY_BACKOFF_MS.length) {
        await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS[attempts - 1]));
      }
    }
    if (okay) {
      modulesOk.push(addr);
      emit({ addr, status: 'ok', attempts, cueCount: cues.length, bytes: frame.length });
    } else {
      modulesFail.push(addr);
      emit({ addr, status: 'fail', attempts, cueCount: cues.length, bytes: frame.length, error: lastError });
    }
  }

  const durationMs = Date.now() - startedAt;
  blackbox.record('state',
    `UltraFireDownloader: ok=${modulesOk.length} fail=${modulesFail.length} ` +
    `verify=0x${compiled.verifyCode.toString(16)} planHash=${opts.planHash ?? 'n/a'} ${durationMs}ms`,
  );
  return { modulesOk, modulesFail, verifyCode: compiled.verifyCode, durationMs };
}
