/**
 * playAudioWithRetry — robust `HTMLAudioElement.play()` with exponential
 * backoff and user-gesture rescue.
 *
 * Why this exists
 *   Browsers reject `audio.play()` for several distinct reasons that all
 *   look the same to the operator ("Play didn't do anything; the timeline
 *   is stuck at 0"):
 *
 *     • NotAllowedError — autoplay policy: the page hasn't received a
 *       qualifying user gesture yet (common after a hot-reload, after
 *       navigating between routes, or when the editor mounts before the
 *       operator has clicked anywhere).
 *     • AbortError      — `audio.pause()` raced with the in-flight `play()`
 *       (very common on rapid Play/Pause toggling).
 *     • NotSupportedError / decode failures — usually permanent for the
 *       current source.
 *
 *   The first two are recoverable. This helper retries with exponential
 *   backoff and, for autoplay rejection, additionally listens for the next
 *   user gesture and retries the moment the gesture lands so playback
 *   starts the instant the policy is satisfied.
 *
 * Behaviour
 *   - Returns a controller with `cancel()` so the caller can abort if the
 *     operator pauses again before the retries succeed.
 *   - Calls `onSuccess()` on the first successful start.
 *   - Calls `onPermanentFailure(error)` once retries are exhausted or the
 *     browser reports a non-recoverable error.
 *   - Calls `onAwaitingGesture()` when we detect autoplay rejection and
 *     start waiting for the operator to interact (so the UI can prompt them).
 */

const RECOVERABLE_ERRORS = new Set(['NotAllowedError', 'AbortError']);
/** Explicit retry schedule (ms) — exponential backoff, total ≈ 3.5 s. */
const RETRY_DELAYS_MS = [120, 250, 500, 1000, 1700];
/** Gestures that "unlock" the autoplay policy in evergreen browsers. */
const GESTURE_EVENTS = ['pointerdown', 'keydown', 'touchend'] as const;

export interface PlayWithRetryOptions {
  onSuccess?: () => void;
  onPermanentFailure?: (err: unknown) => void;
  onAwaitingGesture?: () => void;
  /** Override the default retry delays (testing). */
  delaysMs?: number[];
}

export interface PlayController {
  /** Stop pending retries / detach gesture listeners. Idempotent. */
  cancel: () => void;
  /** Whether the controller has resolved (success, permanent failure, or cancel). */
  done: () => boolean;
}

export function playAudioWithRetry(
  audio: HTMLAudioElement,
  options: PlayWithRetryOptions = {},
): PlayController {
  const { onSuccess, onPermanentFailure, onAwaitingGesture, delaysMs = RETRY_DELAYS_MS } = options;

  let cancelled = false;
  let resolved = false;
  let timerId: number | null = null;
  let gestureCleanup: (() => void) | null = null;
  let attempt = 0;

  const cleanupGesture = () => {
    if (gestureCleanup) {
      gestureCleanup();
      gestureCleanup = null;
    }
  };

  const cancel = () => {
    if (resolved) return;
    cancelled = true;
    resolved = true;
    if (timerId !== null) {
      window.clearTimeout(timerId);
      timerId = null;
    }
    cleanupGesture();
  };

  const succeed = () => {
    if (resolved) return;
    resolved = true;
    cleanupGesture();
    onSuccess?.();
  };

  const fail = (err: unknown) => {
    if (resolved) return;
    resolved = true;
    cleanupGesture();
    onPermanentFailure?.(err);
  };

  const tryPlay = () => {
    if (cancelled || resolved) return;
    // If the source disappeared mid-retry, treat as permanent failure.
    if (!audio.src && !audio.srcObject) {
      fail(new Error('Audio source was cleared before playback could start.'));
      return;
    }
    audio.play().then(
      () => succeed(),
      (err: unknown) => {
        if (cancelled || resolved) return;
        const name = (err as { name?: string } | null)?.name ?? '';

        // Autoplay rejection — wait for the next user gesture and retry then,
        // *in addition* to the timed backoff. The first to fire wins.
        if (name === 'NotAllowedError' && !gestureCleanup) {
          onAwaitingGesture?.();
          const handler = () => {
            cleanupGesture();
            // Reset attempt counter so the timed backoff doesn't immediately
            // declare permanent failure right after the gesture-driven retry.
            attempt = 0;
            tryPlay();
          };
          for (const ev of GESTURE_EVENTS) {
            window.addEventListener(ev, handler, { once: true, capture: true });
          }
          gestureCleanup = () => {
            for (const ev of GESTURE_EVENTS) {
              window.removeEventListener(ev, handler, { capture: true } as EventListenerOptions);
            }
          };
        }

        if (!RECOVERABLE_ERRORS.has(name) || attempt >= delaysMs.length) {
          // For autoplay rejection we keep waiting on the gesture listener
          // even after the timed retries are exhausted, so the operator can
          // still recover by clicking anywhere. In every other case, give up.
          if (name === 'NotAllowedError' && gestureCleanup) return;
          fail(err);
          return;
        }

        const delay = delaysMs[attempt];
        attempt += 1;
        timerId = window.setTimeout(() => {
          timerId = null;
          tryPlay();
        }, delay);
      },
    );
  };

  tryPlay();

  return {
    cancel,
    done: () => resolved,
  };
}
