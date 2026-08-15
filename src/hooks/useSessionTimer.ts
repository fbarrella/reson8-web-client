import { useEffect, useReducer } from "react";

import { useConnectionStore } from "@/stores/connectionStore";
import { correctedNow, formatSessionDuration } from "@/lib/sessionTimer";

/**
 * Live-formatted elapsed voice session time. Computed directly in the render
 * body (not staged through useState+useEffect) so mount/update never shows a
 * blank/stale frame before the first tick — the exact flicker bug the
 * desktop client had to fix (Phase 2 PRD P2.9).
 */
export function useSessionTimer(sessionStartedAt: string | null): string | null {
  const clockOffsetMs = useConnectionStore((s) => s.clockOffsetMs ?? 0);
  const [, forceTick] = useReducer((c: number) => c + 1, 0);

  useEffect(() => {
    if (!sessionStartedAt) return;
    const interval = setInterval(forceTick, 1000);
    return () => clearInterval(interval);
  }, [sessionStartedAt]);

  if (!sessionStartedAt) return null;
  return formatSessionDuration(correctedNow(clockOffsetMs) - new Date(sessionStartedAt).getTime());
}
