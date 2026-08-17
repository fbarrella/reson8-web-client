import { useEffect, useState } from "react";
import { Download, Share, SquarePlus, X } from "lucide-react";

import { useConnectionStore } from "@/stores/connectionStore";
import { useInstallPromptStore } from "@/stores/installPromptStore";
import { promptInstall } from "@/services/installPromptService";
import { isIOSSafari, isStandaloneDisplayMode } from "@/lib/platform";
import { Button } from "@/components/ui/button";

/** How long after a successful connection to surface the affordance — a
 *  working session is a better install-conversion moment than the connect
 *  screen itself (Phase 7 PRD P7.1), but shouldn't interrupt the moment
 *  the channel tree first renders. */
const SHOW_DELAY_MS = 3000;

/**
 * Dismissible "Install Reson8" affordance. Chromium: replays the captured
 * `beforeinstallprompt` event. iOS Safari (no such event exists there):
 * an instructional panel, since manual Share -> Add to Home Screen is the
 * only install path iOS offers.
 */
export function InstallPrompt() {
  const status = useConnectionStore((s) => s.status);
  const deferredPrompt = useInstallPromptStore((s) => s.deferredPrompt);
  const installed = useInstallPromptStore((s) => s.installed);
  const dismissed = useInstallPromptStore((s) => s.dismissed);
  const dismiss = useInstallPromptStore((s) => s.dismiss);
  const [visible, setVisible] = useState(false);

  const iosEligible = isIOSSafari() && !isStandaloneDisplayMode();
  const canShow = (deferredPrompt !== null || iosEligible) && !installed && !dismissed;

  useEffect(() => {
    if (status !== "connected" || !canShow) return;
    const timer = window.setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [status, canShow]);

  if (!visible || !canShow) return null;

  const handleInstallClick = () => {
    void promptInstall().then(() => dismiss());
  };

  return (
    <div
      role="region"
      aria-label="Install Reson8"
      className="fixed inset-x-3 bottom-20 z-30 rounded-lg border border-border bg-card p-4 shadow-lg lg:inset-x-auto lg:right-4 lg:bottom-4 lg:w-80"
    >
      <button
        type="button"
        aria-label="Dismiss install prompt"
        onClick={dismiss}
        className="absolute top-2 right-2 flex size-8 items-center justify-center text-muted-foreground hover:text-foreground"
      >
        <X className="size-4" />
      </button>

      {deferredPrompt ? (
        <>
          <p className="pr-6 text-sm font-medium text-foreground">Install Reson8</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add Reson8 to your home screen for quicker access and a full-screen app feel.
          </p>
          <Button onClick={handleInstallClick} className="mt-3 gap-2">
            <Download className="size-4" />
            Install
          </Button>
        </>
      ) : (
        <>
          <p className="pr-6 text-sm font-medium text-foreground">Add Reson8 to your Home Screen</p>
          <p className="mt-1 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
            Tap <Share className="inline size-4" aria-label="Share" /> then
            <span className="inline-flex items-center gap-1 font-medium text-foreground">
              <SquarePlus className="size-4" aria-hidden="true" />
              Add to Home Screen
            </span>
          </p>
        </>
      )}
    </div>
  );
}
