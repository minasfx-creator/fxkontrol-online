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
const recoverFromStaleChunk = () => {
  if (sessionStorage.getItem("__fxk_chunk_reload")) return;
  sessionStorage.setItem("__fxk_chunk_reload", "1");
  if (typeof caches !== "undefined") {
    caches.keys().then((names) => Promise.all(names.map((n) => caches.delete(n)))).finally(() => {
      window.location.reload();
    });
  } else {
    window.location.reload();
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

if (isPreviewHost || isInIframe) {
  // Unregister any stale service workers AND purge their caches in preview/iframe contexts.
  // Without cache deletion, old chunk hashes (e.g. r3f-XXXX.js) keep being served and try to
  // import sibling chunks that no longer exist, causing "Importing a module script failed".
  (async () => {
    try {
      const regs = (await navigator.serviceWorker?.getRegistrations()) ?? [];
      const hadSW = regs.length > 0;
      await Promise.all(regs.map((r) => r.unregister()));
      if (typeof caches !== "undefined") {
        const names = await caches.keys();
        await Promise.all(names.map((n) => caches.delete(n)));
      }
      // If we just evicted a SW that was controlling this page, the current HTML/JS may
      // still reference stale chunk hashes. Hard-reload once to pick up fresh assets.
      if (hadSW && !sessionStorage.getItem("__fxk_sw_purged")) {
        sessionStorage.setItem("__fxk_sw_purged", "1");
        window.location.reload();
      }
    } catch {
      /* ignore */
    }
  })();
} else {
  // Production: register PWA service worker
  import("virtual:pwa-register").then(({ registerSW }) => {
    registerSW({ immediate: true });
  }).catch(() => {
    // PWA module not available — silently skip
  });
}
