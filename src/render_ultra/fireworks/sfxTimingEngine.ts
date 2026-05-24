/**
 * FX KONTROL · SFX Timing Engine
 *
 * Maps effectFrameAtlas SfxEvent profiles to actual audio playback commands.
 * Handles acoustic propagation delay (height / 340 m/s), volume scaling by
 * caliber, and loop management.
 *
 * ARCHITECTURE:
 *   - SfxScheduler created per burst event
 *   - tick(dt) checks pending events each frame and fires them
 *   - integrates with Web Audio API via the existing audioMasterRegistry
 *
 * CLIP KEY CONVENTION:
 *   boom_*    — explosive concussion (single shot)
 *   crackle_* — sustained crackle loop
 *   hiss_*    — sustained hiss/white noise
 *   swoosh_*  — whoosh/swoop (rising shell)
 *   whistle_* — whistle (ascending frequency)
 *   snap_*    — sharp transient crack
 */

import {
  getScaledSfxProfile,
  type SfxEvent,
} from './effectFrameAtlas';
import type { BurstPattern } from './burstSimulation';

// ─────────────────────────────────────────────────────────────────────────────
// Audio clip registry — maps clipKey → audio asset URL
// Add entries here when audio files are added to the project.
// ─────────────────────────────────────────────────────────────────────────────

export const SFX_CLIP_REGISTRY: Record<string, string> = {
  // Booms / concussions
  'boom_peony_3in':        '/sfx/boom_peony_3in.mp3',
  'boom_chrysanthemum':    '/sfx/boom_chrysanthemum.mp3',
  'boom_willow':           '/sfx/boom_willow.mp3',
  'boom_kamuro':           '/sfx/boom_kamuro.mp3',
  'boom_palm':             '/sfx/boom_palm.mp3',
  'boom_crossette':        '/sfx/boom_crossette.mp3',
  'boom_brocade':          '/sfx/boom_brocade.mp3',
  'boom_glitter':          '/sfx/boom_glitter.mp3',
  'boom_crackle':          '/sfx/boom_crackle.mp3',
  'boom_time_rain':        '/sfx/boom_peony_3in.mp3',  // reuse
  'boom_horsetail':        '/sfx/boom_willow.mp3',
  'boom_saturn':           '/sfx/boom_peony_3in.mp3',
  'boom_spider':           '/sfx/boom_crossette.mp3',
  'boom_ring':             '/sfx/boom_peony_3in.mp3',
  'boom_dahlia':           '/sfx/boom_kamuro.mp3',
  'boom_coconut':          '/sfx/boom_willow.mp3',
  'boom_heart':            '/sfx/boom_peony_3in.mp3',
  'boom_strobe':           '/sfx/boom_peony_3in.mp3',
  'boom_multi_first':      '/sfx/boom_kamuro.mp3',
  'boom_multi_second':     '/sfx/boom_peony_3in.mp3',
  'boom_multi_third':      '/sfx/boom_crossette.mp3',
  'boom_mine_ground':      '/sfx/boom_mine_ground.mp3',
  'boom_candle_shot':      '/sfx/boom_candle_shot.mp3',
  'snap_crossette_break':  '/sfx/snap_crossette_break.mp3',

  // Rising / whoosh
  'swoosh_shell_rise':        '/sfx/swoosh_shell_rise.mp3',
  'swoosh_shell_rise_heavy':  '/sfx/swoosh_shell_rise_heavy.mp3',
  'swoosh_comet':             '/sfx/swoosh_comet.mp3',

  // Crackle loops
  'crackle_light':        '/sfx/crackle_light.mp3',
  'crackle_willow':       '/sfx/crackle_willow.mp3',
  'crackle_brocade':      '/sfx/crackle_brocade.mp3',
  'crackle_glitter_gold': '/sfx/crackle_glitter_gold.mp3',
  'crackle_dragon_egg':   '/sfx/crackle_dragon_egg.mp3',

  // Hiss / sustained
  'hiss_trail_long':      '/sfx/hiss_trail_long.mp3',
  'hiss_cascade':         '/sfx/hiss_cascade.mp3',
  'hiss_rain_gentle':     '/sfx/hiss_rain_gentle.mp3',
  'hiss_gerb':            '/sfx/hiss_gerb.mp3',
  'hiss_candle':          '/sfx/hiss_candle.mp3',
  'hiss_waterfall':       '/sfx/hiss_waterfall.mp3',

  // Whistles
  'whistle_mine':         '/sfx/whistle_mine.mp3',
};

/** True if the audio file for this clip key is expected to exist */
export function clipExists(clipKey: string): boolean {
  return clipKey in SFX_CLIP_REGISTRY;
}

export function getClipUrl(clipKey: string): string | undefined {
  return SFX_CLIP_REGISTRY[clipKey];
}

// ─────────────────────────────────────────────────────────────────────────────
// SFX Scheduler
// ─────────────────────────────────────────────────────────────────────────────

export interface ScheduledSfxEvent {
  event: SfxEvent;
  scheduledAt: number;   // absolute show-time when to fire (seconds)
  fired: boolean;
  audioNode?: AudioBufferSourceNode | null;
}

export interface SfxPlayCommand {
  clipKey: string;
  volume: number;
  loop: boolean;
  duration: number;
  /** Absolute show-time to start (for drift compensation) */
  startTime: number;
}

/** Callback fired when the engine wants to play a clip */
export type SfxPlayCallback = (cmd: SfxPlayCommand) => void;

/** Callback fired when a loop should stop */
export type SfxStopCallback = (clipKey: string, scheduledAt: number) => void;

export class SfxScheduler {
  private _events: ScheduledSfxEvent[] = [];
  private _loopEndEvents: Array<{ clipKey: string; scheduledAt: number; stopAt: number; stopped: boolean }> = [];
  private _age = 0;         // seconds since burst
  private _active = true;

  private _onPlay: SfxPlayCallback;
  private _onStop: SfxStopCallback;

  /**
   * @param patternId    — effect pattern key
   * @param caliberMm    — shell caliber in mm (scales volume + acoustic delay)
   * @param burstHeight  — burst altitude in meters (acoustic propagation delay)
   * @param burstShowTime — absolute show-time of burst (seconds from show start)
   * @param onPlay       — callback to actually play audio
   * @param onStop       — callback to stop a looping clip
   */
  constructor(
    patternId: BurstPattern,
    caliberMm: number,
    burstHeight: number,
    burstShowTime: number,
    onPlay: SfxPlayCallback,
    onStop: SfxStopCallback,
  ) {
    this._onPlay = onPlay;
    this._onStop = onStop;

    const profile = getScaledSfxProfile(patternId, caliberMm, burstHeight);

    for (const ev of profile) {
      const scheduledAt = burstShowTime + ev.tOffset;

      this._events.push({ event: ev, scheduledAt, fired: false });

      if (ev.loop && ev.tEnd !== undefined) {
        this._loopEndEvents.push({
          clipKey: ev.clipKey,
          scheduledAt,
          stopAt: burstShowTime + (ev.tEnd ?? ev.tOffset + ev.duration),
          stopped: false,
        });
      }
    }
  }

  /**
   * Tick the scheduler with current show time.
   * @param showTime — current absolute show time (seconds from start)
   */
  tick(showTime: number): void {
    if (!this._active) return;

    // Fire pending events
    for (const ev of this._events) {
      if (!ev.fired && showTime >= ev.scheduledAt) {
        ev.fired = true;
        if (clipExists(ev.event.clipKey)) {
          this._onPlay({
            clipKey: ev.event.clipKey,
            volume: ev.event.volume,
            loop: ev.event.loop,
            duration: ev.event.duration,
            startTime: ev.scheduledAt,
          });
        }
      }
    }

    // Stop expired loops
    for (const le of this._loopEndEvents) {
      if (!le.stopped && showTime >= le.stopAt) {
        le.stopped = true;
        this._onStop(le.clipKey, le.scheduledAt);
      }
    }

    // Deactivate when all events have fired + all loops stopped
    const allFired = this._events.every(e => e.fired);
    const allLoopsStopped = this._loopEndEvents.every(l => l.stopped);
    if (allFired && allLoopsStopped) {
      this._active = false;
    }
  }

  get isActive(): boolean { return this._active; }

  /** Force-stop all active loops immediately */
  dispose(): void {
    for (const le of this._loopEndEvents) {
      if (!le.stopped) {
        le.stopped = true;
        this._onStop(le.clipKey, le.scheduledAt);
      }
    }
    this._active = false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SFX Manager — manages multiple concurrent schedulers
// ─────────────────────────────────────────────────────────────────────────────

export class SfxManager {
  private _schedulers: SfxScheduler[] = [];
  private _onPlay: SfxPlayCallback;
  private _onStop: SfxStopCallback;
  private _masterVolume = 1.0;

  constructor(onPlay: SfxPlayCallback, onStop: SfxStopCallback) {
    this._onPlay = onPlay;
    this._onStop = onStop;
  }

  get masterVolume(): number { return this._masterVolume; }
  set masterVolume(v: number) { this._masterVolume = Math.max(0, Math.min(1, v)); }

  /**
   * Register a new burst event for SFX scheduling.
   * Returns the scheduler handle (for early disposal if needed).
   */
  registerBurst(
    patternId: BurstPattern,
    caliberMm: number,
    burstHeight: number,
    burstShowTime: number,
  ): SfxScheduler {
    const mv = this._masterVolume;
    const sched = new SfxScheduler(
      patternId, caliberMm, burstHeight, burstShowTime,
      (cmd) => this._onPlay({ ...cmd, volume: cmd.volume * mv }),
      this._onStop,
    );
    this._schedulers.push(sched);
    return sched;
  }

  /**
   * Advance all schedulers to the given show time.
   * Dead schedulers are pruned automatically.
   */
  tick(showTime: number): void {
    for (let i = this._schedulers.length - 1; i >= 0; i--) {
      const s = this._schedulers[i];
      s.tick(showTime);
      if (!s.isActive) this._schedulers.splice(i, 1);
    }
  }

  /** Stop all SFX immediately (e.g. show stop / scrub) */
  stopAll(): void {
    for (const s of this._schedulers) s.dispose();
    this._schedulers.length = 0;
  }

  get activeSchedulerCount(): number { return this._schedulers.length; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Acoustic propagation utilities (re-exported for convenience)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Time for sound from a burst at altitude `h` meters to reach the audience.
 * Assumes flat terrain, sea-level temperature 20°C.
 */
export function acousticPropagationDelay(heightM: number): number {
  return heightM / 340.29;
}

/**
 * Expected visual-to-audio offset for a burst at given height.
 * Positive = audio arrives AFTER the visual flash.
 */
export function visibleToAudioOffsetMs(heightM: number): number {
  return acousticPropagationDelay(heightM) * 1000;
}

/**
 * Perceived loudness (dB SPL) falloff with distance (inverse square law).
 * @param referenceDb  — reference level at referenceDistM
 * @param referenceDistM — reference distance (meters)
 * @param distM        — actual distance to audience
 */
export function dBSPLAtDistance(
  referenceDb: number,
  referenceDistM: number,
  distM: number,
): number {
  if (distM <= 0) return referenceDb;
  return referenceDb - 20 * Math.log10(distM / referenceDistM);
}
