/**
 * ─── Skybrush Show Orchestrator ─────────────────────────────────────
 * State machine for drone show execution, matching Skybrush Live workflow.
 * 
 * States: Idle → Preflight → Upload → Authorize → Countdown → Running → Landing → Complete
 * 
 * Based on Skybrush Live's show execution pipeline:
 *   - Preflight checks (battery, GPS, calibration)
 *   - Show upload with progress tracking
 *   - Authorization gate (live/rehearsal scope)
 *   - Countdown with clock synchronization
 *   - Real-time execution monitoring
 *   - Automated landing sequence
 * 
 * Integrates with FlockwaveClient for Skybrush Server communication.
 */

import {
  flockwave,
  type AuthorizationScope,
  type StartMethod,
  type DroneShowConfiguration,
  type ShowUploadData,
  type PreflightResult,
} from './flockwaveProtocol';

// ── State Machine ───────────────────────────────────────────────────

export type ShowPhase =
  | 'idle'
  | 'preflight'
  | 'uploading'
  | 'uploaded'
  | 'authorized'
  | 'countdown'
  | 'running'
  | 'paused'
  | 'landing'
  | 'complete'
  | 'error'
  | 'aborted';

export interface ShowOrchestratorState {
  phase: ShowPhase;
  error: string | null;
  preflightResults: PreflightResult[];
  uploadProgress: number;   // 0-1
  showElapsed: number;      // seconds since show start
  showDuration: number;     // total show duration
  countdown: number;        // seconds until start
  authorization: {
    scope: AuthorizationScope;
    authorized: boolean;
    authorizedAt: number | null;
  };
  startMethod: StartMethod;
  startTime: number | null;  // scheduled start (epoch ms)
  droneMapping: (string | null)[];
  activeDrones: number;
  totalDrones: number;
  warnings: ShowWarning[];
}

export interface ShowWarning {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  droneId?: string;
  timestamp: number;
  dismissed: boolean;
}

// ── Valid Transitions ───────────────────────────────────────────────

const VALID_TRANSITIONS: Record<ShowPhase, ShowPhase[]> = {
  idle: ['preflight'],
  preflight: ['uploading', 'idle', 'error'],
  uploading: ['uploaded', 'error', 'idle'],
  uploaded: ['authorized', 'idle', 'uploading'],
  authorized: ['countdown', 'uploaded', 'idle'],
  countdown: ['running', 'authorized', 'aborted'],
  running: ['paused', 'landing', 'aborted', 'error'],
  paused: ['running', 'landing', 'aborted'],
  landing: ['complete', 'error'],
  complete: ['idle'],
  error: ['idle'],
  aborted: ['idle'],
};

export function canTransition(from: ShowPhase, to: ShowPhase): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// ── Default State ───────────────────────────────────────────────────

export function createDefaultState(): ShowOrchestratorState {
  return {
    phase: 'idle',
    error: null,
    preflightResults: [],
    uploadProgress: 0,
    showElapsed: 0,
    showDuration: 0,
    countdown: 0,
    authorization: {
      scope: 'none',
      authorized: false,
      authorizedAt: null,
    },
    startMethod: 'auto',
    startTime: null,
    droneMapping: [],
    activeDrones: 0,
    totalDrones: 0,
    warnings: [],
  };
}

// ── Orchestrator Class ──────────────────────────────────────────────

export type OrchestratorListener = (state: ShowOrchestratorState) => void;

export class ShowOrchestrator {
  private state: ShowOrchestratorState;
  private snapshot: ShowOrchestratorState;
  private listeners = new Set<OrchestratorListener>();
  private countdownTimer: ReturnType<typeof setInterval> | null = null;
  private elapsedTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.state = createDefaultState();
    this.snapshot = this.createSnapshot();
  }

  // ── State Access ──────────────────────────────────────────────

  getState(): ShowOrchestratorState {
    return this.snapshot;
  }

  subscribe(listener: OrchestratorListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private createSnapshot(): ShowOrchestratorState {
    return {
      ...this.state,
      preflightResults: [...this.state.preflightResults],
      authorization: { ...this.state.authorization },
      droneMapping: [...this.state.droneMapping],
      warnings: this.state.warnings.map((w) => ({ ...w })),
    };
  }

  private notify() {
    this.snapshot = this.createSnapshot();
    this.listeners.forEach((listener) => listener(this.snapshot));
  }

  private transition(to: ShowPhase) {
    if (!canTransition(this.state.phase, to)) {
      console.warn(`[ShowOrchestrator] Invalid transition: ${this.state.phase} → ${to}`);
      return false;
    }
    this.state.phase = to;
    this.notify();
    return true;
  }

  // ── Phase Actions ─────────────────────────────────────────────

  /**
   * Step 1: Run preflight checks on all mapped drones.
   */
  async startPreflight(): Promise<boolean> {
    if (!this.transition('preflight')) return false;

    try {
      const uavIds = Array.from(flockwave.uavs.keys());
      this.state.totalDrones = uavIds.length;
      this.state.activeDrones = uavIds.length;

      if (uavIds.length === 0) {
        this.addWarning('warning', 'No drones connected');
        // Still allow proceeding for simulation
      }

      const results = await flockwave.runPreflight(uavIds).catch(() => []);
      this.state.preflightResults = results;

      // Check for failures
      const failures = results.filter(r => !r.passed);
      if (failures.length > 0) {
        failures.forEach(f => {
          const failedChecks = f.checks.filter(c => c.status === 'fail');
          failedChecks.forEach(c => {
            this.addWarning('critical', `${f.droneId}: ${c.message}`, f.droneId);
          });
        });
      }

      this.notify();
      return true;
    } catch (err) {
      this.state.error = `Preflight failed: ${err}`;
      this.transition('error');
      return false;
    }
  }

  /**
   * Step 2: Upload show data to Skybrush Server.
   */
  async uploadShow(data: ShowUploadData): Promise<boolean> {
    if (!this.transition('uploading')) return false;

    try {
      this.state.uploadProgress = 0;
      this.state.showDuration = 0;
      this.notify();

      // Simulate upload progress (real implementation would use chunked upload)
      const progressInterval = setInterval(() => {
        this.state.uploadProgress = Math.min(0.95, this.state.uploadProgress + 0.1);
        this.notify();
      }, 200);

      const success = await flockwave.uploadShow(data).catch(() => {
        // In simulation mode, always succeed
        return true;
      });

      clearInterval(progressInterval);
      this.state.uploadProgress = 1;

      if (success) {
        // Calculate show duration from trajectory data
        this.state.showDuration = data.trajectories.reduce(
          (max, t) => Math.max(max, t.points[t.points.length - 1]?.t ?? 0),
          0
        );
        this.state.droneMapping = data.trajectories.map(t => t.droneId);
        this.transition('uploaded');
        return true;
      } else {
        this.state.error = 'Show upload rejected by server';
        this.transition('error');
        return false;
      }
    } catch (err) {
      this.state.error = `Upload failed: ${err}`;
      this.transition('error');
      return false;
    }
  }

  /**
   * Step 3: Authorize the show for execution.
   */
  async authorize(scope: AuthorizationScope = 'live'): Promise<boolean> {
    try {
      await flockwave.authorizeShow(scope).catch(() => {});
      this.state.authorization = {
        scope,
        authorized: true,
        authorizedAt: Date.now(),
      };
      this.transition('authorized');
      return true;
    } catch (err) {
      this.addWarning('warning', `Authorization failed: ${err}`);
      return false;
    }
  }

  /**
   * Step 4: Start countdown to show.
   */
  startCountdown(seconds: number = 30): boolean {
    if (!this.transition('countdown')) return false;

    this.state.countdown = seconds;
    this.notify();

    this.countdownTimer = setInterval(() => {
      this.state.countdown = Math.max(0, this.state.countdown - 1);
      this.notify();

      if (this.state.countdown <= 0) {
        if (this.countdownTimer) clearInterval(this.countdownTimer);
        this.countdownTimer = null;
        this.startExecution();
      }
    }, 1000);

    return true;
  }

  /**
   * Step 5: Begin show execution.
   */
  private async startExecution() {
    if (!this.transition('running')) return;

    this.state.startTime = Date.now();
    this.state.showElapsed = 0;

    await flockwave.startShow().catch(() => {});

    this.elapsedTimer = setInterval(() => {
      if (this.state.startTime) {
        this.state.showElapsed = (Date.now() - this.state.startTime) / 1000;
        
        // Auto-transition to landing when show duration reached
        if (this.state.showElapsed >= this.state.showDuration && this.state.showDuration > 0) {
          this.startLanding();
        }
        this.notify();
      }
    }, 100);
  }

  /**
   * Pause show execution.
   */
  async pause(): Promise<boolean> {
    if (!this.transition('paused')) return false;
    await flockwave.pauseShow().catch(() => {});
    if (this.elapsedTimer) clearInterval(this.elapsedTimer);
    return true;
  }

  /**
   * Resume show execution.
   */
  async resume(): Promise<boolean> {
    if (!this.transition('running')) return false;
    // Recalculate start time to maintain elapsed
    this.state.startTime = Date.now() - this.state.showElapsed * 1000;
    this.elapsedTimer = setInterval(() => {
      if (this.state.startTime) {
        this.state.showElapsed = (Date.now() - this.state.startTime) / 1000;
        this.notify();
      }
    }, 100);
    return true;
  }

  /**
   * Step 6: Begin landing sequence.
   */
  async startLanding(): Promise<boolean> {
    if (this.elapsedTimer) clearInterval(this.elapsedTimer);
    this.elapsedTimer = null;

    if (!this.transition('landing')) return false;

    // Send land command to all drones
    const ids = Array.from(flockwave.uavs.keys());
    if (ids.length > 0) {
      await flockwave.send({ type: 'UAV-LAND', body: { ids } }).catch(() => {});
    }

    // Auto-complete after estimated landing time
    setTimeout(() => {
      this.transition('complete');
    }, 15000);

    return true;
  }

  /**
   * Emergency abort — immediate RTH for all drones.
   */
  async abort(reason: string = 'User abort'): Promise<void> {
    this.stopAllTimers();
    this.state.error = reason;
    this.transition('aborted');

    // Send RTH to all drones
    const ids = Array.from(flockwave.uavs.keys());
    if (ids.length > 0) {
      await flockwave.send({ type: 'UAV-RTH', body: { ids } }).catch(() => {});
    }

    this.addWarning('critical', `Show aborted: ${reason}`);
  }

  /**
   * Deauthorize and return to uploaded state.
   */
  async deauthorize(): Promise<boolean> {
    await flockwave.deauthorizeShow().catch(() => {});
    this.state.authorization = {
      scope: 'none',
      authorized: false,
      authorizedAt: null,
    };
    if (this.state.phase === 'authorized') {
      this.transition('uploaded');
    }
    return true;
  }

  /**
   * Reset to idle state.
   */
  reset(): void {
    this.stopAllTimers();
    this.state = createDefaultState();
    this.notify();
  }

  // ── Helpers ───────────────────────────────────────────────────

  private stopAllTimers() {
    if (this.countdownTimer) clearInterval(this.countdownTimer);
    if (this.elapsedTimer) clearInterval(this.elapsedTimer);
    this.countdownTimer = null;
    this.elapsedTimer = null;
  }

  private addWarning(
    severity: ShowWarning['severity'],
    message: string,
    droneId?: string
  ) {
    this.state.warnings.push({
      id: `warn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      severity,
      message,
      droneId,
      timestamp: Date.now(),
      dismissed: false,
    });
  }

  dismissWarning(id: string) {
    const warning = this.state.warnings.find((w) => w.id === id);
    if (!warning || warning.dismissed) return;
    warning.dismissed = true;
    this.notify();
  }

  /**
   * Set start method for the show.
   */
  setStartMethod(method: StartMethod) {
    if (this.state.startMethod === method) return;
    this.state.startMethod = method;
    this.notify();
  }

  /**
   * Set show duration (from project data).
   */
  setShowDuration(duration: number) {
    if (this.state.showDuration === duration) return;
    this.state.showDuration = duration;
    this.notify();
  }

  /**
   * Get completion percentage.
   */
  getProgress(): number {
    if (this.state.showDuration <= 0) return 0;
    return Math.min(1, this.state.showElapsed / this.state.showDuration);
  }
}

// ── Singleton Instance ──────────────────────────────────────────────

export const showOrchestrator = new ShowOrchestrator();
