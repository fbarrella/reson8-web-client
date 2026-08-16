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

/**
 * REST endpoints (uploads) live at the server's http(s) origin, not the ws(s)
 * scheme socket.io-client connects with — same host/port, just a different
 * scheme (Phase 4 PRD P4.4/P4.9's upload calls need this).
 */
export function wsUrlToHttpBase(wsUrl: string): string {
  return wsUrl.replace(/^ws/i, "http");
}

/**
 * Resolves an attachment/emoji URL returned by the server against the
 * connected server's own origin — the server may return either a relative
 * path (local-disk backend) or an absolute URL (Cloudinary backend), and
 * CLAUDE.md's protocol reference is explicit that the client must never
 * assume one or the other.
 */
export function resolveMediaUrl(url: string, serverUrl: string | null): string {
  if (/^https?:\/\//i.test(url)) return url;
  if (!serverUrl) return url;
  const base = wsUrlToHttpBase(serverUrl).replace(/\/$/, "");
  return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
}
