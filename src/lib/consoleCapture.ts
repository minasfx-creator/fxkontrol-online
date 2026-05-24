/**
 * ─── Console Capture — Global error/warn recorder ──────────────────
 * Wraps `console.error`, `console.warn` and `window.onerror` /
 * `unhandledrejection` so we can surface runtime errors inside the
 * Diagnostics panel without needing browser DevTools or auth.
 *
 * Persists the latest entries in `localStorage` so the buffer survives
 * a hard reload triggered by the LazyChunkBoundary.
 */

export type CapturedLevel = "error" | "warn" | "unhandled" | "rejection";

export interface CapturedEntry {
  id: string;
  ts: number;
  level: CapturedLevel;
  message: string;
  stack?: string;
  source?: string;
}

const STORAGE_KEY = "fxk.console-capture.v1";
const MAX_ENTRIES = 200;

let entries: CapturedEntry[] = [];
const listeners = new Set<() => void>();
let installed = false;

function load(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as CapturedEntry[];
    if (Array.isArray(parsed)) entries = parsed.slice(-MAX_ENTRIES);
  } catch { /* ignore */ }
}

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
  } catch { /* quota / disabled storage */ }
}

function notify(): void {
  for (const fn of listeners) fn();
}

function stringifyArg(a: unknown): string {
  if (a == null) return String(a);
  if (typeof a === "string") return a;
  if (a instanceof Error) return a.message;
  try { return JSON.stringify(a); } catch { return String(a); }
}

function push(level: CapturedLevel, message: string, stack?: string, source?: string): void {
  entries.push({
    id: `cap-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ts: Date.now(),
    level,
    message,
    stack,
    source,
  });
  if (entries.length > MAX_ENTRIES) entries = entries.slice(-MAX_ENTRIES);
  persist();
  notify();
}

export function installConsoleCapture(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  load();

  const origError = console.error.bind(console);
  const origWarn = console.warn.bind(console);

  console.error = (...args: unknown[]) => {
    const stack = args.find((a) => a instanceof Error) as Error | undefined;
    push("error", args.map(stringifyArg).join(" "), stack?.stack);
    origError(...args);
  };
  console.warn = (...args: unknown[]) => {
    push("warn", args.map(stringifyArg).join(" "));
    origWarn(...args);
  };

  window.addEventListener("error", (ev) => {
    push(
      "unhandled",
      ev.message ?? "Unhandled error",
      ev.error?.stack,
      ev.filename ? `${ev.filename}:${ev.lineno}:${ev.colno}` : undefined,
    );
  });

  window.addEventListener("unhandledrejection", (ev) => {
    const reason = ev.reason;
    const msg = reason instanceof Error ? reason.message : stringifyArg(reason);
    const stack = reason instanceof Error ? reason.stack : undefined;
    push("rejection", msg, stack);
  });
}

export function getCapturedEntries(): CapturedEntry[] {
  return [...entries];
}

export function clearCapturedEntries(): void {
  entries = [];
  persist();
  notify();
}

export function subscribeCapturedEntries(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
