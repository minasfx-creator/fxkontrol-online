/**
 * ─── Simulation Dry-Run ─────────────────────────────────────────────
 * Pure, deterministic playback simulator for a ShowPlan in
 * `simulation` workMode. NO Three.js, NO CommandBus, NO hardware.
 *
 * Used by Fase 1 to certify that a ShowPlan is consumable by the
 * cinematic play-loop without any side-effect, and to feed the
 * UI panel in `/dev/libertadores` with frame-by-frame stats:
 *   • cues fired (advisory)
 *   • peak concurrent burns
 *   • average instantaneous load (cues/sec)
 *   • channel-reuse interlock breaches (mirror of inspector)
 *
 * Honesty:
 *   - This module NEVER calls uiCommandGateway, fieldBus, executor.
 *   - "FIRE" here means "the simulator advanced its internal clock past
 *     the cue start time"; it is purely advisory rendering data.
 *   - Result is deterministic given the same ShowPlan + tickHz.
 */

import type { ShowPlan } from '@/core/showplan/ShowPlan';

export interface DryRunOptions {
  /** Simulation tick rate. 60Hz mirrors the render loop. */
  tickHz?: number;
  /** Hard cap on simulated seconds (safety against infinite plans). */
  maxSeconds?: number;
}

export interface DryRunFrame {
  t: number;
  activeBurns: number;
  cuesFiredThisFrame: number;
}

export interface DryRunResult {
  durationS: number;
  totalCues: number;
  cuesFired: number;
  peakConcurrentBurns: number;
  avgLoadCuesPerSec: number;
  framesSampled: number;
  /** Channels that re-fired in <1.0s window (mirrors inspector). */
  interlockBreaches: { channel: string; gapS: number }[];
  /** Sparse trace, max 240 frames for UI. */
  trace: DryRunFrame[];
}

interface ScheduledCue {
  t: number;
  durationS: number;
  channel: string;
}

const DEFAULT_BURN_S = 1.2; // visual burn proxy when item has no duration

function buildSchedule(sp: ShowPlan): ScheduledCue[] {
  const out: ScheduledCue[] = [];
  for (const item of sp.timeline ?? []) {
    const t = Number(item.startTime ?? 0);
    if (!Number.isFinite(t) || t < 0) continue;
    const dur = Number((item as { duration?: number }).duration ?? DEFAULT_BURN_S);
    const ch =
      (item as { channelId?: string; pinId?: string; positionId?: string }).channelId ??
      (item as { pinId?: string }).pinId ??
      (item as { positionId?: string }).positionId ??
      'unassigned';
    out.push({ t, durationS: Math.max(0.05, dur), channel: String(ch) });
  }
  out.sort((a, b) => a.t - b.t);
  return out;
}

export function simulationDryRun(
  sp: ShowPlan,
  opts: DryRunOptions = {},
): DryRunResult {
  const tickHz = Math.max(1, Math.min(240, opts.tickHz ?? 60));
  const maxSeconds = Math.max(1, Math.min(7200, opts.maxSeconds ?? 600));
  const dt = 1 / tickHz;

  const sched = buildSchedule(sp);
  const planDuration = Math.min(
    maxSeconds,
    Math.max(
      sp.duration ?? 0,
      sched.reduce((m, c) => Math.max(m, c.t + c.durationS), 0),
    ),
  );

  // Channel reuse audit
  const lastFireByChannel = new Map<string, number>();
  const interlockBreaches: { channel: string; gapS: number }[] = [];
  for (const c of sched) {
    const prev = lastFireByChannel.get(c.channel);
    if (prev != null) {
      const gap = c.t - prev;
      if (gap < 1.0) interlockBreaches.push({ channel: c.channel, gapS: gap });
    }
    lastFireByChannel.set(c.channel, c.t);
  }

  // Frame walk
  const totalFrames = Math.max(1, Math.ceil(planDuration * tickHz));
  const traceStride = Math.max(1, Math.floor(totalFrames / 240));
  const trace: DryRunFrame[] = [];

  let cursor = 0;
  let cuesFired = 0;
  let peakConcurrent = 0;
  let loadAccum = 0;

  // Active burn ring: ends sorted ascending
  const ends: number[] = [];

  for (let f = 0; f < totalFrames; f++) {
    const t = f * dt;
    let firedThisFrame = 0;

    while (cursor < sched.length && sched[cursor].t <= t) {
      const c = sched[cursor++];
      // insertion-sort end time
      const endT = c.t + c.durationS;
      let i = ends.length;
      while (i > 0 && ends[i - 1] > endT) i--;
      ends.splice(i, 0, endT);
      firedThisFrame++;
      cuesFired++;
    }
    // expire burns
    while (ends.length > 0 && ends[0] <= t) ends.shift();

    if (ends.length > peakConcurrent) peakConcurrent = ends.length;
    loadAccum += firedThisFrame;

    if (f % traceStride === 0) {
      trace.push({
        t,
        activeBurns: ends.length,
        cuesFiredThisFrame: firedThisFrame,
      });
    }
  }

  return {
    durationS: planDuration,
    totalCues: sched.length,
    cuesFired,
    peakConcurrentBurns: peakConcurrent,
    avgLoadCuesPerSec: planDuration > 0 ? loadAccum / planDuration : 0,
    framesSampled: totalFrames,
    interlockBreaches,
    trace,
  };
}
