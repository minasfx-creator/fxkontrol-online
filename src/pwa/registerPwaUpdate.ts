import { toast } from "sonner";

/**
 * Registers the PWA service worker with a polished update flow.
 *
 * - `onNeedRefresh` → shows a persistent toast with "Atualizar" / "Depois" actions.
 * - `onOfflineReady` → discreet success toast.
 *
 * Safe to call multiple times: the underlying `registerSW` is idempotent per page.
 * Must only be invoked in production / non-iframe contexts (the caller in
 * `main.tsx` already gates on `isPreviewHost || isInIframe`).
 */
export async function registerPwaUpdate(): Promise<void> {
  try {
    const { registerSW } = await import("virtual:pwa-register");

    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        toast("Nova versão disponível", {
          description: "Atualize para receber as últimas melhorias e correções.",
          duration: Infinity,
          action: {
            label: "Atualizar",
            onClick: () => {
              // Reloads the page after the new SW takes control.
              void updateSW(true);
            },
          },
          cancel: {
            label: "Depois",
            onClick: () => {
              /* dismiss only — next reload will pick up the new SW */
            },
          },
        });
      },
      onOfflineReady() {
        toast.success("Pronto para uso offline", {
          description: "O FX Kontrol agora funciona sem conexão.",
          duration: 4000,
        });
      },
      onRegisterError(error) {
        // Keep silent in UI; surface only in console for diagnostics.
        console.warn("[PWA] Service worker registration failed:", error);
      },
    });
  } catch {
    // virtual:pwa-register not available (e.g. dev build) — silently skip.
  }
}
