import { io, type Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  IRole,
  IUser,
  IMessage,
  IPinnedMessage,
  ICustomEmoji,
  IDirectMessage,
  IOnlineUser,
  IBannedUser,
} from "@/types/reson8-protocol";

export type ResonSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/** Extracts the ack callback's resolved payload type for a ClientToServerEvents entry. */
type AckPayload<Ev extends keyof ClientToServerEvents> = ClientToServerEvents[Ev] extends (
  payload: never,
  ack: (response: infer R) => void,
) => void
  ? R
  : ClientToServerEvents[Ev] extends (ack: (response: infer R) => void) => void
    ? R
    : never;

/**
 * Thin typed wrapper around socket.io-client (Phase 1 PRD P1.5) — the
 * underlying Socket<ServerToClientEvents, ClientToServerEvents> instance is
 * already fully typed for `.on`/`.emit`, so this only adds: a single
 * persistent connection lifecycle (this app never connects to more than one
 * server at a time — master PRD §7 non-goal 5), and promise wrappers for the
 * ack-based events this phase actually uses. Extend with more promise
 * wrappers as later phases need them, rather than a fully generic
 * emit-with-ack utility up front.
 */
class SocketService {
  private socket: ResonSocket | null = null;

  connect(serverUrl: string): ResonSocket {
    this.socket?.disconnect();
    this.socket = io(serverUrl, {
      transports: ["websocket", "polling"],
      autoConnect: true,
    });
    return this.socket;
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  get instance(): ResonSocket {
    if (!this.socket) {
      throw new Error("socketService: not connected — call connect() first");
    }
    return this.socket;
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  joinServer(payload: {
    serverId?: string;
    nickname: string;
    instanceId: string;
    password?: string;
  }): Promise<{ success: boolean; serverId?: string; error?: string }> {
    return new Promise((resolve) => {
      this.instance.emit("USER_JOIN_SERVER", payload, resolve);
    });
  }

  leaveServer(serverId: string): void {
    this.instance.emit("USER_LEAVE_SERVER", { serverId });
  }

  joinChannel(channelId: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      this.instance.emit("USER_JOIN_CHANNEL", { channelId }, resolve);
    });
  }

  leaveChannel(channelId: string): void {
    this.instance.emit("USER_LEAVE_CHANNEL", { channelId });
  }

  pingLatency(): Promise<number> {
    return new Promise((resolve) => {
      this.instance.emit("PING_LATENCY", resolve);
    });
  }

  // ── Voice/WebRTC handshake (Phase 2 PRD P2.2) ──────────────────────────

  getRouterCapabilities(
    channelId: string,
  ): Promise<{ success: boolean; rtpCapabilities?: unknown; error?: string }> {
    return new Promise((resolve) => {
      this.instance.emit("GET_ROUTER_CAPABILITIES", { channelId }, resolve);
    });
  }

  createWebRtcTransport(
    channelId: string,
    direction: "send" | "recv",
  ): Promise<AckPayload<"CREATE_WEBRTC_TRANSPORT">> {
    return new Promise((resolve) => {
      this.instance.emit("CREATE_WEBRTC_TRANSPORT", { channelId, direction }, resolve);
    });
  }

  connectTransport(
    transportId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dtlsParameters: any,
  ): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- dtlsParameters is mediasoup's own opaque shape, `any` on the wire per the vendored protocol types
      this.instance.emit("CONNECT_TRANSPORT", { transportId, dtlsParameters }, resolve);
    });
  }

  produce(
    transportId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rtpParameters: any,
  ): Promise<{ success: boolean; producerId?: string; error?: string }> {
    return new Promise((resolve) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- rtpParameters is mediasoup's own opaque shape, `any` on the wire per the vendored protocol types
      this.instance.emit("PRODUCE", { transportId, kind: "audio", rtpParameters }, resolve);
    });
  }

  consume(
    producerId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rtpCapabilities?: any,
  ): Promise<AckPayload<"CONSUME">> {
    return new Promise((resolve) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- rtpCapabilities is mediasoup's own opaque shape, `any` on the wire per the vendored protocol types
      this.instance.emit("CONSUME", { producerId, rtpCapabilities }, resolve);
    });
  }

  resumeConsumer(consumerId: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      this.instance.emit("RESUME_CONSUMER", { consumerId }, resolve);
    });
  }

  closeProducer(producerId: string): void {
    this.instance.emit("CLOSE_PRODUCER", { producerId });
  }

  setVoiceState(isMuted: boolean, isDeafened: boolean): Promise<{ success: boolean }> {
    return new Promise((resolve) => {
      this.instance.emit("SET_VOICE_STATE", { isMuted, isDeafened }, resolve);
    });
  }

  // ── Roles / permissions (Phase 3 PRD P3.4 gating; full Roles UI is Phase 6) ──

  getAllUsers(
    serverId: string,
  ): Promise<{ success: boolean; users?: Array<IUser & { roles: IRole[] }>; error?: string }> {
    return new Promise((resolve) => {
      this.instance.emit("GET_ALL_USERS", { serverId }, resolve);
    });
  }

  // ── Channel CRUD / reorder (Phase 3 PRD P3.4 / P3.6) ────────────────────

  createChannel(payload: {
    serverId: string;
    name: string;
    type: "TEXT" | "VOICE";
    parentId?: string | null;
    isNsfw?: boolean;
  }): Promise<{ success: boolean; channelId?: string; error?: string }> {
    return new Promise((resolve) => {
      this.instance.emit("CREATE_CHANNEL", payload, resolve);
    });
  }

  deleteChannel(channelId: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      this.instance.emit("DELETE_CHANNEL", { channelId }, resolve);
    });
  }

  updateChannel(payload: {
    channelId: string;
    name?: string;
    position?: number;
    isNsfw?: boolean;
  }): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      this.instance.emit("UPDATE_CHANNEL", payload, resolve);
    });
  }

  reorderChannels(
    parentId: string | null,
    orderedChannelIds: string[],
  ): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      this.instance.emit("REORDER_CHANNELS", { parentId, orderedChannelIds }, resolve);
    });
  }

  // ── Text chat (Phase 4 PRD P4.2-P4.6) ───────────────────────────────────

  sendMessage(payload: {
    channelId: string;
    content: string;
    attachmentUrl?: string;
    attachmentPublicId?: string;
  }): Promise<{ success: boolean; messageId?: string }> {
    return new Promise((resolve) => {
      this.instance.emit("SEND_MESSAGE", payload, resolve);
    });
  }

  fetchMessages(payload: {
    channelId: string;
    before?: string;
    limit?: number;
    aroundMessageId?: string;
  }): Promise<{ success: boolean; messages?: IMessage[]; pinnedMessage?: IPinnedMessage | null; error?: string }> {
    return new Promise((resolve) => {
      this.instance.emit("FETCH_MESSAGES", payload, resolve);
    });
  }

  markChannelRead(channelId: string): Promise<{ success: boolean }> {
    return new Promise((resolve) => {
      this.instance.emit("MARK_CHANNEL_READ", { channelId }, resolve);
    });
  }

  deleteMessage(messageId: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      this.instance.emit("DELETE_MESSAGE", { messageId }, resolve);
    });
  }

  editMessage(messageId: string, content: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      this.instance.emit("EDIT_MESSAGE", { messageId, content }, resolve);
    });
  }

  // ── Reactions / custom emoji (Phase 4 PRD P4.8/P4.9) ────────────────────

  toggleReaction(messageId: string, emoji: string, isDm: boolean): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      this.instance.emit("TOGGLE_REACTION", { messageId, emoji, isDm }, resolve);
    });
  }

  createCustomEmoji(
    name: string,
    imageUrl: string,
    imagePublicId?: string,
  ): Promise<{ success: boolean; emojiId?: string; error?: string }> {
    return new Promise((resolve) => {
      this.instance.emit("CREATE_CUSTOM_EMOJI", { name, imageUrl, imagePublicId }, resolve);
    });
  }

  getApprovedEmojis(): Promise<{ success: boolean; emojis?: ICustomEmoji[]; error?: string }> {
    return new Promise((resolve) => {
      this.instance.emit("GET_APPROVED_EMOJIS", resolve);
    });
  }

  // ── Pinned messages (Phase 4 PRD P4.11) ─────────────────────────────────

  pinMessage(channelId: string, messageId: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      this.instance.emit("PIN_MESSAGE", { channelId, messageId }, resolve);
    });
  }

  unpinMessage(channelId: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      this.instance.emit("UNPIN_MESSAGE", { channelId }, resolve);
    });
  }

  // ── Direct messages (Phase 5 PRD P5.3-P5.5) ─────────────────────────────

  sendDirectMessage(payload: {
    recipientId: string;
    content: string;
    attachmentUrl?: string;
    attachmentPublicId?: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    return new Promise((resolve) => {
      this.instance.emit("SEND_DIRECT_MESSAGE", payload, resolve);
    });
  }

  fetchDirectMessages(payload: {
    partnerId: string;
    before?: string;
    limit?: number;
  }): Promise<{ success: boolean; messages?: IDirectMessage[]; error?: string }> {
    return new Promise((resolve) => {
      this.instance.emit("FETCH_DIRECT_MESSAGES", payload, resolve);
    });
  }

  deleteDirectMessage(dmId: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      this.instance.emit("DELETE_DIRECT_MESSAGE", { dmId }, resolve);
    });
  }

  getOnlineUsers(): Promise<{ success: boolean; users?: IOnlineUser[]; error?: string }> {
    return new Promise((resolve) => {
      this.instance.emit("GET_ONLINE_USERS", resolve);
    });
  }

  markDmsRead(partnerId: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      this.instance.emit("MARK_DMS_READ", { partnerId }, resolve);
    });
  }

  getUnreadDmPartners(): Promise<{
    success: boolean;
    partners?: { partnerId: string; partnerNickname: string; unreadCount: number }[];
    error?: string;
  }> {
    return new Promise((resolve) => {
      this.instance.emit("GET_UNREAD_DM_PARTNERS", resolve);
    });
  }

  // ── Nudge (Phase 5 PRD P5.6) ─────────────────────────────────────────────

  nudgeUser(targetUserId: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      this.instance.emit("NUDGE_USER", { targetUserId }, resolve);
    });
  }

  getServerSettings(): Promise<{ success: boolean; nudgeEnabled?: boolean; error?: string }> {
    return new Promise((resolve) => {
      this.instance.emit("GET_SERVER_SETTINGS", resolve);
    });
  }

  /** Requires ADMIN — writable surface ships in Phase 6; the wrapper lives here since it's part of the same event family. */
  updateServerSettings(nudgeEnabled: boolean): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      this.instance.emit("UPDATE_SERVER_SETTINGS", { nudgeEnabled }, resolve);
    });
  }

  // ── Roles / admin (Phase 6 PRD P6.1) — requires MANAGE_ROLES ───────────

  getRoles(serverId: string): Promise<{ success: boolean; roles?: IRole[]; error?: string }> {
    return new Promise((resolve) => {
      this.instance.emit("GET_ROLES", { serverId }, resolve);
    });
  }

  assignRole(
    userId: string,
    roleId: string,
    action: "add" | "remove",
  ): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      this.instance.emit("ASSIGN_ROLE", { userId, roleId, action }, resolve);
    });
  }

  // ── Moderation (Phase 6 PRD P6.4/P6.5) ──────────────────────────────────

  kickUser(userId: string, channelId: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      this.instance.emit("KICK_USER", { userId, channelId }, resolve);
    });
  }

  banUser(userId: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      this.instance.emit("BAN_USER", { userId }, resolve);
    });
  }

  unbanUser(userId: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      this.instance.emit("UNBAN_USER", { userId }, resolve);
    });
  }

  getBannedUsers(): Promise<{ success: boolean; users?: IBannedUser[]; error?: string }> {
    return new Promise((resolve) => {
      this.instance.emit("GET_BANNED_USERS", resolve);
    });
  }

  // ── Custom emoji review (Phase 6 PRD P6.2) — requires MANAGE_EMOJIS ────

  getPendingEmojis(): Promise<{ success: boolean; emojis?: ICustomEmoji[]; error?: string }> {
    return new Promise((resolve) => {
      this.instance.emit("GET_PENDING_EMOJIS", resolve);
    });
  }

  reviewCustomEmoji(
    emojiId: string,
    decision: "APPROVED" | "REJECTED",
  ): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      this.instance.emit("REVIEW_CUSTOM_EMOJI", { emojiId, decision }, resolve);
    });
  }
}

export const socketService = new SocketService();
