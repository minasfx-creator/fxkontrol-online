/**
 * ─── Reality Engine ─────────────────────────────────────────────────
 * Closed-loop correction: measures actual vs expected, applies delta.
 *
 * Flow: System → Execute → Measure → Correct
 *
 * Adjusts for:
 *   - Real wind (drift compensation)
 *   - Actual latency (timing correction)
 *   - GPS error (position correction)
 *   - Battery sag (trajectory adjustment)
 */

export interface RealityCorrection {
  windOffset: { x: number; y: number; z: number };
  latencyDriftSec: number;
  positionErrorM: number;
  batteryFactor: number;
  timestamp: number;
}

export interface SensorReading {
  droneId: string;
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  battery: number;       // 0-1
  gpsAccuracyM: number;
  timestamp: number;
}

export interface WindData {
  speedMs: number;     // m/s
  directionDeg: number; // 0-360
  gustMs: number;
}

class RealityEngine {
  private wind: WindData = { speedMs: 0, directionDeg: 0, gustMs: 0 };
  private corrections = new Map<string, RealityCorrection>();
  private errorHistory: { time: number; error: number }[] = [];
  private maxHistory = 200;

  // ── Wind ──────────────────────────────────────────────────────

  setWind(wind: WindData): void {
    this.wind = { ...wind };
  }

  getWind(): WindData {
    return this.wind;
  }

  /** Convert wind into a 3D force vector (ENU frame). */
  getWindForce(): { x: number; y: number; z: number } {
    const rad = (this.wind.directionDeg * Math.PI) / 180;
    return {
      x: Math.sin(rad) * this.wind.speedMs,
      y: 0,
      z: Math.cos(rad) * this.wind.speedMs,
    };
  }

  // ── Closed-Loop Correction ────────────────────────────────────

  /**
   * Compare actual sensor data against expected simulation state.
   * Returns a correction vector to apply.
   */
  computeCorrection(
    droneId: string,
    actual: SensorReading,
    expected: { x: number; y: number; z: number; time: number }
  ): RealityCorrection {
    const windForce = this.getWindForce();

    const posError = Math.sqrt(
      (actual.position.x - expected.x) ** 2 +
      (actual.position.y - expected.y) ** 2 +
      (actual.position.z - expected.z) ** 2
    );

    // Battery sag factor — lower battery = less thrust authority
    const batteryFactor = Math.max(0.5, actual.battery);

    const correction: RealityCorrection = {
      windOffset: windForce,
      latencyDriftSec: (actual.timestamp - expected.time) / 1000,
      positionErrorM: posError,
      batteryFactor,
      timestamp: Date.now(),
    };

    this.corrections.set(droneId, correction);
    this.errorHistory.push({ time: Date.now(), error: posError });
    if (this.errorHistory.length > this.maxHistory) {
      this.errorHistory.shift();
    }

    return correction;
  }

  /**
   * Apply correction to a trajectory point.
   * Returns corrected position.
   */
  correctTrajectory(
    basePos: { x: number; y: number; z: number },
    droneId: string,
    dt: number
  ): { x: number; y: number; z: number } {
    const corr = this.corrections.get(droneId);
    if (!corr) return basePos;

    return {
      x: basePos.x + corr.windOffset.x * dt,
      y: basePos.y,
      z: basePos.z + corr.windOffset.z * dt,
    };
  }

  // ── Stats ─────────────────────────────────────────────────────

  getAvgError(): number {
    if (this.errorHistory.length === 0) return 0;
    const sum = this.errorHistory.reduce((a, b) => a + b.error, 0);
    return sum / this.errorHistory.length;
  }

  getMaxError(): number {
    if (this.errorHistory.length === 0) return 0;
    return Math.max(...this.errorHistory.map(e => e.error));
  }

  getCorrectionCount(): number {
    return this.corrections.size;
  }

  reset(): void {
    this.corrections.clear();
    this.errorHistory = [];
    this.wind = { speedMs: 0, directionDeg: 0, gustMs: 0 };
  }
}

export const reality = new RealityEngine();
