/**
 * audioMasterRegistry — module-level handle to the currently mounted
 * `<audio>` element that drives the timeline.
 *
 * Why a registry instead of prop-drilling
 *   The audio element lives inside `<AudioWaveform>` (the panel that owns
 *   the waveform UI), but several global UX affordances need to talk to it
 *   directly without being re-mounted every time the operator hides the
 *   panel:
 *     • the "Resync timeline" toolbar button below;
 *     • the watchdog's recovery path (see `useTimelineClockHealthCheck`);
 *     • future remote-control / JOI commands.
 *
 *   This module exposes a tiny imperative surface — `register`, `clear`,
 *   `getAudio`, `getController` — and a single high-level operation,
 *   `resyncTimeline()`, that performs the canonical "snap clock to audio,
 *   restart playback if needed" recovery used both by the watchdog and by
 *   the UI button.
 *
 *   It is intentionally not a React hook so it can be invoked from non-React
 *   call sites (event handlers in vanilla code paths, the lockstep watchdog,
 *   keybinding handlers, etc.).
 */
import { toast } from 'sonner';
import { timelineClock } from '@/core/timeline/TimelineClock';
import { lockstep } from '@/core/reliability/lockstepEngine';
import { playAudioWithRetry, type PlayController } from '@/lib/audio/playAudioWithRetry';
import { useProjectStore } from '@/store/useProjectStore';
import {
  startDriftCorrection,
  cancelDriftCorrection,
} from '@/core/health/timelineDriftCorrector';

const PLAYBACK_SUBSYSTEM_ID = 'playback';

interface RegisteredAudio {
  audio: HTMLAudioElement;
  /** Exposed by AudioWaveform so resync can cancel its own retry controller
   *  before issuing a fresh `playAudioWithRetry` call. */
  cancelActivePlay: () => void;
}

let registered: RegisteredAudio | null = null;
let activeResyncController: PlayController | null = null;

export function registerAudioMaster(entry: RegisteredAudio): () => void {
  registered = entry;
  return () => {
    if (registered === entry) registered = null;
    activeResyncController?.cancel();
    activeResyncController = null;
  };
}

export function getAudioMaster(): HTMLAudioElement | null {
  return registered?.audio ?? null;
}

export interface ResyncOptions {
  /** Show feedback toasts. Defaults to true; the watchdog passes false to
   *  avoid stacking on top of its own "Playback recovered" message. */
  surfaceToasts?: boolean;
  /** Optional reason string included in the toast for context. */
  reason?: string;
  /** When true, glide the timeline to `audio.currentTime` over `softAlignMs`
   *  using the drift corrector instead of hard-seeking. Eliminates the
   *  visible jump on the playhead / 3D viewport after a recovery. */
  softAlign?: boolean;
  /** Ramp duration for `softAlign`, in ms. Ignored when `softAlign` is false. */
  softAlignMs?: number;
}

export interface ResyncResult {
  ok: boolean;
  reason: 'no-audio' | 'snapped' | 'glided' | 'restarted' | 'failed';
  detail?: string;
}

/**
 * Re-lock `timelineClock` to `audio.currentTime` and resume playback if the
 * operator is in a Play state.
 *
 * Steps:
 *   1. Cancel any in-flight `playAudioWithRetry` controller so we start
 *      from a clean slate.
 *   2. Release any external-sync claim on the timeline (the audio master
 *      will reclaim it via the next `useAudioMasterClock` RAF if/when it
 *      starts advancing).
 *   3. Re-enable the lockstep `'playback'` subsystem so the local clock
 *      always has a fallback driver immediately after the resync.
 *   4. Snap `timelineClock.time` to `audio.currentTime` (or 0 if the audio
 *      hasn't advanced yet).
 *   5. If the store says we should be playing, fire a fresh
 *      `playAudioWithRetry` so an autoplay-blocked or stalled audio gets
 *      another chance and the operator sees the timeline move.
 */
export function resyncTimeline(options: ResyncOptions = {}): ResyncResult {
  const { surfaceToasts = true, reason, softAlign = false, softAlignMs } = options;
  const entry = registered;
  if (!entry) {
    if (surfaceToasts) {
      toast.message('Nothing to resync', {
        description: 'No audio is currently driving the timeline.',
      });
    }
    return { ok: false, reason: 'no-audio' };
  }

  const { audio, cancelActivePlay } = entry;
  const isPlaying = useProjectStore.getState().isPlaying;

  // 1+2+3 — clean state. Cancel any in-flight drift correction too: a fresh
  // resync supersedes whatever ramp was running.
  cancelActivePlay();
  cancelDriftCorrection();
  activeResyncController?.cancel();
  activeResyncController = null;
  timelineClock.releaseExternalSync();
  lockstep.setEnabled(PLAYBACK_SUBSYSTEM_ID, true);

  // 4 — align clock to audio. Hard snap by default; soft glide when the
  // caller (typically the watchdog after a stall) wants to absorb the offset
  // gracefully so the operator never sees a jump on the playhead.
  const target = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
  let aligned: 'snapped' | 'glided' = 'snapped';
  if (softAlign) {
    const result = startDriftCorrection({
      // Track the audio live during the ramp so we catch up to a *moving*
      // target rather than a frozen sample.
      getTarget: () => (Number.isFinite(audio.currentTime) ? audio.currentTime : target),
      durationMs: softAlignMs,
    });
    if (result === 'started') {
      aligned = 'glided';
    } else {
      // 'skipped' (offset under threshold), 'hard-seek' (offset > 3s), or
      // 'disabled' all already left the clock in a sane state — nothing more
      // to do here. Report as snapped so the operator sees a stable label.
      aligned = 'snapped';
    }
  } else {
    timelineClock.seek(target);
  }

  // 5 — if we're not in a Play state we just aligned and we're done.
  if (!isPlaying) {
    if (surfaceToasts) {
      toast.success('Timeline resynced', {
        description:
          reason ??
          (aligned === 'glided'
            ? `Gliding clock to ${target.toFixed(2)}s.`
            : `Snapped clock to ${target.toFixed(2)}s.`),
      });
    }
    return { ok: true, reason: aligned };
  }

  // 5b — restart playback with retry. The success / awaiting-gesture /
  // failure callbacks mirror the AudioWaveform integration so the operator
  // gets the same feedback regardless of which surface triggered the resync.
  let gestureToastId: string | number | undefined;
  activeResyncController = playAudioWithRetry(audio, {
    onSuccess: () => {
      if (gestureToastId !== undefined) toast.dismiss(gestureToastId);
      if (surfaceToasts) {
        toast.success('Timeline resynced', {
          description: reason ?? `Audio resumed at ${audio.currentTime.toFixed(2)}s.`,
        });
      }
    },
    onAwaitingGesture: () => {
      gestureToastId = toast.warning('Tap to resume audio', {
        description: 'Browser blocked playback. Click anywhere to continue.',
        duration: Infinity,
      });
    },
    onPermanentFailure: (err) => {
      if (gestureToastId !== undefined) toast.dismiss(gestureToastId);
      if (surfaceToasts) {
        const message = (err as { message?: string } | null)?.message ?? 'Audio could not resume.';
        toast.error('Resync failed', { description: message });
      }
      console.warn('[audioMasterRegistry] resync play retries exhausted:', err);
    },
  });

  return { ok: true, reason: 'restarted' };
}
