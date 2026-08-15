/**
 * Normalizes user-entered server addresses to a scheme socket.io-client can
 * connect with. Defaults to a secure scheme unless the host is clearly local
 * dev (matching browsers' own mixed-content stance when this PWA itself is
 * served over https) — Phase 1 PRD P1.6.
 */
export function normalizeServerUrl(input: string): string {
  const trimmed = input.trim();
  if (/^wss?:\/\//i.test(trimmed) || /^https?:\/\//i.test(trimmed)) return trimmed;

  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(trimmed);
  return `${isLocal ? "ws" : "wss"}://${trimmed}`;
}
