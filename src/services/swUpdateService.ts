import { registerSW } from "virtual:pwa-register";

import { toast } from "@/stores/toastStore";

/**
 * Direct conceptual replacement for electron-updater's check/download/
 * install flow (Phase 7 P7.2): registers the service worker with
 * `registerType: "prompt"` (never silently auto-updating, which could
 * yank the SW out from under an active voice/chat session — see
 * src/sw.ts) and, once a new version is waiting, shows a persistent toast
 * with a "Reload" action rather than auto-dismissing and letting the
 * update go unnoticed.
 */
export function initServiceWorkerUpdateFlow(): void {
  let refreshToastShown = false;

  const updateSW = registerSW({
    onNeedRefresh() {
      if (refreshToastShown) return;
      refreshToastShown = true;
      toast({
        title: "A new version is available",
        description: "Reload to update Reson8.",
        persistent: true,
        action: {
          label: "Reload",
          onClick: () => {
            void updateSW();
          },
        },
      });
    },
    onRegisterError(error: unknown) {
      console.error("Service worker registration failed:", error);
    },
  });
}
