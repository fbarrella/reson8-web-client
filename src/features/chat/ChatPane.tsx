import { useEffect } from "react";

import { useChatStore } from "@/stores/chatStore";
import { markChannelRead } from "@/services/chatService";
import { PinnedBar } from "@/features/chat/PinnedBar";
import { MessageList } from "@/features/chat/MessageList";
import { Composer } from "@/features/chat/Composer";

/**
 * The one shared chat surface — rendered both as the mobile/tablet
 * full-screen nav-stack destination and beneath the desktop tabs strip
 * (master PRD "one component set, three compositions"; Phase 4 PRD P4.1).
 */
export function ChatPane({ channelId }: { channelId: string }) {
  useEffect(() => {
    useChatStore.getState().setActiveChannel(channelId);
    void markChannelRead(channelId);
    return () => {
      if (useChatStore.getState().activeChannelId === channelId) {
        useChatStore.getState().setActiveChannel(null);
      }
    };
  }, [channelId]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PinnedBar channelId={channelId} />
      <MessageList channelId={channelId} />
      <Composer channelId={channelId} />
    </div>
  );
}
