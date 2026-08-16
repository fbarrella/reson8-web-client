/**
 * Degraded-scope link previews (master PRD §6 / Phase 4 PRD P4.10): generic
 * OG-tag scraping needs a server-side fetch to dodge CORS, which is out of
 * scope for this no-server-changes project. Instead: a small allowlist of
 * providers whose oEmbed endpoints are actually CORS-open (verified with a
 * live `curl -H "Origin: ..."` check against each candidate before adding it
 * here, not assumed from the oEmbed spec, which doesn't guarantee CORS
 * support per-provider) — YouTube was already desktop-confirmed; Vimeo,
 * Spotify, and SoundCloud were verified the same way for this phase. Every
 * other URL remains a plain clickable hyperlink with no preview card.
 */
export interface OEmbedProvider {
  name: string;
  matches: (url: URL) => boolean;
  endpoint: (url: string) => string;
}

const PROVIDERS: OEmbedProvider[] = [
  {
    name: "YouTube",
    matches: (u) => /(^|\.)youtube\.com$/i.test(u.hostname) || u.hostname === "youtu.be",
    endpoint: (url) => `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`,
  },
  {
    name: "Vimeo",
    matches: (u) => /(^|\.)vimeo\.com$/i.test(u.hostname),
    endpoint: (url) => `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`,
  },
  {
    name: "Spotify",
    matches: (u) => /(^|\.)open\.spotify\.com$/i.test(u.hostname),
    endpoint: (url) => `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`,
  },
  {
    name: "SoundCloud",
    matches: (u) => /(^|\.)soundcloud\.com$/i.test(u.hostname),
    endpoint: (url) => `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(url)}`,
  },
];

export interface OEmbedResult {
  provider: string;
  title: string;
  thumbnailUrl?: string;
  /** Extracted from the provider's `html` field's <iframe src="...">, never
   *  the raw HTML itself — this project never renders remote HTML via
   *  dangerouslySetInnerHTML (CLAUDE.md), so a real <iframe> is built from
   *  just this URL instead of injecting the provider's markup. */
  embedSrc?: string;
  embedWidth?: number;
  embedHeight?: number;
}

/** Finds the first URL in `text` matching an allowlisted provider, if any. */
export function findEmbeddableUrl(text: string): { url: string; provider: OEmbedProvider } | null {
  const matches = text.match(/https?:\/\/[^\s<>"']+/gi);
  if (!matches) return null;
  for (const raw of matches) {
    try {
      const parsed = new URL(raw);
      const provider = PROVIDERS.find((p) => p.matches(parsed));
      if (provider) return { url: raw, provider };
    } catch {
      // Not a valid URL — skip.
    }
  }
  return null;
}

export async function fetchOEmbed(url: string, provider: OEmbedProvider): Promise<OEmbedResult | null> {
  try {
    const res = await fetch(provider.endpoint(url));
    if (!res.ok) return null;
    const data: unknown = await res.json();
    if (typeof data !== "object" || data === null) return null;
    const d = data as Record<string, unknown>;
    const html = typeof d.html === "string" ? d.html : undefined;
    const srcMatch = html?.match(/src="([^"]+)"/);
    return {
      provider: provider.name,
      title: typeof d.title === "string" ? d.title : url,
      thumbnailUrl: typeof d.thumbnail_url === "string" ? d.thumbnail_url : undefined,
      embedSrc: srcMatch?.[1],
      embedWidth: typeof d.width === "number" ? d.width : undefined,
      embedHeight: typeof d.height === "number" ? d.height : undefined,
    };
  } catch {
    return null;
  }
}
