import { useState } from "react";
import { Pin, Loader2 } from "lucide-react";

import { useChatStore } from "@/stores/chatStore";
import { jumpToPinnedMessage } from "@/services/chatService";
import { toast } from "@/stores/toastStore";

const HIGHLIGHT_MS = 2000;

/** Sits above the message list per open channel (Phase 4 PRD P4.11). */
export function PinnedBar({ channelId }: { channelId: string }) {
  const pinnedMessage = useChatStore((s) => s.channels.get(channelId)?.pinnedMessage);
  const [jumping, setJumping] = useState(false);

  if (!pinnedMessage) return null;

  const handleJump = async () => {
    setJumping(true);
    const found = await jumpToPinnedMessage(channelId, pinnedMessage.id);
    setJumping(false);
    if (!found) {
      toast({ title: "Couldn't find the pinned message", variant: "destructive" });
      return;
    }
    // The message list may need a render tick to mount the just-fetched window before the element exists.
    requestAnimationFrame(() => {
      document.getElementById(`message-${pinnedMessage.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    useChatStore.getState().setHighlightedMessage(pinnedMessage.id);
    setTimeout(() => useChatStore.getState().setHighlightedMessage(null), HIGHLIGHT_MS);
  };

  return (
    <button
      type="button"
      onClick={() => void handleJump()}
      disabled={jumping}
      className="flex min-h-11 w-full items-center gap-2 border-b border-border bg-warning/10 px-3 py-2 text-left text-xs hover:bg-warning/15"
    >
      {jumping ? (
        <Loader2 className="size-3.5 shrink-0 animate-spin text-warning" />
      ) : (
        <Pin className="size-3.5 shrink-0 text-warning" />
      )}
      <span className="truncate text-foreground">
        <span className="font-medium">{pinnedMessage.authorNickname}:</span>{" "}
        {pinnedMessage.content.slice(0, 100)}
      </span>
    </button>
  );
}
