import {
  type BeforeInstallPromptEvent,
  useInstallPromptStore,
} from "@/stores/installPromptStore";

/**
 * Captures Chromium's `beforeinstallprompt` once at app start so it can be
 * replayed later from a deliberate in-app "Install Reson8" affordance
 * (Phase 7 P7.1) instead of Chromium's own unsolicited native banner —
 * `preventDefault()` suppresses that banner permanently for this event.
 */
export function initInstallPromptListeners(): void {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    useInstallPromptStore.getState().setDeferredPrompt(event as BeforeInstallPromptEvent);
  });

  window.addEventListener("appinstalled", () => {
    useInstallPromptStore.getState().setInstalled(true);
  });
}

/** Replays the captured prompt. Resolves to the user's choice, or null if
 *  there was nothing to prompt (already consumed, or never fired). */
export async function promptInstall(): Promise<"accepted" | "dismissed" | null> {
  const { deferredPrompt } = useInstallPromptStore.getState();
  if (!deferredPrompt) return null;

  await deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  // Each captured event is single-use regardless of outcome.
  useInstallPromptStore.getState().setDeferredPrompt(null);
  return outcome;
}
