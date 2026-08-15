/**
 * Voice session elapsed-time formatting, ported from the desktop client
 * (Phase 2 PRD P2.9 / desktop Phase 11 PRD 11.2). Clamped to a minimum of 0
 * as defense-in-depth against residual clock skew beyond what the single
 * PING_LATENCY round-trip offset already corrects for.
 */
export function formatSessionDuration(elapsedMs: number): string {
  const totalSeconds = Math.floor(Math.max(0, elapsedMs) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** Current time corrected for client↔server clock skew — use instead of a
 *  raw Date.now() whenever diffing against a server-issued timestamp. */
export function correctedNow(clockOffsetMs: number): number {
  return Date.now() + clockOffsetMs;
}
