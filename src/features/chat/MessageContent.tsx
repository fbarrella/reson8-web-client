import { Fragment } from "react";

import { useCustomEmojiStore } from "@/stores/customEmojiStore";
import { useConnectionStore } from "@/stores/connectionStore";
import { resolveMediaUrl } from "@/lib/serverUrl";

const TOKEN_RE = /(https?:\/\/[^\s<>"']+)|(:[a-zA-Z0-9_]{2,32}:)/g;

/**
 * Renders message/reaction/DM text as React elements built from a parsing
 * pass over the raw string — never string-concatenated HTML, so there's no
 * injection surface by construction (Phase 4 PRD P4.9, a stronger guarantee
 * than the desktop's manual escape-or-render branch; mirrors CLAUDE.md's
 * "never dangerouslySetInnerHTML on remote content" rule). Bare URLs become
 * plain auto-linked hyperlinks (P4.10); `:name:` tokens render as an inline
 * image only when `name` is a currently-known APPROVED custom emoji —
 * unknown tokens render as literal text, matching the Discord/Slack
 * convention the desktop client already uses.
 */
export function MessageContent({ content }: { content: string }) {
  const customEmojiByName = useCustomEmojiStore((s) => s.byName);
  const serverUrl = useConnectionStore((s) => s.serverUrl);

  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let matchIndex = 0;

  for (const match of content.matchAll(TOKEN_RE)) {
    const [full, url, emojiToken] = match;
    const index = match.index;
    if (index > lastIndex) nodes.push(<Fragment key={matchIndex++}>{content.slice(lastIndex, index)}</Fragment>);

    if (url) {
      nodes.push(
        <a
          key={matchIndex++}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2 hover:no-underline"
        >
          {url}
        </a>,
      );
    } else if (emojiToken) {
      const name = emojiToken.slice(1, -1);
      const emoji = customEmojiByName.get(name);
      if (emoji && emoji.status === "APPROVED") {
        nodes.push(
          <img
            key={matchIndex++}
            src={resolveMediaUrl(emoji.imageUrl, serverUrl)}
            alt={`:${name}:`}
            title={`:${name}:`}
            className="inline-block size-5 -translate-y-0.5 align-middle"
          />,
        );
      } else {
        nodes.push(<Fragment key={matchIndex++}>{full}</Fragment>);
      }
    }

    lastIndex = index + full.length;
  }

  if (lastIndex < content.length) nodes.push(<Fragment key={matchIndex++}>{content.slice(lastIndex)}</Fragment>);

  return <span className="whitespace-pre-wrap break-words">{nodes}</span>;
}
