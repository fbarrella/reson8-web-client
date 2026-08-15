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
