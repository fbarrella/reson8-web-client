import { useEffect, useLayoutEffect, useRef } from "react";

import { useChatStore } from "@/stores/chatStore";
import { loadInitialMessages, loadOlderMessages } from "@/services/chatService";
import { MessageRow } from "@/features/chat/MessageRow";

const EMPTY_MESSAGES: never[] = [];
const NEAR_BOTTOM_PX = 80;

/**
 * Keyed, stable list items (each row keyed by message.id) so virtualization
 * can be dropped in later without a rewrite (Phase 4 PRD P4.2 — not a hard
 * requirement this phase). Scroll-to-top loads older history; scroll
 * position is preserved across that prepend by compensating for the height
 * added above the viewport, and new messages only auto-scroll the view down
 * when the reader was already near the bottom.
 */
export function MessageList({ channelId }: { channelId: string }) {
  const channelState = useChatStore((s) => s.channels.get(channelId));
  const pinnedMessageId = channelState?.pinnedMessage?.id;
  const messages = channelState?.messages ?? EMPTY_MESSAGES;
  const hasMoreOlder = channelState?.hasMoreOlder ?? true;

  const containerRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = useRef<number | null>(null);
  const stickToBottomRef = useRef(true);
  const messageCountRef = useRef(0);

  useEffect(() => {
    void loadInitialMessages(channelId);
    stickToBottomRef.current = true;
  }, [channelId]);

  useEffect(() => {
    const sentinel = topSentinelRef.current;
    const container = containerRef.current;
    if (!sentinel || !container) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMoreOlder) {
          prevScrollHeightRef.current = container.scrollHeight;
          void loadOlderMessages(channelId);
        }
      },
      { root: container, threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [channelId, hasMoreOlder]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (prevScrollHeightRef.current !== null) {
      // Older messages were just prepended — keep the reader's viewport
      // pinned to the same content, not yanked to the new top.
      container.scrollTop += container.scrollHeight - prevScrollHeightRef.current;
      prevScrollHeightRef.current = null;
    } else if (messages.length !== messageCountRef.current && stickToBottomRef.current) {
      container.scrollTop = container.scrollHeight;
    }
    messageCountRef.current = messages.length;
  }, [messages]);

  const handleScroll = () => {
    const container = containerRef.current;
    if (!container) return;
    stickToBottomRef.current =
      container.scrollHeight - container.scrollTop - container.clientHeight < NEAR_BOTTOM_PX;
  };

  return (
    <div ref={containerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-2 py-2">
      <div ref={topSentinelRef} />
      {messages.length === 0 ? (
        <p className="p-4 text-center text-sm text-muted-foreground">No messages yet — say hello!</p>
      ) : (
        messages.map((message) => (
          <MessageRow key={message.id} message={message} isPinned={message.id === pinnedMessageId} />
        ))
      )}
    </div>
  );
}
