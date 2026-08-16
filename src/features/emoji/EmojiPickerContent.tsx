import { useMemo, useState } from "react";

import { Plus } from "lucide-react";

import { EMOJI_CATEGORIES, EMOJI_CATEGORY_ICONS, EMOJI_DATA } from "@/features/emoji/emojiData";
import { useCustomEmojiStore } from "@/stores/customEmojiStore";
import { useConnectionStore } from "@/stores/connectionStore";
import { resolveMediaUrl } from "@/lib/serverUrl";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const CUSTOM_TAB = "__custom__";

/**
 * Category tabs + search + grid, shared between the desktop popover and
 * (were it built) a mobile sheet — Phase 4 PRD P4.7. The custom-emoji tab is
 * a fixed sibling *outside* the horizontally-scrolling built-in-category
 * row, never inside it — porting the layout the hard way round from a real
 * desktop bug (Phase 11 PRD 11.3: a 10th tab hidden inside a scrollable row)
 * rather than copying that layout and re-fixing it later.
 */
export function EmojiPickerContent({
  onSelectEmoji,
  onSelectCustomEmoji,
  onRequestUpload,
}: {
  onSelectEmoji: (emoji: string) => void;
  onSelectCustomEmoji: (name: string) => void;
  onRequestUpload?: () => void;
}) {
  const [activeCategory, setActiveCategory] = useState<string>(EMOJI_CATEGORIES[0]);
  const [search, setSearch] = useState("");
  const customEmojiByName = useCustomEmojiStore((s) => s.byName);
  const nickname = useConnectionStore((s) => s.nickname);
  const serverUrl = useConnectionStore((s) => s.serverUrl);

  const query = search.trim().toLowerCase();
  const isSearching = query.length > 0;
  const isCustomTab = !isSearching && activeCategory === CUSTOM_TAB;

  const filteredEmoji = useMemo(() => {
    if (isSearching) {
      return EMOJI_DATA.filter(
        (e) => e.name.includes(query) || e.keywords.some((k) => k.includes(query)),
      );
    }
    return EMOJI_DATA.filter((e) => e.category === activeCategory);
  }, [isSearching, query, activeCategory]);

  const customEmojiList = useMemo(() => {
    const list = [...customEmojiByName.values()];
    // The submitter's own still-pending emoji shows grayed out in their own
    // picker (Phase 4 PRD P4.9) — everyone else only ever sees APPROVED ones.
    return list.filter((e) => e.status === "APPROVED" || e.uploadedByNickname === nickname);
  }, [customEmojiByName, nickname]);

  return (
    <div className="flex h-80 w-72 flex-col">
      <div className="p-2">
        <Input
          placeholder="Search emoji…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9"
        />
      </div>

      <div className="flex shrink-0 items-center gap-0.5 border-b border-border px-1">
        <div className="flex flex-1 overflow-x-auto">
          {EMOJI_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              title={cat}
              aria-label={cat}
              aria-current={!isSearching && activeCategory === cat}
              onClick={() => {
                setSearch("");
                setActiveCategory(cat);
              }}
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-md text-base",
                !isSearching && activeCategory === cat ? "bg-accent" : "hover:bg-accent/60",
              )}
            >
              {EMOJI_CATEGORY_ICONS[cat]}
            </button>
          ))}
        </div>
        {/* Fixed, always-visible — never inside the scrollable row above. */}
        <button
          type="button"
          title="Custom emoji"
          aria-label="Custom emoji"
          aria-current={isCustomTab}
          onClick={() => {
            setSearch("");
            setActiveCategory(CUSTOM_TAB);
          }}
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-md border-l border-border text-base",
            isCustomTab ? "bg-accent" : "hover:bg-accent/60",
          )}
        >
          🏷️
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-1">
        {isCustomTab ? (
          <div className="flex flex-col gap-2">
            {onRequestUpload && (
              <Button type="button" variant="outline" size="sm" onClick={onRequestUpload} className="self-start">
                <Plus className="size-4" /> Add emoji
              </Button>
            )}
            {customEmojiList.length === 0 ? (
              <p className="p-3 text-center text-xs text-muted-foreground">No custom emoji yet.</p>
            ) : (
            <div className="grid grid-cols-6 gap-1">
              {customEmojiList.map((emoji) => (
                <button
                  key={emoji.id}
                  type="button"
                  title={`:${emoji.name}: ${emoji.status === "PENDING" ? "(pending approval)" : ""}`}
                  disabled={emoji.status === "PENDING"}
                  onClick={() => onSelectCustomEmoji(emoji.name)}
                  className={cn(
                    "flex size-10 items-center justify-center rounded-md hover:bg-accent",
                    emoji.status === "PENDING" && "opacity-40",
                  )}
                >
                  <img src={resolveMediaUrl(emoji.imageUrl, serverUrl)} alt={emoji.name} className="size-6" />
                </button>
              ))}
            </div>
            )}
          </div>
        ) : filteredEmoji.length === 0 ? (
          <p className="p-3 text-center text-xs text-muted-foreground">No emoji found.</p>
        ) : (
          <div className="grid grid-cols-6 gap-1">
            {filteredEmoji.map((e) => (
              <button
                key={e.name}
                type="button"
                title={e.name}
                onClick={() => onSelectEmoji(e.emoji)}
                className="flex size-10 items-center justify-center rounded-md text-xl hover:bg-accent"
              >
                {e.emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
