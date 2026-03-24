/**
 * FX KONTROL · Runtime Safety Engine
 * Watchdog, progressive degradation, crash-loop cooldown,
 * API fallback (WebGPU → WebGL2 → static preview).
 */

// ── Render API Detection & Fallback ──────────────────────────
export type RenderAPI = 'webgpu' | 'webgl2' | 'webgl1' | 'static';

let _activeAPI: RenderAPI = 'webgl2';
let _apiLocked = false;

export function detectBestRenderAPI(): RenderAPI {
  if (_apiLocked) return _activeAPI;

  // WebGPU check (navigator.gpu exists and adapter obtainable)
  if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
    _activeAPI = 'webgpu';
    return 'webgpu';
  }

  // WebGL2
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    if (gl) { _activeAPI = 'webgl2'; return 'webgl2'; }
  } catch { /* fallthrough */ }

  // WebGL1
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl');
    if (gl) { _activeAPI = 'webgl1'; return 'webgl1'; }
  } catch { /* fallthrough */ }

  _activeAPI = 'static';
  return 'static';
}

export function getActiveRenderAPI(): RenderAPI { return _activeAPI; }
export function forceRenderAPI(api: RenderAPI) { _activeAPI = api; _apiLocked = true; }
export function unlockRenderAPI() { _apiLocked = false; }

// ── Crash-Loop Cooldown ──────────────────────────────────────
const CRASH_WINDOW_MS = 30_000;   // 30s window
const MAX_CRASHES_IN_WINDOW = 3;  // Max crashes before cooldown
const COOLDOWN_MS = 10_000;       // 10s cooldown

interface CrashRecord {
  timestamps: number[];
  inCooldown: boolean;
  cooldownUntil: number;
  totalCrashes: number;
}

const _crashRecord: CrashRecord = {
  timestamps: [],
  inCooldown: false,
  cooldownUntil: 0,
  totalCrashes: 0,
};

/**
 * Report a crash (context loss, unrecoverable error).
 * Returns true if recovery should proceed, false if in cooldown.
 */
export function reportCrash(): boolean {
  const now = Date.now();
  _crashRecord.totalCrashes++;

  // Check cooldown
  if (_crashRecord.inCooldown) {
    if (now < _crashRecord.cooldownUntil) {
      console.warn(`[RuntimeSafety] In cooldown — suppressing recovery until ${new Date(_crashRecord.cooldownUntil).toISOString()}`);
      return false;
    }
    _crashRecord.inCooldown = false;
    _crashRecord.timestamps = [];
  }

  // Add timestamp, prune old
  _crashRecord.timestamps.push(now);
  _crashRecord.timestamps = _crashRecord.timestamps.filter(t => now - t < CRASH_WINDOW_MS);

  if (_crashRecord.timestamps.length >= MAX_CRASHES_IN_WINDOW) {
    _crashRecord.inCooldown = true;
    _crashRecord.cooldownUntil = now + COOLDOWN_MS;
    console.error(`[RuntimeSafety] Crash loop detected (${MAX_CRASHES_IN_WINDOW} in ${CRASH_WINDOW_MS / 1000}s) — entering ${COOLDOWN_MS / 1000}s cooldown`);

    // Auto-downgrade API
    if (_activeAPI === 'webgpu') _activeAPI = 'webgl2';
    else if (_activeAPI === 'webgl2') _activeAPI = 'webgl1';
    else _activeAPI = 'static';

    console.warn(`[RuntimeSafety] Downgraded render API to: ${_activeAPI}`);
    return false;
  }

  return true;
}

export function getCrashRecord(): Readonly<CrashRecord> { return _crashRecord; }
export function isInCooldown(): boolean {
  if (!_crashRecord.inCooldown) return false;
  if (Date.now() >= _crashRecord.cooldownUntil) {
    _crashRecord.inCooldown = false;
    return false;
  }
  return true;
}

// ── FPS Watchdog ─────────────────────────────────────────────
export type DegradationLevel = 'none' | 'mild' | 'moderate' | 'severe' | 'critical';

interface WatchdogState {
  level: DegradationLevel;
  consecutiveLowFrames: number;
  lastCheckTime: number;
  checkIntervalMs: number;
  fpsThresholds: Record<DegradationLevel, number>;
  callbacks: Array<(level: DegradationLevel) => void>;
}

const _watchdog: WatchdogState = {
  level: 'none',
  consecutiveLowFrames: 0,
  lastCheckTime: 0,
  checkIntervalMs: 500,   // Check every 500ms
  fpsThresholds: {
    none: 50,      // > 50 FPS = fine
    mild: 40,      // 40-50 = mild degradation
    moderate: 30,  // 30-40 = moderate
    severe: 20,    // 20-30 = severe
    critical: 0,   // < 20 = critical
  },
  callbacks: [],
};

/** Register a callback for degradation level changes */
export function onDegradationChange(cb: (level: DegradationLevel) => void): () => void {
  _watchdog.callbacks.push(cb);
  return () => {
    _watchdog.callbacks = _watchdog.callbacks.filter(c => c !== cb);
  };
}

/**
 * Feed FPS to watchdog. Call at ~10Hz (from setInterval or requestAnimationFrame).
 * Returns current degradation level.
 */
export function watchdogTick(currentFPS: number): DegradationLevel {
  const now = performance.now();
  if (now - _watchdog.lastCheckTime < _watchdog.checkIntervalMs) return _watchdog.level;
  _watchdog.lastCheckTime = now;

  let newLevel: DegradationLevel = 'critical';
  if (currentFPS >= _watchdog.fpsThresholds.none) newLevel = 'none';
  else if (currentFPS >= _watchdog.fpsThresholds.mild) newLevel = 'mild';
  else if (currentFPS >= _watchdog.fpsThresholds.moderate) newLevel = 'moderate';
  else if (currentFPS >= _watchdog.fpsThresholds.severe) newLevel = 'severe';

  if (newLevel !== _watchdog.level) {
    // Require sustained low FPS before degrading (hysteresis)
    _watchdog.consecutiveLowFrames++;
    const threshold = newLevel > _watchdog.level ? 3 : 6; // Degrade fast, recover slow
    if (_watchdog.consecutiveLowFrames >= threshold) {
      const old = _watchdog.level;
      _watchdog.level = newLevel;
      _watchdog.consecutiveLowFrames = 0;
      console.log(`[Watchdog] Degradation: ${old} → ${newLevel} (FPS: ${currentFPS.toFixed(1)})`);
      _watchdog.callbacks.forEach(cb => cb(newLevel));
    }
  } else {
    _watchdog.consecutiveLowFrames = 0;
  }

  return _watchdog.level;
}

export function getDegradationLevel(): DegradationLevel { return _watchdog.level; }
export function resetWatchdog(): void {
  _watchdog.level = 'none';
  _watchdog.consecutiveLowFrames = 0;
}

// ── Frame Budget Guard ───────────────────────────────────────
export interface FrameBudget {
  maxFrameTimeMs: number;      // 16.67 for 60fps
  maxDrawCalls: number;        // e.g. 500
  maxTriangles: number;        // e.g. 2_000_000
  maxActiveParticles: number;  // e.g. 100_000
}

const DEFAULT_BUDGET: FrameBudget = {
  maxFrameTimeMs: 16.67,
  maxDrawCalls: 500,
  maxTriangles: 2_000_000,
  maxActiveParticles: 100_000,
};

let _frameBudget = { ...DEFAULT_BUDGET };

export function setFrameBudget(budget: Partial<FrameBudget>) {
  _frameBudget = { ..._frameBudget, ...budget };
}

export function getFrameBudget(): Readonly<FrameBudget> { return _frameBudget; }

export interface FrameBudgetCheck {
  withinBudget: boolean;
  frameTimeOk: boolean;
  drawCallsOk: boolean;
  trianglesOk: boolean;
}

export function checkFrameBudget(
  frameTimeMs: number,
  drawCalls: number,
  triangles: number,
): FrameBudgetCheck {
  return {
    withinBudget: frameTimeMs <= _frameBudget.maxFrameTimeMs && drawCalls <= _frameBudget.maxDrawCalls && triangles <= _frameBudget.maxTriangles,
    frameTimeOk: frameTimeMs <= _frameBudget.maxFrameTimeMs,
    drawCallsOk: drawCalls <= _frameBudget.maxDrawCalls,
    trianglesOk: triangles <= _frameBudget.maxTriangles,
  };
}

// ── NaN / Invalid Transform Scanner ─────────────────────────
export interface TransformScanResult {
  corrupted: number;
  fixed: number;
  removed: number;
}

const _lastValidPositions = new Map<number, { x: number; y: number; z: number }>();
let _scanFrameCounter = 0;
const SCAN_INTERVAL = 60; // scan every 60 frames

/**
 * Scan a Three.js scene for NaN/undefined/invalid transforms.
 * Call from useFrame. Only runs every SCAN_INTERVAL frames.
 * Auto-fixes corrupted values to last valid snapshot.
 */
export function scanSceneTransforms(scene: { traverse: (cb: (obj: any) => void) => void }): TransformScanResult | null {
  _scanFrameCounter++;
  if (_scanFrameCounter % SCAN_INTERVAL !== 0) return null;

  let corrupted = 0;
  let fixed = 0;
  let removed = 0;

  scene.traverse((obj: any) => {
    if (!obj.position || !obj.rotation || !obj.scale) return;

    const pos = obj.position;
    const rot = obj.rotation;
    const scl = obj.scale;

    const isCorrupt =
      !isFinite(pos.x) || !isFinite(pos.y) || !isFinite(pos.z) ||
      !isFinite(rot.x) || !isFinite(rot.y) || !isFinite(rot.z) ||
      !isFinite(scl.x) || !isFinite(scl.y) || !isFinite(scl.z) ||
      scl.x === 0 || scl.y === 0 || scl.z === 0;

    if (isCorrupt) {
      corrupted++;
      const lastValid = _lastValidPositions.get(obj.id);

      if (lastValid) {
        // Restore last valid position
        if (!isFinite(pos.x) || !isFinite(pos.y) || !isFinite(pos.z)) {
          pos.set(lastValid.x, lastValid.y, lastValid.z);
          fixed++;
        }
      } else {
        // Reset to origin
        pos.set(0, 0, 0);
        fixed++;
      }

      // Fix rotation
      if (!isFinite(rot.x)) rot.x = 0;
      if (!isFinite(rot.y)) rot.y = 0;
      if (!isFinite(rot.z)) rot.z = 0;

      // Fix scale
      if (!isFinite(scl.x) || scl.x === 0) scl.x = 1;
      if (!isFinite(scl.y) || scl.y === 0) scl.y = 1;
      if (!isFinite(scl.z) || scl.z === 0) scl.z = 1;

      console.warn(`[RuntimeSafety] Fixed corrupted transform on object ${obj.name || obj.id}`);
    } else {
      // Snapshot valid position
      _lastValidPositions.set(obj.id, { x: pos.x, y: pos.y, z: pos.z });
    }
  });

  // Prune stale snapshots (keep max 500)
  if (_lastValidPositions.size > 500) {
    const keys = [..._lastValidPositions.keys()];
    for (let i = 0; i < keys.length - 500; i++) {
      _lastValidPositions.delete(keys[i]);
    }
  }

  if (corrupted > 0) {
    console.warn(`[RuntimeSafety] Scan: ${corrupted} corrupted, ${fixed} fixed, ${removed} removed`);
  }

  return { corrupted, fixed, removed };
}
