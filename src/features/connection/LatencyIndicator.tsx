import { useConnectionStore } from "@/stores/connectionStore";
import { cn } from "@/lib/utils";

const GOOD_MS = 100;
const OK_MS = 250;

export function LatencyIndicator() {
  const status = useConnectionStore((s) => s.status);
  const latencyMs = useConnectionStore((s) => s.latencyMs);

  const dotColor =
    status !== "connected" || latencyMs === null
      ? "bg-muted-foreground"
      : latencyMs < GOOD_MS
        ? "bg-success"
        : latencyMs < OK_MS
          ? "bg-warning"
          : "bg-destructive";

  const label =
    status === "reconnecting"
      ? "Reconnecting…"
      : status !== "connected"
        ? "Offline"
        : latencyMs !== null
          ? `${Math.round(latencyMs)}ms`
          : "—";

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-1.5 text-xs text-muted-foreground"
    >
      <span aria-hidden className={cn("size-2 rounded-full", dotColor)} />
      <span>{label}</span>
    </div>
  );
}
