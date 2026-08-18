const LAST_SEEN_VERSION_KEY = "reson8-last-seen-version";
const GITHUB_REPO = "fbarrella/reson8-web-client";
const FETCH_TIMEOUT_MS = 5000;

export interface ReleaseNotes {
  name: string;
  body: string;
  htmlUrl: string;
}

export interface WhatsNewResult {
  version: string;
  notes: ReleaseNotes;
}

/**
 * GitHub's Releases API is confirmed CORS-open (master PRD §5.4/Phase 7
 * P7.3), unlike the generic OG-scraping problem in Phase 4 — no server-side
 * proxy needed. A failed fetch (offline, rate-limited, no release yet for
 * this tag) resolves to null so the caller can just try again next launch
 * instead of marking the version "seen" and silently losing the
 * notification, mirroring the desktop client's exact contract.
 */
async function fetchReleaseNotes(version: string): Promise<ReleaseNotes | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/tags/v${version}`, {
      signal: controller.signal,
      headers: { Accept: "application/vnd.github+json" },
    });
    clearTimeout(timeout);

    if (!response.ok) return null;

    const data: unknown = await response.json();
    if (typeof data !== "object" || data === null) return null;
    const { name, body, html_url: htmlUrl } = data as { name?: unknown; body?: unknown; html_url?: unknown };

    return {
      name: typeof name === "string" && name ? name : `v${version}`,
      body: typeof body === "string" ? body : "",
      htmlUrl: typeof htmlUrl === "string" ? htmlUrl : `https://github.com/${GITHUB_REPO}/releases/tag/v${version}`,
    };
  } catch {
    return null;
  }
}

/**
 * Exact port of desktop Phase 11's "What's New" decision logic (Phase 7
 * P7.3): unset `reson8-last-seen-version` AND no prior instance-id history
 * -> truly first-ever load, silently record, no modal (avoids announcing
 * "what's new" to someone who's never seen an old version). Unset but a
 * returning visitor (upgrading from a pre-P7.3 build, or localStorage was
 * partially cleared) -> falls through and shows this version's notes, same
 * as any other bump. Matches -> no-op.
 *
 * `wasReturningVisitor` must be captured before this session's own code
 * could have created `reson8-instance-id` for the first time (main.tsx
 * reads it before React renders) — otherwise a truly-first-ever visitor
 * who submits the connect form before this check runs would be
 * misclassified as returning.
 */
export async function checkForWhatsNew(
  currentVersion: string,
  wasReturningVisitor: boolean,
): Promise<WhatsNewResult | null> {
  const lastSeen = localStorage.getItem(LAST_SEEN_VERSION_KEY);

  if (!lastSeen) {
    if (!wasReturningVisitor) {
      localStorage.setItem(LAST_SEEN_VERSION_KEY, currentVersion);
      return null;
    }
  } else if (lastSeen === currentVersion) {
    return null;
  }

  const notes = await fetchReleaseNotes(currentVersion);
  if (!notes) return null;

  return { version: currentVersion, notes };
}

/** Persists the "seen" marker — only called once the modal has actually
 *  been shown and explicitly dismissed, not on every render. */
export function markWhatsNewSeen(version: string): void {
  localStorage.setItem(LAST_SEEN_VERSION_KEY, version);
}
