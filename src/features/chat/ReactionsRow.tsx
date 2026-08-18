import { Smile } from "lucide-react";

import { useConnectionStore } from "@/stores/connectionStore";
import { useCustomEmojiStore } from "@/stores/customEmojiStore";
import { resolveMediaUrl } from "@/lib/serverUrl";
import { EmojiPicker } from "@/features/emoji/EmojiPicker";
import { cn } from "@/lib/utils";

const CUSTOM_EMOJI_TOKEN_RE = /^:([a-zA-Z0-9_]{2,32}):$/;

/** Channel-vs-DM agnostic — the caller decides which service (and isDm
 *  flag) TOGGLE_REACTION goes out with (Phase 5 PRD P5.3 reuse). */
export function ReactionsRow({
  reactions,
  onToggle,
}: {
  reactions?: Array<{ emoji: string; count: number; userIds: string[] }>;
  onToggle: (token: string) => void;
}) {
  const selfUserId = useConnectionStore((s) => s.selfUserId);
  const customEmojiByName = useCustomEmojiStore((s) => s.byName);
  const serverUrl = useConnectionStore((s) => s.serverUrl);

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {(reactions ?? []).map((r) => {
        const active = selfUserId !== null && r.userIds.includes(selfUserId);
        // `r.emoji` is either a raw unicode glyph or a `:name:` token
        // referencing a custom emoji (Improvements Round IR3 — this mirrors
        // MessageContent's identical lookup for emoji tokens in message
        // body text, which already rendered custom emoji as images; the
        // reaction row previously never made this check and always showed
        // literal token text for custom emoji).
        const customEmojiName = r.emoji.match(CUSTOM_EMOJI_TOKEN_RE)?.[1];
        const customEmoji = customEmojiName ? customEmojiByName.get(customEmojiName) : undefined;
        return (
          <button
            key={r.emoji}
            type="button"
            onClick={() => onToggle(r.emoji)}
            className={cn(
              "flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs",
              active ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent",
            )}
          >
            {customEmoji && customEmoji.status === "APPROVED" ? (
              <img
                src={resolveMediaUrl(customEmoji.imageUrl, serverUrl)}
                alt={r.emoji}
                title={r.emoji}
                className="size-3.5"
              />
            ) : (
              <span>{r.emoji}</span>
            )}
            <span>{r.count}</span>
          </button>
        );
      })}
      <EmojiPicker
        align="start"
        onPick={onToggle}
        trigger={
          <button
            type="button"
            aria-label="Add reaction"
            className="flex size-6 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground opacity-70 hover:bg-accent hover:opacity-100"
          >
            <Smile className="size-3.5" />
          </button>
        }
      />
    </div>
  );
}
