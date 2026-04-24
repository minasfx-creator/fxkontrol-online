import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initWebVitals as initWebVitalsConsole } from "@/lib/webVitals";
import { initObservability } from "@/observability";
import { installConsoleCapture } from "@/lib/consoleCapture";

// Install console.error/warn + window error capture as early as possible
// so the Diagnostics panel can replay startup errors.
installConsoleCapture();

createRoot(document.getElementById("root")!).render(<App />);

// Dev-only Web Vitals console reporter (per-route, color-coded).
initWebVitalsConsole();

// Production observability (RUM + error capture + Web Vitals shipping).
// No-ops silently when VITE_RUM_ENDPOINT is not set.
initObservability();

// Dismiss splash screen after React mounts — use idle callback to let browser paint first
const dismissSplash = () => (window as any).__splashDone?.();
if (typeof requestIdleCallback === 'function') {
  requestIdleCallback(dismissSplash, { timeout: 1500 });
} else {
  setTimeout(dismissSplash, 100);
}

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
