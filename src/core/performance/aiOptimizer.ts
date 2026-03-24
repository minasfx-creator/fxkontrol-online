/**
 * ─── AI Performance Optimizer ───────────────────────────────────────
 * Self-evolving quality profiles. Monitors FPS, errors, tile loading.
 * Learns best configs and auto-applies when similar scenarios detected.
 * Stored in localStorage for persistence across sessions.
 */

import { autoScaler, type QualityTier } from '@/core/reliability/autoScaler';

export interface PerformanceSnapshot {
  fps: number;
  fpsP95: number;
  fpsP99: number;
  errorRate: number;       // errors per minute
  tileLoadTimeMs: number;  // avg tile load time
  cameraStability: number; // 0-1 (1 = stable)
  networkLatencyMs: number;
  drawCalls: number;
  triangles: number;
  activeParticles: number;
  timestamp: number;
}

export interface QualityProfile {
  name: string;
  tier: QualityTier;
  lodBias: number;
  cameraDamping: number;
  tileCacheSize: number;
  pixelRatio: number;
  maxParticles: number;
  postProcessing: boolean;
  matchScore: number;      // how well this profile matches current conditions
  timesApplied: number;
  avgFpsWithProfile: number;
}

type ScenarioType = 'highSpeed' | 'cinematic' | 'denseGeometry' | 'lowDevice' | 'particles' | 'idle';

const STORAGE_KEY = 'fxk-ai-optimizer-profiles';
const WINDOW_SIZE = 120;   // 60s at 2 samples/s
const SAMPLE_INTERVAL = 500; // ms

class AIOptimizer {
  private snapshots: PerformanceSnapshot[] = [];
  private profiles: Map<ScenarioType, QualityProfile> = new Map();
  private currentScenario: ScenarioType = 'idle';
  private sampleTimer: ReturnType<typeof setInterval> | null = null;
  private errorCount = 0;
  private errorWindowStart = Date.now();
  private _enabled = false;
  private listeners = new Set<(scenario: ScenarioType, profile: QualityProfile) => void>();

  constructor() {
    this.loadProfiles();
    this.initDefaultProfiles();
  }

  /** Start monitoring and learning */
  start(): void {
    if (this._enabled) return;
    this._enabled = true;
    this.errorWindowStart = Date.now();
    console.log('[AIOptimizer] Started — monitoring performance patterns');
  }

  stop(): void {
    this._enabled = false;
    if (this.sampleTimer) {
      clearInterval(this.sampleTimer);
      this.sampleTimer = null;
    }
  }

  /** Feed a performance snapshot — call at ~2Hz */
  feed(snapshot: Omit<PerformanceSnapshot, 'timestamp'>): void {
    if (!this._enabled) return;

    const s: PerformanceSnapshot = { ...snapshot, timestamp: Date.now() };
    this.snapshots.push(s);
    if (this.snapshots.length > WINDOW_SIZE) this.snapshots.shift();

    // Detect scenario
    const scenario = this.detectScenario();
    if (scenario !== this.currentScenario) {
      this.currentScenario = scenario;
      this.applyBestProfile(scenario);
    }

    // Learn from current performance
    this.learnFromCurrent(scenario, s);
  }

  /** Report an error for error-rate tracking */
  reportError(): void {
    this.errorCount++;
    const elapsed = (Date.now() - this.errorWindowStart) / 60_000; // minutes
    if (elapsed > 1) {
      this.errorCount = 1;
      this.errorWindowStart = Date.now();
    }
  }

  getScenario(): ScenarioType { return this.currentScenario; }

  getProfiles(): QualityProfile[] { return [...this.profiles.values()]; }

  onChange(cb: (scenario: ScenarioType, profile: QualityProfile) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private detectScenario(): ScenarioType {
    if (this.snapshots.length < 10) return 'idle';

    const recent = this.snapshots.slice(-20);
    const avgFps = avg(recent.map(s => s.fps));
    const avgTriangles = avg(recent.map(s => s.triangles));
    const avgParticles = avg(recent.map(s => s.activeParticles));
    const avgCameraStability = avg(recent.map(s => s.cameraStability));

    // Classify
    if (avgFps < 30 && avgTriangles < 500_000) return 'lowDevice';
    if (avgParticles > 50_000) return 'particles';
    if (avgTriangles > 1_500_000) return 'denseGeometry';
    if (avgCameraStability < 0.5) return 'highSpeed';
    if (avgCameraStability > 0.9 && avgFps > 50) return 'cinematic';
    return 'idle';
  }

  private applyBestProfile(scenario: ScenarioType): void {
    const profile = this.profiles.get(scenario);
    if (!profile) return;

    // Apply to autoScaler
    autoScaler.setTier(profile.tier);
    profile.timesApplied++;

    console.log(`[AIOptimizer] Scenario: ${scenario} → applied profile "${profile.name}" (tier: ${profile.tier})`);

    for (const l of this.listeners) {
      try { l(scenario, profile); } catch { /* no-op */ }
    }

    this.saveProfiles();
  }

  private learnFromCurrent(scenario: ScenarioType, snapshot: PerformanceSnapshot): void {
    const profile = this.profiles.get(scenario);
    if (!profile) return;

    // Update rolling average FPS for this profile
    const alpha = 0.05; // slow learning rate
    profile.avgFpsWithProfile = profile.avgFpsWithProfile * (1 - alpha) + snapshot.fps * alpha;

    // If performance is poor with current profile, try downgrading
    if (profile.avgFpsWithProfile < 35 && profile.tier !== 'survival') {
      const tiers: QualityTier[] = ['ultra', 'high', 'medium', 'low', 'survival'];
      const idx = tiers.indexOf(profile.tier);
      if (idx < tiers.length - 1) {
        profile.tier = tiers[idx + 1];
        console.log(`[AIOptimizer] Learned: ${scenario} needs lower tier → ${profile.tier}`);
      }
    }

    // If performance is great, try upgrading
    if (profile.avgFpsWithProfile > 55 && profile.tier !== 'ultra') {
      const tiers: QualityTier[] = ['ultra', 'high', 'medium', 'low', 'survival'];
      const idx = tiers.indexOf(profile.tier);
      if (idx > 0) {
        profile.tier = tiers[idx - 1];
        console.log(`[AIOptimizer] Learned: ${scenario} can handle higher tier → ${profile.tier}`);
      }
    }

    // Save periodically (every 20 snapshots)
    if (this.snapshots.length % 20 === 0) {
      this.saveProfiles();
    }
  }

  private initDefaultProfiles(): void {
    const defaults: Record<ScenarioType, QualityProfile> = {
      idle:          { name: 'Idle',           tier: 'high',     lodBias: 0, cameraDamping: 0.1, tileCacheSize: 200, pixelRatio: 1.0, maxParticles: 100_000, postProcessing: true,  matchScore: 0, timesApplied: 0, avgFpsWithProfile: 60 },
      cinematic:     { name: 'Cinematic',      tier: 'ultra',    lodBias: 0, cameraDamping: 0.2, tileCacheSize: 300, pixelRatio: 1.5, maxParticles: 100_000, postProcessing: true,  matchScore: 0, timesApplied: 0, avgFpsWithProfile: 60 },
      highSpeed:     { name: 'High Speed',     tier: 'medium',   lodBias: 1, cameraDamping: 0.05, tileCacheSize: 150, pixelRatio: 0.8, maxParticles: 50_000, postProcessing: false, matchScore: 0, timesApplied: 0, avgFpsWithProfile: 60 },
      denseGeometry: { name: 'Dense Geometry', tier: 'medium',   lodBias: 2, cameraDamping: 0.1, tileCacheSize: 100, pixelRatio: 0.8, maxParticles: 30_000, postProcessing: false, matchScore: 0, timesApplied: 0, avgFpsWithProfile: 45 },
      lowDevice:     { name: 'Low Device',     tier: 'low',      lodBias: 2, cameraDamping: 0.1, tileCacheSize: 50,  pixelRatio: 0.5, maxParticles: 10_000, postProcessing: false, matchScore: 0, timesApplied: 0, avgFpsWithProfile: 30 },
      particles:     { name: 'Heavy Particles', tier: 'medium',  lodBias: 1, cameraDamping: 0.1, tileCacheSize: 100, pixelRatio: 0.8, maxParticles: 80_000, postProcessing: true,  matchScore: 0, timesApplied: 0, avgFpsWithProfile: 45 },
    };

    for (const [key, profile] of Object.entries(defaults)) {
      if (!this.profiles.has(key as ScenarioType)) {
        this.profiles.set(key as ScenarioType, profile);
      }
    }
  }

  private loadProfiles(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw) as Record<string, QualityProfile>;
        for (const [key, profile] of Object.entries(data)) {
          this.profiles.set(key as ScenarioType, profile);
        }
        console.log('[AIOptimizer] Loaded learned profiles from storage');
      }
    } catch { /* ignore */ }
  }

  private saveProfiles(): void {
    try {
      const data: Record<string, QualityProfile> = {};
      for (const [key, profile] of this.profiles) {
        data[key] = profile;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch { /* ignore */ }
  }

  reset(): void {
    this.stop();
    this.snapshots = [];
    this.currentScenario = 'idle';
    this.errorCount = 0;
    this.profiles.clear();
    this.initDefaultProfiles();
    localStorage.removeItem(STORAGE_KEY);
  }
}

function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export const aiOptimizer = new AIOptimizer();
