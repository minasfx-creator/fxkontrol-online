/**
 * ─── Latency Compensator ────────────────────────────────────────────
 * Per-site RTT tracking with rolling window median.
 * Adjusts cue fire times for pyro/drone/DMX based on measured latency
 * and configured hardware delay per site.
 */

export interface SiteLatencyProfile {
  siteId: string;
  samples: number[];       // last N RTT values in ms
  medianRtt: number;
  compensation: number;    // medianRtt / 2
  hardwareDelay: number;   // site-specific hardware delay in ms
}

export interface CompensatedTime {
  original: number;        // seconds
  adjusted: number;        // seconds (earlier by compensation)
  compensationMs: number;  // total compensation applied in ms
}

const MAX_SAMPLES = 20;

class LatencyCompensator {
  private _profiles = new Map<string, SiteLatencyProfile>();

  // ── Profile Management ─────────────────────────────────────────

  registerSite(siteId: string, hardwareDelayMs = 0): void {
    this._profiles.set(siteId, {
      siteId,
      samples: [],
      medianRtt: 0,
      compensation: 0,
      hardwareDelay: hardwareDelayMs,
    });
  }

  removeSite(siteId: string): void {
    this._profiles.delete(siteId);
  }

  setHardwareDelay(siteId: string, delayMs: number): void {
    const p = this._profiles.get(siteId);
    if (p) p.hardwareDelay = delayMs;
  }

  // ── RTT Sampling ──────────────────────────────────────────────

  recordRtt(siteId: string, rttMs: number): void {
    const p = this._profiles.get(siteId);
    if (!p) return;

    p.samples.push(rttMs);
    if (p.samples.length > MAX_SAMPLES) {
      p.samples.shift();
    }

    p.medianRtt = this._median(p.samples);
    p.compensation = p.medianRtt / 2;
  }

  // ── Compensation Queries ──────────────────────────────────────

  getCompensation(siteId: string): number {
    const p = this._profiles.get(siteId);
    return p ? p.compensation : 0;
  }

  getTotalCompensation(siteId: string): number {
    const p = this._profiles.get(siteId);
    return p ? p.compensation + p.hardwareDelay : 0;
  }

  /**
   * Returns the adjusted fire time for a cue, accounting for
   * network latency and hardware delay.
   * Time unit: seconds (matching timeline).
   */
  getAdjustedFireTime(cueTimeSec: number, siteId: string): CompensatedTime {
    const totalMs = this.getTotalCompensation(siteId);
    const adjusted = cueTimeSec - (totalMs / 1000);
    return {
      original: cueTimeSec,
      adjusted: Math.max(0, adjusted),
      compensationMs: totalMs,
    };
  }

  // ── Batch adjustment for validation ───────────────────────────

  getAdjustedTimeline(
    cues: Array<{ id: string; time: number }>,
    siteId: string
  ): Array<{ id: string; original: number; adjusted: number; compensationMs: number }> {
    return cues.map(cue => {
      const ct = this.getAdjustedFireTime(cue.time, siteId);
      return { id: cue.id, ...ct };
    });
  }

  // ── Profile Access ────────────────────────────────────────────

  getProfile(siteId: string): Readonly<SiteLatencyProfile> | undefined {
    return this._profiles.get(siteId);
  }

  getAllProfiles(): SiteLatencyProfile[] {
    return Array.from(this._profiles.values());
  }

  // ── Internal ──────────────────────────────────────────────────

  private _median(arr: number[]): number {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }
}

export const latencyCompensator = new LatencyCompensator();
