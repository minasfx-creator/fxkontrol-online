import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initWebVitals } from "@/lib/webVitals";
import { initObservability } from "@/observability";

createRoot(document.getElementById("root")!).render(<App />);

// Initialize Web Vitals RUM instrumentation
initWebVitals();

// Initialize production observability (RUM + error capture).
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
  // Production: register PWA service worker
  import("virtual:pwa-register").then(({ registerSW }) => {
    registerSW({ immediate: true });
  }).catch(() => {
    // PWA module not available — silently skip
  });
}
