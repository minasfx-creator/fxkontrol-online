import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initWebVitals } from "@/lib/webVitals";

createRoot(document.getElementById("root")!).render(<App />);

// ── Dynamic chunk-load recovery ──
// "Importing a module script failed" / "Failed to fetch dynamically imported module"
// happens when the HTML references a chunk hash that no longer exists on the CDN
// (typical right after a redeploy). Reload once to pick up fresh hashes.
const isChunkLoadError = (msg: string) =>
  /Importing a module script failed|Failed to fetch dynamically imported module|error loading dynamically imported module/i.test(
    msg || "",
  );
const hardReloadCacheBust = () => {
  const url = new URL(window.location.href);
  url.searchParams.set("__fxk_cb", Date.now().toString(36));
  window.location.replace(url.toString());
};
const recoverFromStaleChunk = async () => {
  if (sessionStorage.getItem("__fxk_chunk_reload")) return;
  sessionStorage.setItem("__fxk_chunk_reload", "1");
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if (typeof caches !== "undefined") {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
    }
  } catch {
    /* ignore */
  } finally {
    hardReloadCacheBust();
  }
};
window.addEventListener("error", (e) => {
  if (isChunkLoadError(e.message)) recoverFromStaleChunk();
});
window.addEventListener("unhandledrejection", (e) => {
  const msg = (e.reason && (e.reason.message || String(e.reason))) || "";
  if (isChunkLoadError(msg)) recoverFromStaleChunk();
});
// Clear the guard after a successful render-stable window so future deploys can recover again.
setTimeout(() => sessionStorage.removeItem("__fxk_chunk_reload"), 30_000);

// Initialize Web Vitals RUM instrumentation
initWebVitals();

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

// Service workers are not supported on file:// (Electron). Skip registration
// and unregister any stale ones to avoid unexpected caching behavior.
const isElectron = !!(window as any).electronBridge;

if (isPreviewHost || isInIframe || isElectron) {
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
