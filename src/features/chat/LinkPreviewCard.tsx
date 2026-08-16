import { useEffect, useState } from "react";
import { Play } from "lucide-react";

import { findEmbeddableUrl, fetchOEmbed, type OEmbedResult, type OEmbedProvider } from "@/lib/linkPreview";

/**
 * Degraded-scope link preview (Phase 4 PRD P4.10) — only renders for the
 * small CORS-verified oEmbed allowlist (see lib/linkPreview.ts); every other
 * URL in the message stays a plain auto-linked hyperlink with no card, which
 * is the accepted scope reduction, not a bug. Video/audio providers get a
 * click-to-expand embed player (a real <iframe>, never the provider's raw
 * HTML string via dangerouslySetInnerHTML).
 */
export function LinkPreviewCard({ content }: { content: string }) {
  const found = findEmbeddableUrl(content);
  if (!found) return null;
  // Keyed by url so a *different* embeddable link naturally remounts a fresh
  // instance instead of an effect imperatively resetting state — avoids the
  // cascading-setState-in-effect anti-pattern for what is, functionally, a
  // brand new fetch for brand new content.
  return <LinkPreviewCardForUrl key={found.url} url={found.url} provider={found.provider} />;
}

function LinkPreviewCardForUrl({ url, provider }: { url: string; provider: OEmbedProvider }) {
  const [result, setResult] = useState<OEmbedResult | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchOEmbed(url, provider).then((res) => {
      if (cancelled) return;
      if (res) setResult(res);
      else setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [url, provider]);

  if (failed || !result) return null;

  if (expanded && result.embedSrc) {
    return (
      <div className="mt-1.5 max-w-sm overflow-hidden rounded-md border border-border">
        <iframe
          src={result.embedSrc}
          width="100%"
          height={result.embedHeight ?? 200}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title={result.title}
          className="block"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setExpanded(true)}
      disabled={!result.embedSrc}
      className="mt-1.5 flex max-w-sm items-center gap-3 overflow-hidden rounded-md border border-border bg-card p-2 text-left hover:bg-accent disabled:cursor-default disabled:hover:bg-card"
    >
      {result.thumbnailUrl && (
        <span className="relative shrink-0">
          <img src={result.thumbnailUrl} alt="" className="h-14 w-20 rounded object-cover" />
          {result.embedSrc && (
            <Play className="absolute inset-0 m-auto size-5 text-white drop-shadow" fill="currentColor" />
          )}
        </span>
      )}
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-foreground">{result.title}</span>
        <span className="block text-xs text-muted-foreground">{result.provider}</span>
      </span>
    </button>
  );
}
