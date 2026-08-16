import { useEffect, useState } from "react";
import { Check, X, Loader2 } from "lucide-react";

import { useAdminStore } from "@/stores/adminStore";
import { useConnectionStore } from "@/stores/connectionStore";
import { loadPendingEmojis, reviewEmoji } from "@/services/adminService";
import { resolveMediaUrl } from "@/lib/serverUrl";
import { Button } from "@/components/ui/button";

/**
 * Settings → Emojis (Phase 6 PRD P6.2), MANAGE_EMOJIS-gated at the
 * SettingsSheet tab level. Approval fires the existing CUSTOM_EMOJI_APPROVED
 * broadcast Phase 4's picker already consumes — no plumbing needed here
 * beyond removing the item from this queue view on success.
 */
export function EmojiApprovalTab() {
  const emojis = useAdminStore((s) => s.pendingEmojis);
  const loading = useAdminStore((s) => s.pendingEmojisLoading);
  const serverUrl = useConnectionStore((s) => s.serverUrl);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    void loadPendingEmojis();
  }, []);

  const handleReview = async (emojiId: string, decision: "APPROVED" | "REJECTED") => {
    setPendingId(emojiId);
    await reviewEmoji(emojiId, decision);
    setPendingId(null);
  };

  if (loading && emojis.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading…
      </div>
    );
  }

  if (emojis.length === 0) {
    return <p className="text-sm text-muted-foreground">No custom emoji awaiting review.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {emojis.map((emoji) => (
        <li key={emoji.id} className="flex items-center gap-3 rounded-md border border-border p-2">
          <img
            src={resolveMediaUrl(emoji.imageUrl, serverUrl)}
            alt={emoji.name}
            className="size-10 shrink-0 rounded object-contain"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">:{emoji.name}:</p>
            <p className="truncate text-xs text-muted-foreground">
              Submitted by {emoji.uploadedByNickname ?? "Unknown"}
            </p>
          </div>
          <Button
            type="button"
            size="icon"
            variant="outline"
            aria-label={`Approve :${emoji.name}:`}
            disabled={pendingId === emoji.id}
            onClick={() => void handleReview(emoji.id, "APPROVED")}
          >
            <Check className="size-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            aria-label={`Reject :${emoji.name}:`}
            disabled={pendingId === emoji.id}
            onClick={() => void handleReview(emoji.id, "REJECTED")}
          >
            <X className="size-4" />
          </Button>
        </li>
      ))}
    </ul>
  );
}
