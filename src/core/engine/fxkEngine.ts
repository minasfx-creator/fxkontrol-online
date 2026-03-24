/**
 * ─── FXK Core Engine — Central Orchestrator ─────────────────────────
 * The brain of the system. Starts/stops all subsystems.
 * Pluggable: each subsystem is opt-in via config flags.
 * Called from useFrame at 60Hz via tick().
 */

import { autoHeal, type SubsystemId } from '@/core/reliability/autoHealEngine';
import { environmentEngine } from '@/core/environment/environmentEngine';
import { clusterSync } from '@/core/sync/clusterSyncEngine';
import { unrealBridge } from '@/core/sync/unrealBridge';
import { aiOptimizer } from '@/core/performance/aiOptimizer';
import { autoScaler } from '@/core/reliability/autoScaler';
import { timelineEngine } from './timelineEngine';
import { fireworkEngine } from './fireworkEngine';

export type FXKConfig = {
  environment?: boolean;
  cluster?: boolean;
  clusterRole?: 'master' | 'client';
  clusterWsUrl?: string;
  unreal?: boolean;
  unrealEndpoint?: string;
  ai?: boolean;
  autoScale?: boolean;
  coordinates?: { lat: number; lng: number };
};

export type EngineState = 'stopped' | 'running' | 'degraded';

const SUBSYSTEM_ID: SubsystemId = 'environment';

class FXKEngine {
  private _state: EngineState = 'stopped';
  private _config: FXKConfig = {};
  private _startTime = 0;
  private _tickCount = 0;
  private _listeners = new Set<(state: EngineState) => void>();

  /** Boot all configured subsystems */
  start(config: FXKConfig = {}): void {
    if (this._state === 'running') return;
    this._config = config;
    this._startTime = performance.now();
    this._tickCount = 0;

    console.log('[FXK] Starting engine…');

    try {
      // 🌍 Environment
      if (config.environment) {
        environmentEngine.start(config.coordinates?.lat, config.coordinates?.lng);
      }

      // 🌐 Cluster sync
      if (config.cluster) {
        clusterSync.start(config.clusterRole ?? 'master', config.clusterWsUrl);
      }

      // 🎬 Unreal bridge
      if (config.unreal && config.unrealEndpoint) {
        unrealBridge.connect(config.unrealEndpoint);
      }

      // 🧠 AI optimizer
      if (config.ai) {
        aiOptimizer.start();
      }

      this._state = 'running';
      this.notify();
      console.log('[FXK] Engine started ✓');
    } catch (e) {
      console.error('[FXK] Startup failed:', e);
      this._state = 'degraded';
      this.notify();
    }
  }

  /** Shutdown all subsystems cleanly */
  stop(): void {
    console.log('[FXK] Stopping engine…');
    environmentEngine.stop();
    clusterSync.stop();
    unrealBridge.disconnect();
    aiOptimizer.stop();
    this._state = 'stopped';
    this.notify();
  }

  /**
   * Master tick — called from useFrame at 60Hz.
   * Drives environment interpolation, timeline, fireworks, AI feed, auto-scale.
   */
  tick(delta: number): void {
    if (this._state === 'stopped') return;
    this._tickCount++;

    try {
      // ⏱️ Timeline
      timelineEngine.tick(delta);

      // 🌍 Environment interpolation
      const env = environmentEngine.tick();

      // 🎆 Fireworks physics (wind from environment)
      fireworkEngine.tick(delta, env.windVector);

      // 🧠 AI optimizer feed (at ~2Hz = every 30 frames)
      if (this._config.ai && this._tickCount % 30 === 0) {
        aiOptimizer.feed({
          fps: 1 / Math.max(delta, 0.001),
          fpsP95: 0,
          fpsP99: 0,
          errorRate: 0,
          tileLoadTimeMs: 0,
          cameraStability: 1,
          networkLatencyMs: 0,
          drawCalls: 0,
          triangles: 0,
          activeParticles: fireworkEngine.getActive().length,
        });
      }

      // ⚙️ Auto-scaler
      if (this._config.autoScale) {
        autoScaler.tick(1 / Math.max(delta, 0.001));
      }

      // Recover from degraded if tick succeeds
      if (this._state === 'degraded') {
        this._state = 'running';
        this.notify();
      }
    } catch (e) {
      autoHeal.reportFailure(SUBSYSTEM_ID, String(e));
      if (this._state !== 'degraded') {
        this._state = 'degraded';
        this.notify();
      }
    }
  }

  getState(): EngineState { return this._state; }
  getConfig(): FXKConfig { return { ...this._config }; }

  getStatus() {
    return {
      state: this._state,
      uptime: (performance.now() - this._startTime) / 1000,
      ticks: this._tickCount,
      timeline: timelineEngine.getState(),
      environment: this._config.environment ? environmentEngine.getState() : null,
      cluster: this._config.cluster ? clusterSync.getState() : null,
      unreal: this._config.unreal ? unrealBridge.getState() : null,
      scaler: autoScaler.getState(),
    };
  }

  onChange(cb: (state: EngineState) => void): () => void {
    this._listeners.add(cb);
    return () => this._listeners.delete(cb);
  }

  private notify(): void {
    for (const cb of this._listeners) {
      try { cb(this._state); } catch { /* no-op */ }
    }
  }
}

export const fxkEngine = new FXKEngine();
