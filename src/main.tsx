import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initWebVitals } from "@/lib/webVitals";

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

const registerChunkRecovery = () => {
  document.addEventListener("vite:preloadError", (event) => {
    event.preventDefault();
    void recoverFromStaleChunk();
  });

  window.addEventListener("error", (event) => {
    if (isChunkLoadError(event.message)) void recoverFromStaleChunk();
  });

  window.addEventListener("unhandledrejection", (event) => {
    const msg = (event.reason && (event.reason.message || String(event.reason))) || "";
    if (isChunkLoadError(msg)) void recoverFromStaleChunk();
  });
};

// Register BEFORE React renders so first-route lazy imports are covered too.
registerChunkRecovery();

// Clear the guard after a successful render-stable window so future deploys can recover again.
setTimeout(() => sessionStorage.removeItem("__fxk_chunk_reload"), 30_000);

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

const prepareRuntimeCaches = async () => {
  if (isPreviewHost || isInIframe) {
    try {
      const regs = (await navigator.serviceWorker?.getRegistrations()) ?? [];
      const hadSW = regs.length > 0;
      await Promise.all(regs.map((r) => r.unregister()));

      if (typeof caches !== "undefined") {
        const names = await caches.keys();
        await Promise.all(names.map((n) => caches.delete(n)));
      }

      if (hadSW && !sessionStorage.getItem("__fxk_sw_purged")) {
        sessionStorage.setItem("__fxk_sw_purged", "1");
        window.location.reload();
        return false;
      }
    } catch {
      /* ignore */
    }

    return true;
  }

  void import("virtual:pwa-register")
    .then(({ registerSW }) => {
      registerSW({ immediate: true });
    })
    .catch(() => {
      /* ignore */
    });

  return true;
};

const bootstrap = async () => {
  const shouldRender = await prepareRuntimeCaches();
  if (!shouldRender) return;

  createRoot(document.getElementById("root")!).render(<App />);

  initWebVitals();

  const dismissSplash = () => (window as any).__splashDone?.();
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(dismissSplash, { timeout: 1500 });
  } else {
    setTimeout(dismissSplash, 100);
  }
};

void bootstrap();
