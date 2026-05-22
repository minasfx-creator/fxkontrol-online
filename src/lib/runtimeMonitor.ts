/**
 * ─── Runtime Monitor — Unified E2E Surface ─────────────────────────
 * Aggregates the three independent runtime signals we already capture
 * (`consoleCapture`, `errorCapture`/RUM, `skyCanvasDiagnostics`) into a
 * single queryable surface for end-to-end test runs.
 *
 * Why a separate module:
 *   - `consoleCapture` is a circular buffer with a 200-entry cap and
 *     persists to localStorage; it's optimised for the in-app diagnostics
 *     panel, not for "did anything go wrong during scenario X".
 *   - `errorCapture` pushes to RUM and does not retain a queryable list.
 *   - `skyCanvasDiagnostics` only sees R3F/WebGL boundary throws.
 *
 * E2E harness contract (Playwright / manual QA):
 *   await page.evaluate(() => window.__fxkRuntimeMonitor.mark('scrub-test'));
 *   // ...run scenario...
 *   const issues = await page.evaluate(() =>
 *     window.__fxkRuntimeMonitor.since('scrub-test'),
 *   );
 *   expect(issues.errors).toHaveLength(0);
 *   expect(issues.warnings).toHaveLength(0);
 *
 * The monitor is read-only over the existing capture layers; it never
 * swallows or rewrites entries, so production behaviour is unchanged.
 */
import {
  getCapturedEntries,
  subscribeCapturedEntries,
  type CapturedEntry,
} from '@/lib/consoleCapture';
import {
  getSkyCanvasDiagnostics,
  subscribeSkyCanvasDiagnostics,
  type SkyCanvasDiagnosticEntry,
} from '@/lib/skyCanvasDiagnostics';

export type RuntimeIssueLevel = 'error' | 'warning' | 'unhandled' | 'sky';

export interface RuntimeIssue {
  ts: number;
  level: RuntimeIssueLevel;
  source: string;
  message: string;
  stack?: string;
}

export interface RuntimeIssueDigest {
  errors: RuntimeIssue[];
  warnings: RuntimeIssue[];
  unhandled: RuntimeIssue[];
  sky: RuntimeIssue[];
  total: number;
  /** Mark name (or `null` for "since boot") and the timestamp it resolved to. */
  sinceMark: string | null;
  sinceTs: number;
}

const marks = new Map<string, number>();
let installed = false;

function fromConsole(e: CapturedEntry): RuntimeIssue {
  const level: RuntimeIssueLevel =
    e.level === 'warn' ? 'warning' : e.level === 'error' ? 'error' : 'unhandled';
  return {
    ts: e.ts,
    level,
    source: e.source ?? 'console',
    message: e.message,
    stack: e.stack,
  };
}

function fromSky(e: SkyCanvasDiagnosticEntry): RuntimeIssue {
  return {
    ts: e.ts,
    level: 'sky',
    source: e.source,
    message: e.message,
    stack: e.stack,
  };
}

function collectAll(): RuntimeIssue[] {
  const list: RuntimeIssue[] = [];
  for (const e of getCapturedEntries()) list.push(fromConsole(e));
  for (const e of getSkyCanvasDiagnostics()) list.push(fromSky(e));
  list.sort((a, b) => a.ts - b.ts);
  return list;
}

function digest(issues: RuntimeIssue[], mark: string | null, sinceTs: number): RuntimeIssueDigest {
  const errors: RuntimeIssue[] = [];
  const warnings: RuntimeIssue[] = [];
  const unhandled: RuntimeIssue[] = [];
  const sky: RuntimeIssue[] = [];
  for (const i of issues) {
    if (i.level === 'error') errors.push(i);
    else if (i.level === 'warning') warnings.push(i);
    else if (i.level === 'unhandled') unhandled.push(i);
    else sky.push(i);
  }
  return {
    errors,
    warnings,
    unhandled,
    sky,
    total: issues.length,
    sinceMark: mark,
    sinceTs,
  };
}

/** All issues since `mark` (or since module boot if `mark` is omitted/unknown). */
export function runtimeIssuesSince(mark?: string): RuntimeIssueDigest {
  const sinceTs = mark != null ? marks.get(mark) ?? 0 : 0;
  const issues = collectAll().filter((i) => i.ts >= sinceTs);
  return digest(issues, mark ?? null, sinceTs);
}

/** Stamp a moment so a later call to `runtimeIssuesSince(name)` slices from here. */
export function markRuntimeCheckpoint(name: string): number {
  const ts = Date.now();
  marks.set(name, ts);
  return ts;
}

export function clearRuntimeCheckpoint(name: string): void {
  marks.delete(name);
}

interface RuntimeMonitorWindow {
  mark: typeof markRuntimeCheckpoint;
  since: typeof runtimeIssuesSince;
  clear: typeof clearRuntimeCheckpoint;
  /** Live snapshot — every issue we have buffered. */
  snapshot: () => RuntimeIssueDigest;
}

declare global {
  interface Window {
    __fxkRuntimeMonitor?: RuntimeMonitorWindow;
  }
}

/**
 * Install the global window handle and subscribe to live updates so the
 * underlying capture buffers stay warm during E2E. Idempotent and safe
 * to call from `main.tsx` after the capture layers boot.
 */
export function initRuntimeMonitor(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  // Keep subscriptions alive for the lifetime of the page so the capture
  // layers don't garbage-collect listeners.
  subscribeCapturedEntries(() => {});
  subscribeSkyCanvasDiagnostics(() => {});

  window.__fxkRuntimeMonitor = {
    mark: markRuntimeCheckpoint,
    since: runtimeIssuesSince,
    clear: clearRuntimeCheckpoint,
    snapshot: () => runtimeIssuesSince(),
  };
}
