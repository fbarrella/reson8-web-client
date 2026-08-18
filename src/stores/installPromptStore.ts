import { create } from "zustand";

const DISMISSED_KEY = "reson8-install-prompt-dismissed";

/** The event Chromium fires instead of showing its own install banner,
 *  once `preventDefault()` is called on it. Not in lib.dom.d.ts yet. */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface InstallPromptState {
  /** Captured `beforeinstallprompt` event, ready to `.prompt()`. Null until
   *  Chromium fires it (or after it's been consumed/superseded). */
  deferredPrompt: BeforeInstallPromptEvent | null;
  /** Set once `appinstalled` fires, so the affordance never reappears
   *  mid-session even if a stale deferredPrompt somehow lingers. */
  installed: boolean;
  dismissed: boolean;

  setDeferredPrompt: (event: BeforeInstallPromptEvent | null) => void;
  setInstalled: (installed: boolean) => void;
  dismiss: () => void;
}

export const useInstallPromptStore = create<InstallPromptState>((set) => ({
  deferredPrompt: null,
  installed: false,
  dismissed: localStorage.getItem(DISMISSED_KEY) === "true",

  setDeferredPrompt: (deferredPrompt) => set({ deferredPrompt }),
  setInstalled: (installed) => set({ installed, deferredPrompt: null }),
  dismiss: () => {
    localStorage.setItem(DISMISSED_KEY, "true");
    set({ dismissed: true });
  },
}));
