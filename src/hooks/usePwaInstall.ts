import { useCallback, useEffect, useState } from "react";

/**
 * BeforeInstallPromptEvent — non-standard but stable Chromium API.
 * Fires when the browser determines the site meets PWA install criteria.
 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export type InstallStatus =
  | "installed"      // already running standalone (PWA installed or in iOS home-screen mode)
  | "available"     // beforeinstallprompt fired and is ready
  | "ios-manual"    // iOS Safari — must use Share → Add to Home Screen
  | "unsupported";  // browser doesn't support install prompts

export interface UsePwaInstallResult {
  status: InstallStatus;
  isStandalone: boolean;
  isIOS: boolean;
  promptInstall: () => Promise<"accepted" | "dismissed" | "unavailable">;
}

const STORAGE_KEY = "fxk:pwa:status";

type CachedStatus = Exclude<InstallStatus, "unsupported"> | null;

function readCachedStatus(): CachedStatus {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "installed" || raw === "available" || raw === "ios-manual") return raw;
  } catch {
    /* storage blocked — ignore */
  }
  return null;
}

function writeCachedStatus(status: InstallStatus): void {
  if (typeof localStorage === "undefined") return;
  try {
    // Don't persist "unsupported" — re-detect on each load so a browser
    // upgrade flips us to "available" without a stale negative cache.
    if (status === "unsupported") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, status);
  } catch {
    /* storage blocked — ignore */
  }
}

function detectIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iPad|iPhone|iPod/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
}

function detectStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function usePwaInstall(): UsePwaInstallResult {
  const cached = readCachedStatus();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  // Seed from live detection first; fall back to the cached value so the UI
  // doesn't flicker to "unsupported" between mount and the next
  // `beforeinstallprompt` (which may never fire if already installed).
  const [isStandalone, setIsStandalone] = useState<boolean>(
    () => detectStandalone() || cached === "installed",
  );
  const [cachedHint, setCachedHint] = useState<CachedStatus>(cached);
  const isIOS = detectIOS();

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setCachedHint("available");
    };
    const onInstalled = () => {
      setDeferred(null);
      setIsStandalone(true);
      setCachedHint("installed");
    };
    const mq = window.matchMedia?.("(display-mode: standalone)");
    const onModeChange = () => {
      const standalone = detectStandalone();
      setIsStandalone(standalone);
      if (standalone) setCachedHint("installed");
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    mq?.addEventListener?.("change", onModeChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      mq?.removeEventListener?.("change", onModeChange);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferred) return "unavailable" as const;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    if (outcome === "accepted") setCachedHint("installed");
    return outcome;
  }, [deferred]);

  let status: InstallStatus;
  if (isStandalone) status = "installed";
  else if (deferred) status = "available";
  else if (isIOS) status = "ios-manual";
  else if (cachedHint) status = cachedHint; // survive refresh until live detection updates
  else status = "unsupported";

  // Persist whenever the resolved status changes.
  useEffect(() => {
    writeCachedStatus(status);
  }, [status]);

  return { status, isStandalone, isIOS, promptInstall };
}
