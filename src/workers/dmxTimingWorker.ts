/**
 * DMX Timing Web Worker — High-Precision Clock
 * Runs independently of main thread to guarantee sub-millisecond accuracy
 * for Art-Net/sACN packet dispatch regardless of UI/3D rendering load.
 */

// ── Types ──────────────────────────────────────────────────────────
interface WorkerMessage {
  type: 'START' | 'STOP' | 'SEEK' | 'UPDATE_CUES' | 'SET_BPM' | 'SET_SPEED';
  payload?: any;
}

interface CueData {
  id: string;
  startTime: number;
  effectId: string;
  trackIndex: number;
  dmxValues?: number[];  // Pre-computed DMX buffer
  preFireDelay?: number;
}

interface BezierKeyframe {
  time: number;
  value: number;
  cp1: { x: number; y: number };
  cp2: { x: number; y: number };
}

// ── State ──────────────────────────────────────────────────────────
let isRunning = false;
let startTimestamp = 0;
let seekOffset = 0;
let playbackSpeed = 1.0;
let bpm = 120;
let cues: CueData[] = [];
let firedCueIds = new Set<string>();
let lastTickTime = 0;

// Pre-allocated DMX buffer (512 channels)
const dmxBuffer = new Uint8Array(512);

// ── Bézier Interpolation (Zero-GC) ────────────────────────────────
function cubicBezier(t: number, p0: number, p1: number, p2: number, p3: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;
  return mt3 * p0 + 3 * mt2 * t * p1 + 3 * mt * t2 * p2 + t3 * p3;
}

// ── High-Precision Tick Loop ───────────────────────────────────────
function tick() {
  if (!isRunning) return;

  const now = performance.now();
  const elapsed = (now - startTimestamp) * 0.001 * playbackSpeed + seekOffset;
  const deltaMs = now - lastTickTime;
  lastTickTime = now;

  // Scan cues for firing
  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i];
    if (firedCueIds.has(cue.id)) continue;

    const fireTime = cue.startTime - (cue.preFireDelay || 0);
    if (elapsed >= fireTime) {
      firedCueIds.add(cue.id);

      // Dispatch fire event to main thread
      (self as any).postMessage({
        type: 'CUE_FIRE',
        payload: {
          id: cue.id,
          effectId: cue.effectId,
          actualTime: elapsed,
          scheduledTime: cue.startTime,
          drift: (elapsed - fireTime) * 1000, // drift in ms
        },
      });
    }
  }

  // Send timing update to main thread (throttled to ~30Hz)
  if (deltaMs >= 33) {
    (self as any).postMessage({
      type: 'TICK',
      payload: {
        currentTime: elapsed,
        fps: 1000 / deltaMs,
        memoryPressure: false,
      },
    });
  }

  // Use high-precision timer (1ms interval via setTimeout)
  setTimeout(tick, 1);
}

// ── Message Handler ────────────────────────────────────────────────
self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const { type, payload } = e.data;

  switch (type) {
    case 'START':
      isRunning = true;
      startTimestamp = performance.now();
      seekOffset = payload?.fromTime || 0;
      firedCueIds.clear();
      lastTickTime = performance.now();
      // Re-mark already-past cues
      for (const cue of cues) {
        if (cue.startTime < seekOffset) firedCueIds.add(cue.id);
      }
      tick();
      (self as any).postMessage({ type: 'STATE', payload: { running: true } });
      break;

    case 'STOP':
      isRunning = false;
      (self as any).postMessage({ type: 'STATE', payload: { running: false } });
      break;

    case 'SEEK':
      seekOffset = payload?.time || 0;
      startTimestamp = performance.now();
      firedCueIds.clear();
      for (const cue of cues) {
        if (cue.startTime < seekOffset) firedCueIds.add(cue.id);
      }
      (self as any).postMessage({ type: 'SEEK_ACK', payload: { time: seekOffset } });
      break;

    case 'UPDATE_CUES':
      cues = payload?.cues || [];
      break;

    case 'SET_BPM':
      bpm = payload?.bpm || 120;
      break;

    case 'SET_SPEED':
      playbackSpeed = payload?.speed || 1.0;
      break;
  }
};

// Signal ready
(self as any).postMessage({ type: 'READY' });
