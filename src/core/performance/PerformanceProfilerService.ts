/**
 * PerformanceProfilerService — Module-level singleton
 * Collects frame time history, memory snapshots, degradation transitions, and alerts.
 */

import { onDegradationChange, getDegradationLevel, type DegradationLevel } from '@/lib/hardening/runtimeSafety';
import { getMetricsSnapshot } from '@/lib/hardening/observability';

// ── Types ────────────────────────────────────────────────────
export interface FrameSample {
  timestamp: number;
  frameTimeMs: number;
  drawCalls: number;
  triangles: number;
}

export interface MemorySnapshot {
  timestamp: number;
  jsHeapMB: number;
  geometries: number;
  textures: number;
  estimatedVRAM: number;
}

export interface DegradationTransition {
  timestamp: number;
  from: DegradationLevel;
  to: DegradationLevel;
}

export type AlertSeverity = 'warning' | 'critical';
export type AlertType = 'PERF_CRITICAL' | 'MEMORY_HIGH' | 'VRAM_HIGH' | 'GPU_CRASH';

export interface PerfAlert {
  id: number;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  timestamp: number;
  resolved: boolean;
}

// ── Ring Buffer ──────────────────────────────────────────────
class RingBuffer<T> {
  private buf: (T | null)[];
  private head = 0;
  private count = 0;

  constructor(private capacity: number) {
    this.buf = new Array(capacity).fill(null);
  }

  push(item: T) {
    this.buf[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) this.count++;
  }

  toArray(): T[] {
    if (this.count === 0) return [];
    const result: T[] = [];
    const start = this.count < this.capacity ? 0 : this.head;
    for (let i = 0; i < this.count; i++) {
      result.push(this.buf[(start + i) % this.capacity] as T);
    }
    return result;
  }

  get length() { return this.count; }
}

// ── Singleton State ──────────────────────────────────────────
const FRAME_BUFFER_SIZE = 600;   // ~10s at 60fps
const MEMORY_BUFFER_SIZE = 150;  // ~5min at 2s intervals

const _frames = new RingBuffer<FrameSample>(FRAME_BUFFER_SIZE);
const _memory = new RingBuffer<MemorySnapshot>(MEMORY_BUFFER_SIZE);
const _degradations: DegradationTransition[] = [];
const _alerts: PerfAlert[] = [];
let _alertIdCounter = 0;

// Alert thresholds
let _lowFpsStart = 0;
const LOW_FPS_SUSTAINED_MS = 3000;
const LOW_FPS_THRESHOLD = 25;
const MEMORY_HIGH_MB = 1200;
const VRAM_HIGH_MB = 400;

// Memory sampling interval
let _memorySampleInterval: ReturnType<typeof setInterval> | null = null;
let _unsubDegradation: (() => void) | null = null;

// ── Public API ───────────────────────────────────────────────

/** Push a frame sample. Call once per frame from RAF or useFrame. */
export function pushFrameSample(sample: FrameSample): void {
  _frames.push(sample);

  // Check sustained low FPS alert
  const fps = sample.frameTimeMs > 0 ? 1000 / sample.frameTimeMs : 60;
  if (fps < LOW_FPS_THRESHOLD) {
    if (_lowFpsStart === 0) _lowFpsStart = sample.timestamp;
    else if (sample.timestamp - _lowFpsStart >= LOW_FPS_SUSTAINED_MS) {
      emitAlert('PERF_CRITICAL', 'critical', `FPS < ${LOW_FPS_THRESHOLD} sustained ${(LOW_FPS_SUSTAINED_MS / 1000).toFixed(0)}s`);
      _lowFpsStart = sample.timestamp; // reset to avoid spamming
    }
  } else {
    _lowFpsStart = 0;
    resolveAlertType('PERF_CRITICAL');
  }
}

/** Sample memory metrics. Called automatically at 2s intervals. */
function sampleMemory(): void {
  const mem = (performance as any).memory;
  const jsHeapMB = mem ? Math.round(mem.usedJSHeapSize / 1048576) : 0;
  const obs = getMetricsSnapshot();

  const snap: MemorySnapshot = {
    timestamp: Date.now(),
    jsHeapMB,
    geometries: 0,
    textures: 0,
    estimatedVRAM: 0,
  };

  _memory.push(snap);

  // Memory alerts
  if (jsHeapMB > MEMORY_HIGH_MB) {
    emitAlert('MEMORY_HIGH', 'warning', `JS Heap: ${jsHeapMB}MB > ${MEMORY_HIGH_MB}MB`);
  } else {
    resolveAlertType('MEMORY_HIGH');
  }
}

function emitAlert(type: AlertType, severity: AlertSeverity, message: string): void {
  // Don't duplicate active alerts of same type
  if (_alerts.some(a => a.type === type && !a.resolved)) return;
  _alerts.push({
    id: ++_alertIdCounter,
    type, severity, message,
    timestamp: Date.now(),
    resolved: false,
  });
}

function resolveAlertType(type: AlertType): void {
  for (const a of _alerts) {
    if (a.type === type && !a.resolved) a.resolved = true;
  }
}

export function getFrameHistory(): FrameSample[] { return _frames.toArray(); }
export function getMemoryHistory(): MemorySnapshot[] { return _memory.toArray(); }
export function getDegradationLog(): DegradationTransition[] { return [..._degradations]; }
export function getActiveAlerts(): PerfAlert[] { return _alerts.filter(a => !a.resolved); }
export function getAllAlerts(): PerfAlert[] { return [..._alerts]; }

/** Record a GPU context loss */
export function recordGPUCrash(): void {
  emitAlert('GPU_CRASH', 'critical', 'WebGL context lost');
}

/** Start background sampling (memory + degradation listener) */
export function startProfiler(): void {
  if (_memorySampleInterval) return;

  _memorySampleInterval = setInterval(sampleMemory, 2000);

  let prevLevel = getDegradationLevel();
  _unsubDegradation = onDegradationChange((level) => {
    _degradations.push({ timestamp: Date.now(), from: prevLevel, to: level });
    prevLevel = level;
  });
}

/** Stop background sampling */
export function stopProfiler(): void {
  if (_memorySampleInterval) {
    clearInterval(_memorySampleInterval);
    _memorySampleInterval = null;
  }
  if (_unsubDegradation) {
    _unsubDegradation();
    _unsubDegradation = null;
  }
}

/** Clear all profiler data */
export function resetProfiler(): void {
  _degradations.length = 0;
  _alerts.length = 0;
  _lowFpsStart = 0;
}
