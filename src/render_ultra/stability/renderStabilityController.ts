/**
 * RenderStabilityController — single global observer that samples requestAnimationFrame
 * intervals and auto-degrades `renderQuality()` tier (cinema → balanced → eco) when the
 * frame time exceeds the budget, with hysteresis to climb back up when headroom returns.
 *
 * Pure side-effect free engine — no DOM mutations, no React. Components subscribe via
 * `useRenderQualityTier` and re-render when the effective tier changes.
 */
import { renderQuality, setRenderQuality, type RenderQuality } from '@/lib/featureFlags';

const WINDOW = 60;                // rolling samples
const DOWNGRADE_MS = 22;          // p95 over this for `DOWNGRADE_HOLD` → degrade
const DOWNGRADE_HOLD = 60;        // frames
const UPGRADE_MS = 14;            // p95 under this for `UPGRADE_HOLD` → try upgrade
const UPGRADE_HOLD = 300;         // frames

const TIERS: RenderQuality[] = ['cinema', 'balanced', 'eco'];

type Listener = (tier: RenderQuality, stats: FrameStats) => void;

export interface FrameStats {
  p50: number;
  p95: number;
  p99: number;
  samples: number;
}

class RenderStabilityCtl {
  private buf: number[] = [];
  private idx = 0;
  private last = 0;
  private downCount = 0;
  private upCount = 0;
  private listeners = new Set<Listener>();
  private rafId: number | null = null;
  private started = false;
  // user-pinned tier (via setRenderQuality) is respected → controller never overrides.
  private userPinned = false;

  start(): void {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;
    this.userPinned = !!safeLocalStorage('fxk.flag.render_quality');
    this.last = performance.now();
    this.tick();
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    if (this.rafId != null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  private tick = (): void => {
    if (!this.started) return;
    const now = performance.now();
    const dt = now - this.last;
    this.last = now;
    if (dt > 0 && dt < 1000) this.push(dt);
    if (this.buf.length >= WINDOW) this.evaluate();
    this.rafId = requestAnimationFrame(this.tick);
  };

  private push(ms: number): void {
    if (this.buf.length < WINDOW) {
      this.buf.push(ms);
    } else {
      this.buf[this.idx] = ms;
      this.idx = (this.idx + 1) % WINDOW;
    }
  }

  stats(): FrameStats {
    const n = this.buf.length;
    if (n === 0) return { p50: 0, p95: 0, p99: 0, samples: 0 };
    const sorted = this.buf.slice().sort((a, b) => a - b);
    const at = (q: number) => sorted[Math.min(n - 1, Math.floor(q * n))];
    return { p50: at(0.5), p95: at(0.95), p99: at(0.99), samples: n };
  }

  private evaluate(): void {
    if (this.userPinned) return;
    const s = this.stats();
    const current = renderQuality();
    const idx = TIERS.indexOf(current);

    if (s.p95 > DOWNGRADE_MS) {
      this.downCount++;
      this.upCount = 0;
      if (this.downCount >= DOWNGRADE_HOLD && idx < TIERS.length - 1) {
        this.applyTier(TIERS[idx + 1], s);
        this.downCount = 0;
      }
    } else if (s.p95 < UPGRADE_MS) {
      this.upCount++;
      this.downCount = 0;
      if (this.upCount >= UPGRADE_HOLD && idx > 0) {
        this.applyTier(TIERS[idx - 1], s);
        this.upCount = 0;
      }
    } else {
      this.downCount = 0;
      this.upCount = 0;
    }
  }

  private applyTier(next: RenderQuality, s: FrameStats): void {
    // Controller-driven changes do NOT touch localStorage (that's user-pin territory).
    // We notify listeners with the new effective tier; consumers read via renderQuality().
    // To make renderQuality() reflect this, we temporarily pin and clear.
    setRenderQuality(next);
    this.listeners.forEach((l) => l(next, s));
  }

  subscribe(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  /** Test-only: feed synthetic samples. */
  _ingest(ms: number): void {
    this.push(ms);
    if (this.buf.length >= WINDOW) this.evaluate();
  }

  /** Test-only: reset state. */
  _reset(): void {
    this.buf = [];
    this.idx = 0;
    this.downCount = 0;
    this.upCount = 0;
    this.userPinned = false;
  }
}

function safeLocalStorage(k: string): string | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(k);
  } catch { return null; }
}

export const renderStabilityController = new RenderStabilityCtl();
