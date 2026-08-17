import { useEffect, useRef, useState } from "react";

import { checkForWhatsNew, markWhatsNewSeen, type WhatsNewResult } from "@/lib/whatsNew";
import { Button } from "@/components/ui/button";

interface WhatsNewModalProps {
  /** Captured before React ever rendered (main.tsx) — see whatsNew.ts's
   *  checkForWhatsNew doc comment for why the timing matters. */
  hadExistingInstanceId: boolean;
}

/**
 * Ported from desktop Phase 11's design (Phase 7 P7.3): shown once per
 * version bump for a returning visitor, fetching that version's GitHub
 * release notes. Release-note body is rendered as plain text via JSX's
 * default escaping — never dangerouslySetInnerHTML — per master PRD §5.6,
 * matching the desktop client's own textContent-not-innerHTML choice for
 * this exact surface.
 */
export function WhatsNewModal({ hadExistingInstanceId }: WhatsNewModalProps) {
  const [pending, setPending] = useState<WhatsNewResult | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    void checkForWhatsNew(__APP_VERSION__, hadExistingInstanceId).then((result) => {
      if (!cancelled && result) setPending(result);
    });
    return () => {
      cancelled = true;
    };
  }, [hadExistingInstanceId]);

  useEffect(() => {
    if (!pending) return;
    panelRef.current?.focus();

    // Escape behaves like a backdrop click (dismiss without marking
    // seen) — the desktop reference only wired backdrop-click, but every
    // other modal in this app supports Escape (master PRD §5.5), so this
    // extends that consistency rather than narrowing to a literal port.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPending(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pending]);

  if (!pending) return null;

  const dismiss = () => {
    markWhatsNewSeen(pending.version);
    setPending(null);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Dismiss what's new"
        className="absolute inset-0 bg-black/60"
        onClick={() => setPending(null)}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="whats-new-title"
        className="relative z-10 max-h-[80vh] w-full max-w-md overflow-y-auto rounded-lg border border-border bg-card p-6 shadow-xl outline-none"
      >
        <h2 id="whats-new-title" className="text-lg font-semibold text-card-foreground">
          {`\u{1F389} What's New in ${pending.notes.name || `v${pending.version}`}`}
        </h2>
        <p className="mt-4 text-sm whitespace-pre-wrap text-muted-foreground">
          {pending.notes.body.trim() || "No release notes were provided for this version."}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => window.open(pending.notes.htmlUrl, "_blank", "noopener,noreferrer")}
          >
            View on GitHub
          </Button>
          <Button type="button" onClick={dismiss}>
            Got it
          </Button>
        </div>
      </div>
    </div>
  );
}
