import { create } from "zustand";
import type { IMessage, IPinnedMessage } from "@/types/reson8-protocol";

interface ChannelChatState {
  messages: IMessage[]; // ascending by createdAt (oldest first)
  hasMoreOlder: boolean;
  pinnedMessage: IPinnedMessage | null;
  loading: boolean;
}

function emptyChannelState(): ChannelChatState {
  return { messages: [], hasMoreOlder: true, pinnedMessage: null, loading: false };
}

interface ChatState {
  channels: Map<string, ChannelChatState>;
  /** Desktop (md:/lg:) open-tabs order — the URL route is still the source
   *  of truth for "which one is active" (Phase 4 PRD P4.1). */
  openChannelIds: string[];
  /** The channel whose ChatPane is currently the focused/active view (mobile:
   *  the pushed nav-stack route; desktop: the focused tab) — Phase 4 PRD
   *  P4.6 gates unread-marking and MARK_CHANNEL_READ on this, not just
   *  "open" (a desktop tab can be open but not the focused one). */
  activeChannelId: string | null;
  unreadChannelIds: Set<string>;
  /** Briefly set after a jump-to-pin scroll, cleared ~2s later — drives
   *  MessageRow's highlight ring (Phase 4 PRD P4.11, ported from desktop
   *  Phase 11 PRD 11.5's `msg-highlight` class). */
  highlightedMessageId: string | null;

  getChannel: (channelId: string) => ChannelChatState;
  setInitialMessages: (
    channelId: string,
    messages: IMessage[],
    pinnedMessage: IPinnedMessage | null | undefined,
    hasMoreOlder: boolean,
  ) => void;
  prependOlderMessages: (channelId: string, messages: IMessage[], hasMoreOlder: boolean) => void;
  replaceWindow: (channelId: string, messages: IMessage[]) => void;
  addMessage: (message: IMessage) => void;
  updateMessage: (message: IMessage) => void;
  removeMessage: (channelId: string, messageId: string) => void;
  setReactions: (
    messageId: string,
    reactions: Array<{ emoji: string; count: number; userIds: string[] }>,
  ) => void;
  setPinned: (channelId: string, pinnedMessage: IPinnedMessage | null) => void;
  setLoading: (channelId: string, loading: boolean) => void;

  openChannel: (channelId: string) => void;
  closeChannel: (channelId: string) => void;
  setActiveChannel: (channelId: string | null) => void;
  setHighlightedMessage: (messageId: string | null) => void;

  hydrateInitialUnread: (channelIds: string[]) => void;
  markUnread: (channelId: string) => void;
  clearUnread: (channelId: string) => void;

  reset: () => void;
}

function withChannel(
  channels: Map<string, ChannelChatState>,
  channelId: string,
  updater: (state: ChannelChatState) => ChannelChatState,
): Map<string, ChannelChatState> {
  const next = new Map(channels);
  const current = next.get(channelId) ?? emptyChannelState();
  next.set(channelId, updater(current));
  return next;
}

export const useChatStore = create<ChatState>((set, get) => ({
  channels: new Map(),
  openChannelIds: [],
  activeChannelId: null,
  unreadChannelIds: new Set(),
  highlightedMessageId: null,

  getChannel: (channelId) => get().channels.get(channelId) ?? emptyChannelState(),

  setInitialMessages: (channelId, messages, pinnedMessage, hasMoreOlder) =>
    set((s) => ({
      channels: withChannel(s.channels, channelId, (c) => ({
        ...c,
        messages,
        hasMoreOlder,
        pinnedMessage: pinnedMessage ?? c.pinnedMessage,
      })),
    })),

  prependOlderMessages: (channelId, messages, hasMoreOlder) =>
    set((s) => ({
      channels: withChannel(s.channels, channelId, (c) => ({
        ...c,
        messages: [...messages, ...c.messages],
        hasMoreOlder,
      })),
    })),

  replaceWindow: (channelId, messages) =>
    set((s) => ({
      channels: withChannel(s.channels, channelId, (c) => ({ ...c, messages })),
    })),

  addMessage: (message) =>
    set((s) => ({
      channels: withChannel(s.channels, message.channelId, (c) => ({
        ...c,
        messages: c.messages.some((m) => m.id === message.id) ? c.messages : [...c.messages, message],
      })),
    })),

  updateMessage: (message) =>
    set((s) => ({
      channels: withChannel(s.channels, message.channelId, (c) => ({
        ...c,
        messages: c.messages.map((m) => (m.id === message.id ? message : m)),
      })),
    })),

  removeMessage: (channelId, messageId) =>
    set((s) => ({
      channels: withChannel(s.channels, channelId, (c) => ({
        ...c,
        messages: c.messages.filter((m) => m.id !== messageId),
      })),
    })),

  setReactions: (messageId, reactions) =>
    set((s) => {
      const next = new Map(s.channels);
      for (const [channelId, state] of next) {
        if (!state.messages.some((m) => m.id === messageId)) continue;
        next.set(channelId, {
          ...state,
          messages: state.messages.map((m) => (m.id === messageId ? { ...m, reactions } : m)),
        });
      }
      return { channels: next };
    }),

  setPinned: (channelId, pinnedMessage) =>
    set((s) => ({
      channels: withChannel(s.channels, channelId, (c) => ({ ...c, pinnedMessage })),
    })),

  setLoading: (channelId, loading) =>
    set((s) => ({
      channels: withChannel(s.channels, channelId, (c) => ({ ...c, loading })),
    })),

  openChannel: (channelId) =>
    set((s) => ({
      openChannelIds: s.openChannelIds.includes(channelId) ? s.openChannelIds : [...s.openChannelIds, channelId],
    })),

  closeChannel: (channelId) =>
    set((s) => ({ openChannelIds: s.openChannelIds.filter((id) => id !== channelId) })),

  setActiveChannel: (channelId) => set({ activeChannelId: channelId }),
  setHighlightedMessage: (messageId) => set({ highlightedMessageId: messageId }),

  hydrateInitialUnread: (channelIds) => set({ unreadChannelIds: new Set(channelIds) }),
  markUnread: (channelId) => set((s) => ({ unreadChannelIds: new Set(s.unreadChannelIds).add(channelId) })),
  clearUnread: (channelId) =>
    set((s) => {
      if (!s.unreadChannelIds.has(channelId)) return s;
      const next = new Set(s.unreadChannelIds);
      next.delete(channelId);
      return { unreadChannelIds: next };
    }),

  reset: () =>
    set({ channels: new Map(), openChannelIds: [], activeChannelId: null, unreadChannelIds: new Set() }),
}));
