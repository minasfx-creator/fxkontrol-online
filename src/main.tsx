import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initWebVitals as initWebVitalsConsole } from "@/lib/webVitals";
import { initObservability } from "@/observability";
import { installConsoleCapture } from "@/lib/consoleCapture";
import { initRuntimeMonitor } from "@/lib/runtimeMonitor";
import { applyGpuTier } from "@/lib/gpuTier";
import { installInteractionFpsGuard } from "@/lib/interactionFpsGuard";
import { installSafetyJournalBridge } from "@/core/journal/journalBridge";
import { migrateLegacyStores } from "@/stores/migration";

// Install console.error/warn + window error capture as early as possible
// so the Diagnostics panel can replay startup errors.
installConsoleCapture();

// E2E + manual-QA surface. Exposes window.__fxkRuntimeMonitor with
// `mark(name)` / `since(name)` / `snapshot()` so test harnesses can
// assert "no new errors or warnings during scenario X".
initRuntimeMonitor();

// GPU tier detection — writes <html data-gpu-tier="low|high">. Must run
// before first paint so reduced-blur fallbacks are active for the splash.
applyGpuTier();

// Suspends backdrop-filter on heavy chrome during scroll/wheel/drag so
// the timeline + scroll views stay at 60fps regardless of GPU.
installInteractionFpsGuard();

// Consolidated-stores migration (idempotent, gated by feature flag).
// Runs once per session before the first store read in App.
migrateLegacyStores();

// Persist every SafetyStateMachine transition (ARM/DISARM/FIRE/E_STOP/...)
// to public.command_journal. Lives outside React so E_STOP audit trail
// survives even if the React tree crashes.
installSafetyJournalBridge();

createRoot(document.getElementById("root")!).render(<App />);

// Dev-only Web Vitals console reporter (per-route, color-coded).
initWebVitalsConsole();

// Production observability (RUM + error capture + Web Vitals shipping).
// No-ops silently when VITE_RUM_ENDPOINT is not set.
initObservability();

// Dismiss splash screen after React mounts. The static HTML splash in index.html
// covers the viewport at z-index 9999, so if it isn't removed the user sees a
// black screen with the orange logo even though SkyCanvas is mounting behind it.
//
// Defense in depth — three independent removal paths so a single failure
// (idle callback never firing under R3F load, IIFE not installing __splashDone,
// the inline animation stuck at 90%) cannot leave the splash on screen forever:
//   1. requestIdleCallback   — preferred, gives browser breathing room
//   2. setTimeout 1500ms     — fires regardless of main-thread pressure
//   3. Direct DOM removal    — bypass __splashDone entirely if it never wired up
const dismissSplash = () => {
  try { (window as any).__splashDone?.(); } catch { /* noop */ }
  // Hard fallback: if the splash element is still in the DOM ~700ms after we
  // asked for it to fade, force-remove it. This covers the case where the
  // inline IIFE in index.html never installed __splashDone (e.g. CSP, parse
  // error) or where the fade transition is wedged.
  setTimeout(() => {
    const el = document.getElementById('splash');
    if (el) {
      el.style.opacity = '0';
      el.style.pointerEvents = 'none';
      el.remove();
    }
  }, 700);
};
if (typeof requestIdleCallback === 'function') {
  requestIdleCallback(dismissSplash, { timeout: 1500 });
}
setTimeout(dismissSplash, 1500);

// ── PWA Service Worker Registration ──
// Only register in production and NOT inside iframes/preview hosts
const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

if (isPreviewHost || isInIframe) {
  // Unregister any stale service workers in preview/iframe contexts
  navigator.serviceWorker?.getRegistrations().then((registrations) => {
    registrations.forEach((r) => r.unregister());
  });
} else {
  // Production: register PWA service worker with polished update UX
  // (toast-based "Nova versão disponível" + "Pronto para uso offline").
  import("@/pwa/registerPwaUpdate").then(({ registerPwaUpdate }) => {
    void registerPwaUpdate();
  }).catch(() => {
    // PWA module not available — silently skip
  });
}
