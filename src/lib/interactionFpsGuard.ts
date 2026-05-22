/**
 * Interaction FPS guard — sets <html data-interacting="true"> while the
 * user is actively scrolling, wheeling, or dragging, then clears it 200ms
 * after the last event.
 *
 * Why this matters for `backdrop-filter`:
 *   - The cost of a blurred surface is paid *per composited frame* — the
 *     compositor must re-sample every pixel under the blurred element
 *     and convolve it with the blur kernel. At 60fps with multiple
 *     32-60px blurs (Dock + Sidebar + Header + popovers) on a busy
 *     timeline page, this can saturate the GPU and drop scroll to 30fps.
 *   - But during scroll/drag, the blurred chrome is *also moving* with
 *     the page contents (well, it isn't — it's fixed — but the contents
 *     under it are scrolling fast, so the blur sample changes every
 *     frame anyway). The visual difference between "blurred" and
 *     "slightly translucent" during a 200ms scroll burst is
 *     imperceptible — but the FPS gain is huge.
 *
 * CSS reacts via the `[data-interacting="true"]` selector — see
 * index.css "Interaction-time blur suspension" block.
 *
 * Listeners are passive and cheap: one per event type on `window`.
 * No allocations in the hot path; just a single `setTimeout` reset.
 */

let idleTimer: ReturnType<typeof setTimeout> | null = null;
let installed = false;

const IDLE_MS = 200;

function markInteracting(): void {
  if (typeof document === 'undefined') return;
  if (idleTimer === null) {
    // Transition into interacting state — toggle the attribute once.
    document.documentElement.dataset.interacting = 'true';
  } else {
    clearTimeout(idleTimer);
  }
  idleTimer = setTimeout(() => {
    document.documentElement.removeAttribute('data-interacting');
    idleTimer = null;
  }, IDLE_MS);
}

/**
 * Install the global interaction listeners. Idempotent — safe to call
 * multiple times. Returns a teardown function for tests / hot-reload.
 */
export function installInteractionFpsGuard(): () => void {
  if (installed || typeof window === 'undefined') return () => {};
  installed = true;

  // `passive: true` — never preventDefault, lets the browser keep scroll
  // off the main thread for free.
  const opts: AddEventListenerOptions = { passive: true, capture: true };

  window.addEventListener('scroll', markInteracting, opts);
  window.addEventListener('wheel', markInteracting, opts);
  window.addEventListener('touchmove', markInteracting, opts);
  window.addEventListener('pointermove', markInteractingDuringDrag, opts);

  return () => {
    window.removeEventListener('scroll', markInteracting, opts);
    window.removeEventListener('wheel', markInteracting, opts);
    window.removeEventListener('touchmove', markInteracting, opts);
    window.removeEventListener('pointermove', markInteractingDuringDrag, opts);
    if (idleTimer !== null) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
    document.documentElement.removeAttribute('data-interacting');
    installed = false;
  };
}

// Pointer move fires constantly even when no button is pressed. We only
// care about drags (timeline scrub, slider drag, etc.) — buttons & 0 means
// no button, in which case we skip to avoid pinning the flag perpetually
// while the cursor wanders.
function markInteractingDuringDrag(e: PointerEvent): void {
  if (e.buttons === 0) return;
  markInteracting();
}
