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
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState<boolean>(detectStandalone);
  const isIOS = detectIOS();

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferred(null);
      setIsStandalone(true);
    };
    const mq = window.matchMedia?.("(display-mode: standalone)");
    const onModeChange = () => setIsStandalone(detectStandalone());

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
    return outcome;
  }, [deferred]);

  let status: InstallStatus;
  if (isStandalone) status = "installed";
  else if (deferred) status = "available";
  else if (isIOS) status = "ios-manual";
  else status = "unsupported";

  return { status, isStandalone, isIOS, promptInstall };
}
