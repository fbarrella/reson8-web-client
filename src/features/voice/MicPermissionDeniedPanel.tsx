import { MicOff } from "lucide-react";

import { Button } from "@/components/ui/button";

function detectPlatformGuidance(): string {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);
  const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS/.test(ua);
  const isFirefox = /Firefox/.test(ua);

  if (isIOS && isSafari) {
    return "Open Settings → Safari → Microphone, or tap the “aA” icon in Safari's address bar → Website Settings, and allow Microphone access.";
  }
  if (isAndroid) {
    return "Tap the lock/info icon in the address bar → Permissions → Microphone, and allow access.";
  }
  if (isFirefox) {
    return "Click the microphone icon in the address bar (or the lock icon → Connection Secure → More Information) and allow microphone access.";
  }
  return "Click the lock/site-info icon in the address bar, find Microphone, and set it to Allow.";
}

/**
 * Denial-recovery UI (Phase 2 PRD P2.3) — browsers always show a real,
 * per-origin permission prompt (unlike Electron's auto-grant), so a denial
 * needs a clear, non-dead-end recovery path rather than a silent failure.
 */
export function MicPermissionDeniedPanel({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-center">
      <MicOff className="size-8 text-destructive" />
      <div>
        <p className="text-sm font-medium text-foreground">Microphone access is blocked</p>
        <p className="mt-1 text-sm text-muted-foreground">{detectPlatformGuidance()}</p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
