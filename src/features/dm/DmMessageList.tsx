import { useEffect, useLayoutEffect, useRef } from "react";

import { useDmStore } from "@/stores/dmStore";
import { useConnectionStore } from "@/stores/connectionStore";
import { loadInitialDms, loadOlderDms } from "@/services/dmService";
import { DmMessageRow } from "@/features/dm/DmMessageRow";

const EMPTY_MESSAGES: never[] = [];
const NEAR_BOTTOM_PX = 80;

/** Mirrors MessageList's scroll/pagination behavior 1:1 (Phase 4 PRD P4.2), sourced from dmStore instead of chatStore. */
export function DmMessageList({ partnerId }: { partnerId: string }) {
  const conversation = useDmStore((s) => s.conversations.get(partnerId));
  const messages = conversation?.messages ?? EMPTY_MESSAGES;
  const hasMoreOlder = conversation?.hasMoreOlder ?? true;
  const selfUserId = useConnectionStore((s) => s.selfUserId);
  const nickname = useConnectionStore((s) => s.nickname);

  const containerRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = useRef<number | null>(null);
  const stickToBottomRef = useRef(true);
  const messageCountRef = useRef(0);

  useEffect(() => {
    void loadInitialDms(partnerId);
    stickToBottomRef.current = true;
  }, [partnerId]);

  useEffect(() => {
    const sentinel = topSentinelRef.current;
    const container = containerRef.current;
    if (!sentinel || !container) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMoreOlder) {
          prevScrollHeightRef.current = container.scrollHeight;
          void loadOlderDms(partnerId);
        }
      },
      { root: container, threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [partnerId, hasMoreOlder]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (prevScrollHeightRef.current !== null) {
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

  let lastOwnMessageId: string | null = null;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]!;
    const isOwn = selfUserId !== null ? m.senderId === selfUserId : m.senderNickname === nickname;
    if (isOwn) {
      lastOwnMessageId = m.id;
      break;
    }
  }

  return (
    <div ref={containerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-2 py-2">
      <div ref={topSentinelRef} />
      {messages.length === 0 ? (
        <p className="p-4 text-center text-sm text-muted-foreground">No messages yet — say hello!</p>
      ) : (
        messages.map((message) => (
          <DmMessageRow key={message.id} message={message} isLastOwn={message.id === lastOwnMessageId} />
        ))
      )}
    </div>
  );
}
