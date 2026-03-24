/**
 * FX KONTROL · Observability Metrics
 * FPS percentiles, frame time, draw calls, context loss rate,
 * crash-free session tracking.
 */

// ── Rolling Percentile Calculator ────────────────────────────
class RollingPercentile {
  private buffer: Float64Array;
  private head = 0;
  private filled = 0;
  private sorted: number[] = [];
  private dirty = true;

  constructor(private windowSize: number) {
    this.buffer = new Float64Array(windowSize);
  }

  push(value: number) {
    this.buffer[this.head] = value;
    this.head = (this.head + 1) % this.windowSize;
    if (this.filled < this.windowSize) this.filled++;
    this.dirty = true;
  }

  private ensureSorted() {
    if (!this.dirty) return;
    this.sorted = Array.from(this.buffer.subarray(0, this.filled));
    this.sorted.sort((a, b) => a - b);
    this.dirty = false;
  }

  percentile(p: number): number {
    if (this.filled === 0) return 0;
    this.ensureSorted();
    const idx = Math.min(Math.floor(p * this.filled), this.filled - 1);
    return this.sorted[idx];
  }

  median(): number { return this.percentile(0.5); }
  p95(): number { return this.percentile(0.95); }
  p99(): number { return this.percentile(0.99); }
  avg(): number {
    if (this.filled === 0) return 0;
    let sum = 0;
    for (let i = 0; i < this.filled; i++) sum += this.buffer[i];
    return sum / this.filled;
  }
}

// ── Metrics Store ────────────────────────────────────────────
const WINDOW = 300; // ~5 seconds at 60fps

const _fps = new RollingPercentile(WINDOW);
const _frameTime = new RollingPercentile(WINDOW);
const _drawCalls = new RollingPercentile(WINDOW);
const _triangles = new RollingPercentile(WINDOW);

let _contextLossCount = 0;
let _sessionStart = Date.now();
let _lastCrashTime = 0;

/** Feed per-frame metrics. Call once per render frame. */
export function pushFrameMetrics(
  fps: number,
  frameTimeMs: number,
  drawCalls: number,
  triangles: number,
): void {
  _fps.push(fps);
  _frameTime.push(frameTimeMs);
  _drawCalls.push(drawCalls);
  _triangles.push(triangles);
}

/** Record a WebGL context loss event */
export function recordContextLoss(): void {
  _contextLossCount++;
  _lastCrashTime = Date.now();
}

// ── Snapshot ─────────────────────────────────────────────────
export interface MetricsSnapshot {
  fps: { avg: number; p50: number; p95: number };
  frameTime: { avg: number; p95: number; p99: number };
  drawCalls: { avg: number; p95: number };
  triangles: { avg: number; p95: number };
  contextLossCount: number;
  sessionDurationSec: number;
  crashFree: boolean;
  lastCrashAgoSec: number | null;
}

export function getMetricsSnapshot(): MetricsSnapshot {
  const now = Date.now();
  return {
    fps: { avg: _fps.avg(), p50: _fps.median(), p95: _fps.p95() },
    frameTime: { avg: _frameTime.avg(), p95: _frameTime.p95(), p99: _frameTime.p99() },
    drawCalls: { avg: _drawCalls.avg(), p95: _drawCalls.p95() },
    triangles: { avg: _triangles.avg(), p95: _triangles.p95() },
    contextLossCount: _contextLossCount,
    sessionDurationSec: (now - _sessionStart) / 1000,
    crashFree: _contextLossCount === 0,
    lastCrashAgoSec: _lastCrashTime ? (now - _lastCrashTime) / 1000 : null,
  };
}

/** Reset all metrics (e.g. on new session) */
export function resetMetrics(): void {
  _contextLossCount = 0;
  _sessionStart = Date.now();
  _lastCrashTime = 0;
}

// ── Console Reporter ─────────────────────────────────────────
let _reportInterval: ReturnType<typeof setInterval> | null = null;

export function startMetricsReporting(intervalSec = 30): void {
  stopMetricsReporting();
  _reportInterval = setInterval(() => {
    const m = getMetricsSnapshot();
    console.log(
      `[Metrics] FPS: ${m.fps.avg.toFixed(0)} avg / ${m.fps.p95.toFixed(0)} p95 | ` +
      `Frame: ${m.frameTime.avg.toFixed(1)}ms avg / ${m.frameTime.p95.toFixed(1)}ms p95 | ` +
      `Draw: ${m.drawCalls.avg.toFixed(0)} | Tris: ${(m.triangles.avg / 1000).toFixed(0)}k | ` +
      `CtxLoss: ${m.contextLossCount} | Session: ${m.sessionDurationSec.toFixed(0)}s`
    );
  }, intervalSec * 1000);
}

export function stopMetricsReporting(): void {
  if (_reportInterval) {
    clearInterval(_reportInterval);
    _reportInterval = null;
  }
}
