/**
 * ─── Self-Diagnostic System ─────────────────────────────────────────
 * Pre-show checklist, aviation-style.
 *
 * runFullCheck() verifies:
 *   - Module connectivity
 *   - Network latency
 *   - Clock synchronization
 *   - Memory/GPU health
 *   - Timeline integrity
 *   - Safety constraints
 */

export type CheckStatus = 'pass' | 'warn' | 'fail' | 'skip';

export interface DiagnosticCheck {
  id: string;
  category: 'network' | 'hardware' | 'timeline' | 'safety' | 'performance' | 'sync';
  name: string;
  status: CheckStatus;
  message: string;
  value?: number;
  threshold?: number;
  duration_ms: number;
}

export interface DiagnosticReport {
  timestamp: number;
  duration_ms: number;
  checks: DiagnosticCheck[];
  passed: number;
  warned: number;
  failed: number;
  overallStatus: CheckStatus;
  readyForShow: boolean;
}

type CheckFn = () => Promise<DiagnosticCheck> | DiagnosticCheck;

class SelfDiagnosticSystem {
  private checks = new Map<string, CheckFn>();
  private lastReport: DiagnosticReport | null = null;

  // ── Register Checks ───────────────────────────────────────────

  registerCheck(id: string, fn: CheckFn): void {
    this.checks.set(id, fn);
  }

  unregisterCheck(id: string): void {
    this.checks.delete(id);
  }

  // ── Built-in Checks ───────────────────────────────────────────

  constructor() {
    // Performance check
    this.registerCheck('perf_fps', () => {
      const fps = _lastFps;
      return {
        id: 'perf_fps',
        category: 'performance',
        name: 'Frame Rate',
        status: fps > 50 ? 'pass' : fps > 30 ? 'warn' : 'fail',
        message: `${fps} FPS`,
        value: fps,
        threshold: 50,
        duration_ms: 0,
      };
    });

    // Memory check
    this.registerCheck('perf_memory', () => {
      const mem = (performance as any).memory;
      const usedMB = mem ? Math.round(mem.usedJSHeapSize / 1048576) : 0;
      const limitMB = mem ? Math.round(mem.jsHeapSizeLimit / 1048576) : 0;
      const ratio = limitMB > 0 ? usedMB / limitMB : 0;
      return {
        id: 'perf_memory',
        category: 'performance',
        name: 'JS Heap',
        status: ratio < 0.7 ? 'pass' : ratio < 0.9 ? 'warn' : 'fail',
        message: `${usedMB}MB / ${limitMB}MB (${Math.round(ratio * 100)}%)`,
        value: ratio,
        threshold: 0.7,
        duration_ms: 0,
      };
    });

    // WebGL context
    this.registerCheck('hw_webgl', () => {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      const ok = !!gl;
      canvas.remove();
      return {
        id: 'hw_webgl',
        category: 'hardware',
        name: 'WebGL Context',
        status: ok ? 'pass' : 'fail',
        message: ok ? 'WebGL2 available' : 'No WebGL!',
        duration_ms: 0,
      };
    });

    // IndexedDB (BlackBox)
    this.registerCheck('hw_indexeddb', async () => {
      const t0 = performance.now();
      try {
        const req = indexedDB.open('_diag_test', 1);
        await new Promise<void>((res, rej) => {
          req.onsuccess = () => { req.result.close(); indexedDB.deleteDatabase('_diag_test'); res(); };
          req.onerror = () => rej(req.error);
        });
        return {
          id: 'hw_indexeddb',
          category: 'hardware',
          name: 'IndexedDB (BlackBox)',
          status: 'pass',
          message: 'Available',
          duration_ms: performance.now() - t0,
        };
      } catch {
        return {
          id: 'hw_indexeddb',
          category: 'hardware',
          name: 'IndexedDB (BlackBox)',
          status: 'warn',
          message: 'Not available — crash recovery disabled',
          duration_ms: performance.now() - t0,
        };
      }
    });

    // Clock resolution
    this.registerCheck('sync_clock', () => {
      const samples: number[] = [];
      let prev = performance.now();
      for (let i = 0; i < 100; i++) {
        const now = performance.now();
        if (now !== prev) {
          samples.push(now - prev);
          prev = now;
        }
      }
      const resolution = samples.length > 0 ? Math.min(...samples) : 1;
      return {
        id: 'sync_clock',
        category: 'sync',
        name: 'Clock Resolution',
        status: resolution <= 0.1 ? 'pass' : resolution <= 1 ? 'warn' : 'fail',
        message: `${resolution.toFixed(3)}ms`,
        value: resolution,
        threshold: 0.1,
        duration_ms: 0,
      };
    });
  }

  // ── Run All ───────────────────────────────────────────────────

  async runFullCheck(): Promise<DiagnosticReport> {
    const t0 = performance.now();
    const results: DiagnosticCheck[] = [];

    for (const [, fn] of this.checks) {
      const ct0 = performance.now();
      try {
        const check = await fn();
        check.duration_ms = check.duration_ms || (performance.now() - ct0);
        results.push(check);
      } catch (err) {
        results.push({
          id: 'error',
          category: 'performance',
          name: 'Check Error',
          status: 'fail',
          message: String(err),
          duration_ms: performance.now() - ct0,
        });
      }
    }

    const passed = results.filter(c => c.status === 'pass').length;
    const warned = results.filter(c => c.status === 'warn').length;
    const failed = results.filter(c => c.status === 'fail').length;

    const report: DiagnosticReport = {
      timestamp: Date.now(),
      duration_ms: performance.now() - t0,
      checks: results,
      passed,
      warned,
      failed,
      overallStatus: failed > 0 ? 'fail' : warned > 0 ? 'warn' : 'pass',
      readyForShow: failed === 0,
    };

    this.lastReport = report;
    return report;
  }

  getLastReport(): DiagnosticReport | null {
    return this.lastReport;
  }
}

// FPS tracker for diagnostic
let _lastFps = 60;
let _fpsSamples: number[] = [];
let _fpsLastTime = performance.now();

export function feedDiagnosticFps(): void {
  const now = performance.now();
  const dt = now - _fpsLastTime;
  _fpsLastTime = now;
  if (dt > 0) {
    _fpsSamples.push(1000 / dt);
    if (_fpsSamples.length > 60) _fpsSamples.shift();
    _lastFps = Math.round(_fpsSamples.reduce((a, b) => a + b, 0) / _fpsSamples.length);
  }
}

export const diagnostic = new SelfDiagnosticSystem();
