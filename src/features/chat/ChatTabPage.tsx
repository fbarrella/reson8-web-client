import { useNavigate } from "react-router-dom";
import { Hash } from "lucide-react";

import { useChatStore } from "@/stores/chatStore";
import { useChannelTreeStore } from "@/stores/channelTreeStore";
import { Badge } from "@/components/ui/badge";

/**
 * The bottom tab bar's "Chat" destination (master PRD §5.1: "Chat (badge =
 * total unread)"). Distinct from the Channels tree — this is a flat,
 * quick-jump list of channels with unread activity or that were recently
 * opened this session, since the channel *tree* itself already lives one
 * tab over.
 */
export function ChatTabPage() {
  const navigate = useNavigate();
  const unreadChannelIds = useChatStore((s) => s.unreadChannelIds);
  const openChannelIds = useChatStore((s) => s.openChannelIds);
  const nodesById = useChannelTreeStore((s) => s.nodesById);

  const ids = [...new Set([...unreadChannelIds, ...openChannelIds])].filter((id) => nodesById.has(id));

  if (ids.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 p-8 text-center">
        <Hash className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No open or unread channels.</p>
        <p className="text-xs text-muted-foreground">Pick a text channel from the Channels tab to start chatting.</p>
      </div>
    );
  }

  return (
    <ul className="p-2">
      {ids.map((id) => {
        const node = nodesById.get(id);
        if (!node) return null;
        return (
          <li key={id}>
            <button
              type="button"
              onClick={() => navigate(`/app/channels/${id}`)}
              className="flex min-h-11 w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
            >
              <Hash className="size-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate">{node.name}</span>
              {node.isNsfw && (
                <Badge variant="destructive" className="shrink-0">
                  18+
                </Badge>
              )}
              {unreadChannelIds.has(id) && (
                <>
                  <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-primary" />
                  <span className="sr-only">Unread</span>
                </>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
