import { socketService } from "@/services/socketService";
import { useChatStore } from "@/stores/chatStore";
import { reportAckError } from "@/lib/ackError";

const PAGE_SIZE = 50;

export async function loadInitialMessages(channelId: string): Promise<void> {
  useChatStore.getState().setLoading(channelId, true);
  const res = await socketService.fetchMessages({ channelId, limit: PAGE_SIZE });
  useChatStore.getState().setLoading(channelId, false);
  if (!res.success || !res.messages) {
    reportAckError("Couldn't load messages", res.error);
    return;
  }
  const hasMoreOlder = res.messages.length >= PAGE_SIZE;
  useChatStore.getState().setInitialMessages(channelId, res.messages, res.pinnedMessage, hasMoreOlder);
}

export async function loadOlderMessages(channelId: string): Promise<void> {
  const state = useChatStore.getState().getChannel(channelId);
  if (state.loading || !state.hasMoreOlder || state.messages.length === 0) return;
  const oldest = state.messages[0];
  if (!oldest) return;

  useChatStore.getState().setLoading(channelId, true);
  const res = await socketService.fetchMessages({ channelId, before: oldest.id, limit: PAGE_SIZE });
  useChatStore.getState().setLoading(channelId, false);
  if (!res.success || !res.messages) {
    reportAckError("Couldn't load older messages", res.error);
    return;
  }
  useChatStore.getState().prependOlderMessages(channelId, res.messages, res.messages.length >= PAGE_SIZE);
}

export async function sendMessage(
  channelId: string,
  content: string,
  attachmentUrl?: string,
  attachmentPublicId?: string,
): Promise<boolean> {
  const res = await socketService.sendMessage({ channelId, content, attachmentUrl, attachmentPublicId });
  if (!res.success) {
    reportAckError("Couldn't send message", undefined);
    return false;
  }
  return true;
}

export async function editMessage(messageId: string, content: string): Promise<boolean> {
  const res = await socketService.editMessage(messageId, content);
  if (!res.success) {
    reportAckError("Couldn't edit message", res.error);
    return false;
  }
  return true;
}

export async function deleteMessage(messageId: string): Promise<boolean> {
  const res = await socketService.deleteMessage(messageId);
  if (!res.success) {
    reportAckError("Couldn't delete message", res.error);
    return false;
  }
  return true;
}

export async function toggleReaction(messageId: string, emoji: string): Promise<boolean> {
  const res = await socketService.toggleReaction(messageId, emoji, false);
  if (!res.success) {
    reportAckError("Couldn't react to message", res.error);
    return false;
  }
  return true;
}

export async function pinMessage(channelId: string, messageId: string): Promise<boolean> {
  const res = await socketService.pinMessage(channelId, messageId);
  if (!res.success) {
    reportAckError("Couldn't pin message", res.error);
    return false;
  }
  return true;
}

export async function unpinMessage(channelId: string): Promise<boolean> {
  const res = await socketService.unpinMessage(channelId);
  if (!res.success) {
    reportAckError("Couldn't unpin message", res.error);
    return false;
  }
  return true;
}

/** Fires when a channel's chat pane becomes the active view (Phase 4 PRD P4.6). */
export async function markChannelRead(channelId: string): Promise<void> {
  useChatStore.getState().clearUnread(channelId);
  await socketService.markChannelRead(channelId);
}

/**
 * Scrolls to and briefly highlights a pinned message, fetching a centered
 * window via `aroundMessageId` first if it isn't already in the loaded page
 * — ported 1:1 from desktop Phase 11 PRD 11.5 (Phase 4 PRD P4.11).
 */
export async function jumpToPinnedMessage(channelId: string, messageId: string): Promise<boolean> {
  const state = useChatStore.getState().getChannel(channelId);
  if (state.messages.some((m) => m.id === messageId)) return true;

  const res = await socketService.fetchMessages({ channelId, aroundMessageId: messageId, limit: PAGE_SIZE });
  if (!res.success || !res.messages) {
    reportAckError("Couldn't load the pinned message", res.error);
    return false;
  }
  useChatStore.getState().replaceWindow(channelId, res.messages);
  return res.messages.some((m) => m.id === messageId);
}
