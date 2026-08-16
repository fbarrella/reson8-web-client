import { create } from "zustand";
import type { IDirectMessage } from "@/types/reson8-protocol";

interface DmConversationState {
  messages: IDirectMessage[]; // ascending by createdAt (oldest first)
  hasMoreOlder: boolean;
  loading: boolean;
}

function emptyConversationState(): DmConversationState {
  return { messages: [], hasMoreOlder: true, loading: false };
}

export interface DmPartner {
  userId: string;
  nickname: string;
  isOnline: boolean;
  unreadCount: number;
}

interface DmState {
  conversations: Map<string, DmConversationState>; // keyed by partnerId
  /** Every partner this session knows about — from GET_ONLINE_USERS,
   *  GET_UNREAD_DM_PARTNERS, or simply having opened a conversation with
   *  them. Drives both the DMs tab list and the desktop tab strip. */
  partners: Map<string, DmPartner>;
  openPartnerIds: string[]; // desktop tabs, mirrors chatStore.openChannelIds
  activePartnerId: string | null;
  /** Set once, right after connect, when exactly one unread DM partner
   *  exists and the viewport is mobile-sized — AppShell consumes this once
   *  to auto-navigate, then clears it (Phase 5 PRD P5.2). */
  pendingAutoOpenPartnerId: string | null;

  getConversation: (partnerId: string) => DmConversationState;
  setInitialMessages: (partnerId: string, messages: IDirectMessage[], hasMoreOlder: boolean) => void;
  prependOlderMessages: (partnerId: string, messages: IDirectMessage[], hasMoreOlder: boolean) => void;
  addMessage: (partnerId: string, message: IDirectMessage) => void;
  /** DIRECT_MESSAGE_DELETED broadcasts carry only a dmId (no partnerId), so
   *  this searches every open conversation for the matching message —
   *  same cross-map pattern as setReactions below. */
  removeMessageById: (dmId: string) => void;
  setReactions: (
    dmId: string,
    reactions: Array<{ emoji: string; count: number; userIds: string[] }>,
  ) => void;
  /** Merges freshly-fetched readAt values onto already-loaded messages
   *  without disturbing pagination — see dmService.refreshReadReceipts. */
  mergeReadReceipts: (partnerId: string, messages: IDirectMessage[]) => void;
  setLoading: (partnerId: string, loading: boolean) => void;

  upsertPartner: (partner: DmPartner) => void;
  setOnline: (userId: string, isOnline: boolean) => void;
  setUnreadCount: (userId: string, nickname: string, unreadCount: number) => void;
  markPartnerUnread: (userId: string, nickname: string) => void;
  clearPartnerUnread: (userId: string) => void;

  openPartner: (partnerId: string) => void;
  closePartner: (partnerId: string) => void;
  setActivePartner: (partnerId: string | null) => void;
  setPendingAutoOpen: (partnerId: string | null) => void;

  reset: () => void;
}

function withConversation(
  conversations: Map<string, DmConversationState>,
  partnerId: string,
  updater: (state: DmConversationState) => DmConversationState,
): Map<string, DmConversationState> {
  const next = new Map(conversations);
  const current = next.get(partnerId) ?? emptyConversationState();
  next.set(partnerId, updater(current));
  return next;
}

export const useDmStore = create<DmState>((set, get) => ({
  conversations: new Map(),
  partners: new Map(),
  openPartnerIds: [],
  activePartnerId: null,
  pendingAutoOpenPartnerId: null,

  getConversation: (partnerId) => get().conversations.get(partnerId) ?? emptyConversationState(),

  setInitialMessages: (partnerId, messages, hasMoreOlder) =>
    set((s) => ({
      conversations: withConversation(s.conversations, partnerId, (c) => ({ ...c, messages, hasMoreOlder })),
    })),

  prependOlderMessages: (partnerId, messages, hasMoreOlder) =>
    set((s) => ({
      conversations: withConversation(s.conversations, partnerId, (c) => ({
        ...c,
        messages: [...messages, ...c.messages],
        hasMoreOlder,
      })),
    })),

  addMessage: (partnerId, message) =>
    set((s) => ({
      conversations: withConversation(s.conversations, partnerId, (c) => ({
        ...c,
        messages: c.messages.some((m) => m.id === message.id) ? c.messages : [...c.messages, message],
      })),
    })),

  removeMessageById: (dmId) =>
    set((s) => {
      const next = new Map(s.conversations);
      for (const [partnerId, state] of next) {
        if (!state.messages.some((m) => m.id === dmId)) continue;
        next.set(partnerId, { ...state, messages: state.messages.filter((m) => m.id !== dmId) });
      }
      return { conversations: next };
    }),

  setReactions: (dmId, reactions) =>
    set((s) => {
      const next = new Map(s.conversations);
      for (const [partnerId, state] of next) {
        if (!state.messages.some((m) => m.id === dmId)) continue;
        next.set(partnerId, {
          ...state,
          messages: state.messages.map((m) => (m.id === dmId ? { ...m, reactions } : m)),
        });
      }
      return { conversations: next };
    }),

  mergeReadReceipts: (partnerId, messages) =>
    set((s) => {
      const byId = new Map(messages.map((m) => [m.id, m.readAt]));
      return {
        conversations: withConversation(s.conversations, partnerId, (c) => ({
          ...c,
          messages: c.messages.map((m) => (byId.has(m.id) ? { ...m, readAt: byId.get(m.id) } : m)),
        })),
      };
    }),

  setLoading: (partnerId, loading) =>
    set((s) => ({
      conversations: withConversation(s.conversations, partnerId, (c) => ({ ...c, loading })),
    })),

  upsertPartner: (partner) =>
    set((s) => {
      const next = new Map(s.partners);
      const existing = next.get(partner.userId);
      next.set(partner.userId, existing ? { ...existing, ...partner } : partner);
      return { partners: next };
    }),

  setOnline: (userId, isOnline) =>
    set((s) => {
      const existing = s.partners.get(userId);
      if (!existing) return s;
      const next = new Map(s.partners);
      next.set(userId, { ...existing, isOnline });
      return { partners: next };
    }),

  setUnreadCount: (userId, nickname, unreadCount) =>
    set((s) => {
      const next = new Map(s.partners);
      const existing = next.get(userId);
      next.set(userId, existing ? { ...existing, unreadCount } : { userId, nickname, isOnline: false, unreadCount });
      return { partners: next };
    }),

  markPartnerUnread: (userId, nickname) =>
    set((s) => {
      const next = new Map(s.partners);
      const existing = next.get(userId);
      next.set(
        userId,
        existing
          ? { ...existing, unreadCount: existing.unreadCount + 1 }
          : { userId, nickname, isOnline: true, unreadCount: 1 },
      );
      return { partners: next };
    }),

  clearPartnerUnread: (userId) =>
    set((s) => {
      const existing = s.partners.get(userId);
      if (!existing || existing.unreadCount === 0) return s;
      const next = new Map(s.partners);
      next.set(userId, { ...existing, unreadCount: 0 });
      return { partners: next };
    }),

  openPartner: (partnerId) =>
    set((s) => ({
      openPartnerIds: s.openPartnerIds.includes(partnerId) ? s.openPartnerIds : [...s.openPartnerIds, partnerId],
    })),

  closePartner: (partnerId) =>
    set((s) => ({ openPartnerIds: s.openPartnerIds.filter((id) => id !== partnerId) })),

  setActivePartner: (partnerId) => set({ activePartnerId: partnerId }),
  setPendingAutoOpen: (partnerId) => set({ pendingAutoOpenPartnerId: partnerId }),

  reset: () =>
    set({
      conversations: new Map(),
      partners: new Map(),
      openPartnerIds: [],
      activePartnerId: null,
      pendingAutoOpenPartnerId: null,
    }),
}));
