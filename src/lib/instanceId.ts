const INSTANCE_ID_KEY = "reson8-instance-id";

/**
 * Reson8 has no login — identity is a persistent instance ID generated once
 * per browser profile and reused on every future visit (master PRD §5.3).
 * No dev/packaged distinction exists on the web, unlike the desktop client.
 */
export function getOrCreateInstanceId(): string {
  const existing = localStorage.getItem(INSTANCE_ID_KEY);
  if (existing) return existing;

  const created = crypto.randomUUID();
  localStorage.setItem(INSTANCE_ID_KEY, created);
  return created;
}

/**
 * Whether this browser profile has run before, independent of any single
 * feature's own persisted state — mirrors the desktop client's
 * `hasExistingInstanceId()` (its ID file is written on first-ever launch,
 * before anything else touches userData). Must be read before anything in
 * this session calls `getOrCreateInstanceId()` — main.tsx captures it
 * before React renders, since that's the earliest point nothing else could
 * have created the key yet.
 */
export function hasExistingInstanceId(): boolean {
  return localStorage.getItem(INSTANCE_ID_KEY) !== null;
}
