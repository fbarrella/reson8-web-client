import { socketService } from "@/services/socketService";
import { useDmStore } from "@/stores/dmStore";
import { reportAckError } from "@/lib/ackError";
import type { IOnlineUser } from "@/types/reson8-protocol";

const PAGE_SIZE = 50;

export async function loadInitialDms(partnerId: string): Promise<void> {
  useDmStore.getState().setLoading(partnerId, true);
  const res = await socketService.fetchDirectMessages({ partnerId, limit: PAGE_SIZE });
  useDmStore.getState().setLoading(partnerId, false);
  if (!res.success || !res.messages) {
    reportAckError("Couldn't load messages", res.error);
    return;
  }
  const hasMoreOlder = res.messages.length >= PAGE_SIZE;
  useDmStore.getState().setInitialMessages(partnerId, res.messages, hasMoreOlder);
}

export async function loadOlderDms(partnerId: string): Promise<void> {
  const state = useDmStore.getState().getConversation(partnerId);
  if (state.loading || !state.hasMoreOlder || state.messages.length === 0) return;
  const oldest = state.messages[0];
  if (!oldest) return;

  useDmStore.getState().setLoading(partnerId, true);
  const res = await socketService.fetchDirectMessages({ partnerId, before: oldest.id, limit: PAGE_SIZE });
  useDmStore.getState().setLoading(partnerId, false);
  if (!res.success || !res.messages) {
    reportAckError("Couldn't load older messages", res.error);
    return;
  }
  useDmStore.getState().prependOlderMessages(partnerId, res.messages, res.messages.length >= PAGE_SIZE);
}

export async function sendDirectMessage(
  partnerId: string,
  content: string,
  attachmentUrl?: string,
  attachmentPublicId?: string,
): Promise<boolean> {
  const res = await socketService.sendDirectMessage({
    recipientId: partnerId,
    content,
    attachmentUrl,
    attachmentPublicId,
  });
  if (!res.success) {
    reportAckError("Couldn't send message", res.error);
    return false;
  }
  return true;
}

/** Store removal happens via the DIRECT_MESSAGE_DELETED broadcast (connectionService), same pattern as channel messages. */
export async function deleteDirectMessage(dmId: string): Promise<boolean> {
  const res = await socketService.deleteDirectMessage(dmId);
  if (!res.success) {
    reportAckError("Couldn't delete message", res.error);
    return false;
  }
  return true;
}

export async function toggleReaction(messageId: string, emoji: string): Promise<boolean> {
  const res = await socketService.toggleReaction(messageId, emoji, true);
  if (!res.success) {
    reportAckError("Couldn't react to message", res.error);
    return false;
  }
  return true;
}

/** Fires when a DM conversation becomes the active view (Phase 5 PRD P5.5). */
export async function markDmsRead(partnerId: string): Promise<void> {
  useDmStore.getState().clearPartnerUnread(partnerId);
  await socketService.markDmsRead(partnerId);
}

/**
 * The wire protocol has no server→client broadcast for "your message was
 * just read" (confirmed against ../reson8/apps/server/src/handlers/dm.handler.ts
 * — MARK_DMS_READ only acks the caller, it never notifies the other party).
 * True live push isn't possible without a protocol change, so read receipts
 * are approximated event-driven: re-fetch the latest page and merge readAt
 * onto already-loaded messages whenever the partner sends us something new
 * while the conversation is open (a strong signal they were just present) —
 * see connectionService's DIRECT_MESSAGE_RECEIVED handler. This covers the
 * common "both people actively chatting" case without inventing a fake
 * server event or resorting to blind polling.
 */
export async function refreshReadReceipts(partnerId: string): Promise<void> {
  const res = await socketService.fetchDirectMessages({ partnerId, limit: PAGE_SIZE });
  if (!res.success || !res.messages) return;
  useDmStore.getState().mergeReadReceipts(partnerId, res.messages);
}

export async function loadOnlineUsers(): Promise<IOnlineUser[]> {
  const res = await socketService.getOnlineUsers();
  if (!res.success || !res.users) {
    reportAckError("Couldn't load online users", res.error);
    return [];
  }
  for (const user of res.users) {
    useDmStore.getState().upsertPartner({
      userId: user.userId,
      nickname: user.nickname,
      isOnline: user.isOnline,
      unreadCount: useDmStore.getState().partners.get(user.userId)?.unreadCount ?? 0,
    });
  }
  return res.users;
}

export async function nudgeUser(targetUserId: string): Promise<boolean> {
  const res = await socketService.nudgeUser(targetUserId);
  if (!res.success) {
    reportAckError("Couldn't nudge this user", res.error);
    return false;
  }
  return true;
}
