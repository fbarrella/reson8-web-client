import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Hash, X } from "lucide-react";

import { useChannelTreeStore } from "@/stores/channelTreeStore";
import { useChatStore } from "@/stores/chatStore";
import { ChannelType } from "@/types/reson8-protocol";
import { ChatPane } from "@/features/chat/ChatPane";
import { NsfwConfirmDialog } from "@/features/channels/NsfwConfirmDialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Mobile (`base`): this route IS the pushed nav-stack destination — one pane
 * at a time, with an explicit header back button in addition to the
 * browser/OS back gesture (a real route makes that correct for free).
 * `md:`/`lg:`: a Tabs strip across the top lets several channels stay open
 * simultaneously, matching the desktop client's literal tabbed-chat model —
 * the URL stays the single source of truth for which one is active; the
 * strip just remembers which channels have been visited this session
 * (Phase 4 PRD P4.1).
 */
export function ChatRoute() {
  const { channelId } = useParams<{ channelId: string }>();
  const navigate = useNavigate();
  const node = useChannelTreeStore((s) => (channelId ? s.nodesById.get(channelId) : undefined));
  const openChannelIds = useChatStore((s) => s.openChannelIds);
  const nodesById = useChannelTreeStore((s) => s.nodesById);
  const unreadChannelIds = useChatStore((s) => s.unreadChannelIds);

  // NSFW confirmation (Improvements Round IR1) is gated here — the single
  // route both the channel tree and the Chats tab navigate through — so it
  // always re-prompts, regardless of entry path. `nsfwUnlockedChannelId`
  // tracks confirmation for the *current* visit only: navigating to this
  // channelId again later (e.g. tree -> away -> tree) resets it. Reset
  // happens during render (React's documented "adjusting state when a prop
  // changes" pattern — https://react.dev/learn/you-might-not-need-an-effect
  // #adjusting-some-state-when-a-prop-changes), not in an effect, so the
  // dialog's open/closed state is a plain render-time derivation
  // (`nsfwBlocked` below) rather than state synced via a setState-in-effect.
  const [nsfwUnlockedChannelId, setNsfwUnlockedChannelId] = useState<string | null>(null);
  const [lastRoutedChannelId, setLastRoutedChannelId] = useState(channelId);
  if (channelId !== lastRoutedChannelId) {
    setLastRoutedChannelId(channelId);
    setNsfwUnlockedChannelId(null);
  }

  useEffect(() => {
    if (!channelId || node?.type === ChannelType.VOICE) return;
    // Don't mark an NSFW channel "open" (tab strip / Chats-tab list) until
    // the user actually confirms entry — otherwise it'd appear as an open
    // tab behind the confirmation dialog before they've agreed to see it.
    if (node?.isNsfw && nsfwUnlockedChannelId !== channelId) return;
    useChatStore.getState().openChannel(channelId);
  }, [channelId, node?.type, node?.isNsfw, nsfwUnlockedChannelId]);

  if (!channelId || node?.type === ChannelType.VOICE) {
    return null;
  }

  const nsfwBlocked = Boolean(node?.isNsfw && nsfwUnlockedChannelId !== channelId);

  const closeTab = (id: string) => {
    useChatStore.getState().closeChannel(id);
    if (id !== channelId) return;
    const remaining = openChannelIds.filter((openId) => openId !== id);
    navigate(remaining.length > 0 ? `/app/channels/${remaining[remaining.length - 1]}` : "/app");
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* base: full-screen header with explicit back navigation */}
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-2 lg:hidden">
        <button
          type="button"
          aria-label="Back to channels"
          onClick={() => navigate("/app")}
          className="flex size-11 items-center justify-center text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-5" />
        </button>
        <Hash className="size-4 text-muted-foreground" />
        <span className="truncate text-sm font-semibold text-foreground">{node?.name ?? "Channel"}</span>
        {node?.isNsfw && (
          <Badge variant="destructive" className="shrink-0">
            18+
          </Badge>
        )}
      </div>

      {/* md:/lg: tabs strip for multiple simultaneously-open channels */}
      <Tabs value={channelId} onValueChange={(id) => navigate(`/app/channels/${id}`)} className="hidden lg:block">
        <TabsList>
          {openChannelIds.map((id) => {
            const tabNode = nodesById.get(id);
            return (
              <TabsTrigger key={id} value={id} asChild>
                <div role="tab" className="group/tab cursor-pointer">
                  <Hash className="size-3.5" />
                  <span className="max-w-32 truncate">{tabNode?.name ?? id}</span>
                  {tabNode?.isNsfw && (
                    <Badge variant="destructive" className="shrink-0 px-1 py-0 text-[10px]">
                      18+
                    </Badge>
                  )}
                  {unreadChannelIds.has(id) && id !== channelId && (
                    <>
                      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-primary" />
                      <span className="sr-only">Unread</span>
                    </>
                  )}
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label={`Close ${tabNode?.name ?? "tab"}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(id);
                    }}
                    className={cn(
                      "ml-0.5 flex size-5 items-center justify-center rounded hover:bg-accent",
                      "opacity-0 group-hover/tab:opacity-100 focus-visible:opacity-100",
                    )}
                  >
                    <X className="size-3" />
                  </button>
                </div>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {nsfwBlocked ? (
        <NsfwConfirmDialog
          open={nsfwBlocked}
          onOpenChange={() => {
            /* visibility is derived from `nsfwBlocked`, not synced state — see the note above */
          }}
          channelName={node?.name ?? "this channel"}
          onConfirm={() => setNsfwUnlockedChannelId(channelId)}
          onCancel={() => navigate("/app")}
        />
      ) : (
        <ChatPane channelId={channelId} />
      )}
    </div>
  );
}
