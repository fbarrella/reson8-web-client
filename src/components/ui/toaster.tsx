import { X } from "lucide-react";

import { useToastStore } from "@/stores/toastStore";
import { cn } from "@/lib/utils";

/**
 * Renders toasts from stores/toastStore.ts (Phase 1 PRD P1.12). Uses
 * role="status"/"alert" + aria-live directly rather than @radix-ui/react-toast
 * so the toast() API is usable immediately; safe to swap the internals for
 * the Radix primitive later without touching call sites.
 */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 lg:bottom-4 lg:items-end lg:right-4 lg:left-auto"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.variant === "destructive" ? "alert" : "status"}
          className={cn(
            "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border p-4 shadow-lg lg:w-96",
            t.variant === "destructive"
              ? "border-destructive/50 bg-destructive/10 text-destructive"
              : "border-border bg-card text-card-foreground",
          )}
        >
          <div className="flex-1">
            <p className="text-sm font-medium">{t.title}</p>
            {t.description && <p className="mt-0.5 text-sm opacity-90">{t.description}</p>}
          </div>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => dismiss(t.id)}
            className="text-current opacity-70 hover:opacity-100"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
