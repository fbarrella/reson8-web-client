import { Plus } from "lucide-react";

import { useConnectionStore } from "@/stores/connectionStore";
import { EmojiPicker } from "@/features/emoji/EmojiPicker";
import { cn } from "@/lib/utils";

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

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {(reactions ?? []).map((r) => {
        const active = selfUserId !== null && r.userIds.includes(selfUserId);
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
            <span>{r.emoji}</span>
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
            <Plus className="size-3.5" />
          </button>
        }
      />
    </div>
  );
}
