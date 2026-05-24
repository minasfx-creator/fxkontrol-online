/**
 * Regression: the runtime monitor must aggregate console + sky diagnostics
 * into a single `since(mark)` digest, and must NOT lose entries that were
 * captured before the monitor was initialised (boot-time errors).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearRuntimeCheckpoint,
  initRuntimeMonitor,
  markRuntimeCheckpoint,
  runtimeIssuesSince,
} from '@/lib/runtimeMonitor';
import { clearCapturedEntries, installConsoleCapture } from '@/lib/consoleCapture';
import { captureSkyCanvasError, clearSkyCanvasDiagnostics } from '@/lib/skyCanvasDiagnostics';

describe('runtimeMonitor — unified E2E surface', () => {
  beforeEach(() => {
    installConsoleCapture();
    initRuntimeMonitor();
    clearCapturedEntries();
    clearSkyCanvasDiagnostics();
    clearRuntimeCheckpoint('scenario');
  });

  afterEach(() => {
    clearCapturedEntries();
    clearSkyCanvasDiagnostics();
  });

  it('returns an empty digest when nothing has gone wrong', () => {
    const d = runtimeIssuesSince();
    expect(d.errors).toEqual([]);
    expect(d.warnings).toEqual([]);
    expect(d.sky).toEqual([]);
    expect(d.total).toBe(0);
  });

  it('aggregates console.error, console.warn, and sky diagnostics into one digest', async () => {
    console.error('boom-error');
    console.warn('soft-warn');
    captureSkyCanvasError('SubsystemBoundary:Test', new Error('sky-boom'));

    // Force microtask flush so listeners settle.
    await Promise.resolve();

    const d = runtimeIssuesSince();
    expect(d.errors.some((i) => i.message.includes('boom-error'))).toBe(true);
    expect(d.warnings.some((i) => i.message.includes('soft-warn'))).toBe(true);
    expect(d.sky.some((i) => i.message.includes('sky-boom'))).toBe(true);
  });

  it('mark/since slices issues to those captured after the checkpoint', async () => {
    console.error('pre-mark error');
    // 2 ms gap so the mark timestamp is strictly greater than the
    // pre-mark entry's `ts` (Date.now() resolution on some platforms is 1 ms).
    await new Promise((r) => setTimeout(r, 2));

    markRuntimeCheckpoint('scenario');

    await new Promise((r) => setTimeout(r, 2));
    console.error('post-mark error');
    captureSkyCanvasError('SubsystemBoundary:Test', new Error('post-mark sky'));

    await Promise.resolve();

    const d = runtimeIssuesSince('scenario');
    expect(d.sinceMark).toBe('scenario');
    expect(d.errors.every((i) => !i.message.includes('pre-mark'))).toBe(true);
    expect(d.errors.some((i) => i.message.includes('post-mark'))).toBe(true);
    expect(d.sky.some((i) => i.message.includes('post-mark sky'))).toBe(true);
  });

  it('exposes window.__fxkRuntimeMonitor with the documented surface', () => {
    const w = window.__fxkRuntimeMonitor;
    expect(w).toBeDefined();
    expect(typeof w?.mark).toBe('function');
    expect(typeof w?.since).toBe('function');
    expect(typeof w?.snapshot).toBe('function');
    expect(typeof w?.clear).toBe('function');
  });
});
