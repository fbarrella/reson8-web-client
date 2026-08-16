import { socketService, type ResonSocket } from "@/services/socketService";
import { useConnectionStore } from "@/stores/connectionStore";
import { useChannelTreeStore } from "@/stores/channelTreeStore";
import { usePermissionsStore } from "@/stores/permissionsStore";
import { useChatStore } from "@/stores/chatStore";
import { useCustomEmojiStore } from "@/stores/customEmojiStore";
import { useDmStore } from "@/stores/dmStore";
import { useServerSettingsStore } from "@/stores/serverSettingsStore";
import { toast } from "@/stores/toastStore";
import { soundAlert } from "@/lib/soundAlert";
import { isPermissionDeniedMessage } from "@/lib/ackError";
import { vibrate, setAppBadge, clearAppBadge } from "@/lib/deviceAlerts";
import * as voiceConnectionService from "@/services/voiceConnectionService";
import { refreshPermissions } from "@/services/permissionsService";
import { refreshReadReceipts } from "@/services/dmService";
import type { ServerToClientEvents, IChannelTreeNode } from "@/types/reson8-protocol";

const MOBILE_BREAKPOINT_QUERY = "(max-width: 1023.98px)"; // matches the lg: breakpoint used throughout the shell

const PING_INTERVAL_MS = 3000;

let cleanupLifecycle: (() => void) | null = null;

/**
 * `hasUnread` is only reliable on the very first per-socket, join-time tree
 * — not on later broadcast-triggered updates shared by every recipient
 * (CLAUDE.md's protocol reference is explicit about this). Hydrate the
 * chatStore's unread set from it exactly once per connection; every unread
 * change after that comes from MESSAGE_RECEIVED/MARK_CHANNEL_READ instead
 * (Phase 4 PRD P4.6).
 */
function collectUnreadChannelIds(nodes: IChannelTreeNode[], out: string[]): void {
  for (const node of nodes) {
    if (node.hasUnread) out.push(node.id);
    if (node.children.length > 0) collectUnreadChannelIds(node.children, out);
  }
}

function currentUnreadDmTotal(): number {
  let total = 0;
  for (const partner of useDmStore.getState().partners.values()) total += partner.unreadCount;
  return total;
}

/**
 * GET_UNREAD_DM_PARTNERS hydration (Phase 5 PRD P5.2): populates the DMs
 * tab list + badge on every platform, and additionally auto-navigates on
 * mobile when there's exactly one unread partner (desktop instead just
 * opens the tab, matching each platform's own navigation idiom — see the
 * PRD's explicit call-out against auto-pushing multiple nav-stack entries).
 */
async function hydrateUnreadDmPartners(): Promise<void> {
  const res = await socketService.getUnreadDmPartners();
  if (!res.success || !res.partners) return;
  for (const partner of res.partners) {
    useDmStore.getState().upsertPartner({
      userId: partner.partnerId,
      nickname: partner.partnerNickname,
      isOnline: useDmStore.getState().partners.get(partner.partnerId)?.isOnline ?? false,
      unreadCount: partner.unreadCount,
    });
    useDmStore.getState().openPartner(partner.partnerId);
  }
  if (res.partners.length === 1 && window.matchMedia(MOBILE_BREAKPOINT_QUERY).matches) {
    useDmStore.getState().setPendingAutoOpen(res.partners[0]!.partnerId);
  }
}

async function fetchServerSettings(): Promise<void> {
  const res = await socketService.getServerSettings();
  if (res.success && typeof res.nudgeEnabled === "boolean") {
    useServerSettingsStore.getState().setNudgeEnabled(res.nudgeEnabled);
  }
}

function startPingLoop(socket: ResonSocket): () => void {
  const tick = () => {
    if (!socket.connected) return;
    const sentAt = Date.now();
    socket.emit("PING_LATENCY", (serverTime) => {
      const receivedAt = Date.now();
      const rtt = receivedAt - sentAt;
      const offset = serverTime - (sentAt + rtt / 2);
      useConnectionStore.getState().setLatency(rtt, offset);
    });
  };
  tick();
  const interval = setInterval(tick, PING_INTERVAL_MS);
  return () => clearInterval(interval);
}

function attachLifecycleListeners(socket: ResonSocket, joinParams: ConnectParams): () => void {
  const stopPing = startPingLoop(socket);
  let unreadHydrated = false;

  const handleTreeUpdate: ServerToClientEvents["CHANNEL_TREE_UPDATE"] = (payload) => {
    useChannelTreeStore.getState().setTree(payload.tree);
    if (!unreadHydrated) {
      unreadHydrated = true;
      const unreadIds: string[] = [];
      collectUnreadChannelIds(payload.tree, unreadIds);
      useChatStore.getState().hydrateInitialUnread(unreadIds);
    }
  };
  const handlePresenceUpdate: ServerToClientEvents["PRESENCE_UPDATE"] = (payload) => {
    useChannelTreeStore.getState().updatePresence(payload.channelId, payload.occupants);
    voiceConnectionService.handlePresenceUpdateForVoice(payload);
  };
  const handleChannelCreated: ServerToClientEvents["CHANNEL_CREATED"] = () => {
    soundAlert.play("channel_created");
  };
  const handleChannelDeleted: ServerToClientEvents["CHANNEL_DELETED"] = () => {
    soundAlert.play("channel_deleted");
  };
  const handleMessageReceived: ServerToClientEvents["MESSAGE_RECEIVED"] = (message) => {
    useChatStore.getState().addMessage(message);
    const { activeChannelId } = useChatStore.getState();
    const { nickname, selfUserId, setSelfUserId } = useConnectionStore.getState();
    const isOwnMessage = message.nickname === nickname;
    if (isOwnMessage && !selfUserId) setSelfUserId(message.userId);
    if (message.channelId !== activeChannelId && !isOwnMessage) {
      useChatStore.getState().markUnread(message.channelId);
    }
  };
  const handleMessageEdited: ServerToClientEvents["MESSAGE_EDITED"] = (message) => {
    useChatStore.getState().updateMessage(message);
  };
  const handleMessageDeleted: ServerToClientEvents["MESSAGE_DELETED"] = (payload) => {
    useChatStore.getState().removeMessage(payload.channelId, payload.messageId);
  };
  const handleReactionUpdated: ServerToClientEvents["REACTION_UPDATED"] = (payload) => {
    if (payload.isDm) {
      useDmStore.getState().setReactions(payload.messageId, payload.reactions);
    } else {
      useChatStore.getState().setReactions(payload.messageId, payload.reactions);
    }
  };
  const handleChannelPinUpdated: ServerToClientEvents["CHANNEL_PIN_UPDATED"] = (payload) => {
    useChatStore.getState().setPinned(payload.channelId, payload.pinnedMessage);
  };
  const handleCustomEmojiApproved: ServerToClientEvents["CUSTOM_EMOJI_APPROVED"] = (payload) => {
    useCustomEmojiStore.getState().upsert(payload.emoji);
  };
  const handleDirectMessageReceived: ServerToClientEvents["DIRECT_MESSAGE_RECEIVED"] = (message) => {
    const { nickname, selfUserId, setSelfUserId } = useConnectionStore.getState();
    const isOwnMessage = message.senderNickname === nickname;
    if (isOwnMessage && !selfUserId) setSelfUserId(message.senderId);
    const partnerId = isOwnMessage ? message.receiverId : message.senderId;
    const partnerNickname = isOwnMessage
      ? (useDmStore.getState().partners.get(partnerId)?.nickname ?? partnerId)
      : message.senderNickname;

    useDmStore.getState().addMessage(partnerId, message);
    useDmStore.getState().upsertPartner({
      userId: partnerId,
      nickname: partnerNickname,
      isOnline: true,
      unreadCount: useDmStore.getState().partners.get(partnerId)?.unreadCount ?? 0,
    });

    const { activePartnerId } = useDmStore.getState();
    if (isOwnMessage) return;
    if (partnerId !== activePartnerId) {
      useDmStore.getState().markPartnerUnread(partnerId, partnerNickname);
      soundAlert.play("hey_wake_up");
      if (document.visibilityState !== "visible") setAppBadge(currentUnreadDmTotal());
    } else {
      // The partner is clearly active right now — a good opportunistic
      // moment to pick up any read-receipt change on our own sent messages
      // (no live push exists for that — see dmService.refreshReadReceipts).
      void refreshReadReceipts(partnerId);
    }
  };
  const handleDirectMessageDeleted: ServerToClientEvents["DIRECT_MESSAGE_DELETED"] = (payload) => {
    useDmStore.getState().removeMessageById(payload.dmId);
  };
  const handleNudgeReceived: ServerToClientEvents["NUDGE_RECEIVED"] = (payload) => {
    toast({ title: "Nudge!", description: `${payload.fromNickname} nudged you.` });
    soundAlert.play("nudge", "nudge");
    vibrate([200, 100, 200]);
    if (document.visibilityState !== "visible") setAppBadge(Math.max(currentUnreadDmTotal(), 1));
  };
  const handleServerSettingsUpdated: ServerToClientEvents["SERVER_SETTINGS_UPDATED"] = (payload) => {
    useServerSettingsStore.getState().setNudgeEnabled(payload.nudgeEnabled);
  };
  const handleUserJoined: ServerToClientEvents["USER_JOINED"] = (payload) => {
    useDmStore.getState().upsertPartner({
      userId: payload.userId,
      nickname: payload.nickname,
      isOnline: true,
      unreadCount: useDmStore.getState().partners.get(payload.userId)?.unreadCount ?? 0,
    });
  };
  const handleUserLeft: ServerToClientEvents["USER_LEFT"] = (payload) => {
    useDmStore.getState().setOnline(payload.userId, false);
  };
  const handleError: ServerToClientEvents["ERROR"] = (payload) => {
    toast({ title: "Server error", description: payload.message, variant: "destructive" });
    if (isPermissionDeniedMessage(payload.code) || isPermissionDeniedMessage(payload.message)) {
      soundAlert.play("insufficient_perms");
    }
  };
  const handleDisconnect = (reason: string) => {
    if (reason === "io client disconnect") return;
    useConnectionStore.getState().setStatus("reconnecting");
    soundAlert.play("disconnected");
  };
  const handleReconnect = () => {
    // The server treats each socket connection as a fresh session — a bare
    // transport reconnect isn't enough to get channel-tree/presence data
    // flowing again, so re-run the join handshake before declaring recovery.
    void socketService
      .joinServer({
        nickname: joinParams.nickname,
        instanceId: joinParams.instanceId,
        password: joinParams.password || undefined,
      })
      .then((ack) => {
        if (!ack.success) {
          useConnectionStore.getState().setError(ack.error ?? "Could not rejoin the server.");
          socketService.disconnect();
          return;
        }
        useConnectionStore.getState().setStatus("connected");
        soundAlert.play("connected");
        // The server session is back — now safe to replay a voice-channel
        // join, if one was active (Phase 2 PRD P2.10).
        voiceConnectionService.rejoinVoiceIfNeeded();
        void refreshPermissions();
        void socketService.getApprovedEmojis().then((res) => {
          if (res.success && res.emojis) useCustomEmojiStore.getState().setApprovedList(res.emojis);
        });
        void fetchServerSettings();
        void hydrateUnreadDmPartners();
      });
  };
  const handleReconnectFailed = () => {
    useConnectionStore.getState().setError("Lost connection to the server.");
  };
  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      voiceConnectionService.rejoinVoiceIfConnectionLost();
      clearAppBadge();
    }
  };

  socket.on("CHANNEL_TREE_UPDATE", handleTreeUpdate);
  socket.on("PRESENCE_UPDATE", handlePresenceUpdate);
  socket.on("CHANNEL_CREATED", handleChannelCreated);
  socket.on("CHANNEL_DELETED", handleChannelDeleted);
  socket.on("MESSAGE_RECEIVED", handleMessageReceived);
  socket.on("MESSAGE_EDITED", handleMessageEdited);
  socket.on("MESSAGE_DELETED", handleMessageDeleted);
  socket.on("REACTION_UPDATED", handleReactionUpdated);
  socket.on("CHANNEL_PIN_UPDATED", handleChannelPinUpdated);
  socket.on("CUSTOM_EMOJI_APPROVED", handleCustomEmojiApproved);
  socket.on("DIRECT_MESSAGE_RECEIVED", handleDirectMessageReceived);
  socket.on("DIRECT_MESSAGE_DELETED", handleDirectMessageDeleted);
  socket.on("NUDGE_RECEIVED", handleNudgeReceived);
  socket.on("SERVER_SETTINGS_UPDATED", handleServerSettingsUpdated);
  socket.on("USER_JOINED", handleUserJoined);
  socket.on("USER_LEFT", handleUserLeft);
  socket.on("ERROR", handleError);
  socket.on("disconnect", handleDisconnect);
  socket.io.on("reconnect", handleReconnect);
  socket.io.on("reconnect_failed", handleReconnectFailed);
  socket.on("NEW_PRODUCER", voiceConnectionService.handleNewProducer);
  socket.on("PRODUCER_CLOSED", voiceConnectionService.handleProducerClosed);
  socket.on("EXISTING_PRODUCERS", voiceConnectionService.handleExistingProducers);
  socket.on("ACTIVE_SPEAKERS", voiceConnectionService.handleActiveSpeakers);
  socket.on("VOICE_SESSION_LOST", voiceConnectionService.handleVoiceSessionLost);
  document.addEventListener("visibilitychange", handleVisibilityChange);

  return () => {
    stopPing();
    socket.off("CHANNEL_TREE_UPDATE", handleTreeUpdate);
    socket.off("PRESENCE_UPDATE", handlePresenceUpdate);
    socket.off("CHANNEL_CREATED", handleChannelCreated);
    socket.off("CHANNEL_DELETED", handleChannelDeleted);
    socket.off("MESSAGE_RECEIVED", handleMessageReceived);
    socket.off("MESSAGE_EDITED", handleMessageEdited);
    socket.off("MESSAGE_DELETED", handleMessageDeleted);
    socket.off("REACTION_UPDATED", handleReactionUpdated);
    socket.off("CHANNEL_PIN_UPDATED", handleChannelPinUpdated);
    socket.off("CUSTOM_EMOJI_APPROVED", handleCustomEmojiApproved);
    socket.off("DIRECT_MESSAGE_RECEIVED", handleDirectMessageReceived);
    socket.off("DIRECT_MESSAGE_DELETED", handleDirectMessageDeleted);
    socket.off("NUDGE_RECEIVED", handleNudgeReceived);
    socket.off("SERVER_SETTINGS_UPDATED", handleServerSettingsUpdated);
    socket.off("USER_JOINED", handleUserJoined);
    socket.off("USER_LEFT", handleUserLeft);
    socket.off("ERROR", handleError);
    socket.off("disconnect", handleDisconnect);
    socket.io.off("reconnect", handleReconnect);
    socket.io.off("reconnect_failed", handleReconnectFailed);
    socket.off("NEW_PRODUCER", voiceConnectionService.handleNewProducer);
    socket.off("PRODUCER_CLOSED", voiceConnectionService.handleProducerClosed);
    socket.off("EXISTING_PRODUCERS", voiceConnectionService.handleExistingProducers);
    socket.off("ACTIVE_SPEAKERS", voiceConnectionService.handleActiveSpeakers);
    socket.off("VOICE_SESSION_LOST", voiceConnectionService.handleVoiceSessionLost);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
  };
}

export interface ConnectParams {
  serverUrl: string;
  nickname: string;
  password?: string;
  instanceId: string;
}

export interface ConnectResult {
  success: boolean;
  error?: string;
}

/**
 * Connects the socket and joins the server, distinguishing a transport-level
 * failure ("can't reach that server") from an application-level join
 * rejection (bad password, etc.) so the surfaced error is accurate — Phase 1
 * PRD P1.6.
 */
export function connectToServer(params: ConnectParams): Promise<ConnectResult> {
  const { serverUrl, nickname, password, instanceId } = params;
  useConnectionStore.getState().setStatus("connecting");

  const socket = socketService.connect(serverUrl);

  return new Promise((resolve) => {
    const onConnectError = () => {
      socket.off("connect", onConnect);
      const message = "Can't reach that server.";
      useConnectionStore.getState().setError(message);
      socketService.disconnect();
      resolve({ success: false, error: message });
    };

    const onConnect = () => {
      socket.off("connect_error", onConnectError);
      void socketService
        .joinServer({ nickname, instanceId, password: password || undefined })
        .then((ack) => {
          if (!ack.success) {
            const message = ack.error ?? "Incorrect password.";
            useConnectionStore.getState().setError(message);
            socketService.disconnect();
            resolve({ success: false, error: message });
            return;
          }
          cleanupLifecycle = attachLifecycleListeners(socket, params);
          useConnectionStore.getState().setConnected(ack.serverId ?? "", nickname, serverUrl);
          soundAlert.play("connected");
          void refreshPermissions();
          void socketService.getApprovedEmojis().then((res) => {
            if (res.success && res.emojis) useCustomEmojiStore.getState().setApprovedList(res.emojis);
          });
          void fetchServerSettings();
          void hydrateUnreadDmPartners();
          resolve({ success: true });
        });
    };

    socket.once("connect_error", onConnectError);
    socket.once("connect", onConnect);
  });
}

export function leaveServer(): void {
  const { serverId } = useConnectionStore.getState();
  voiceConnectionService.leaveVoiceChannel();
  cleanupLifecycle?.();
  cleanupLifecycle = null;
  if (serverId) socketService.leaveServer(serverId);
  socketService.disconnect();
  useConnectionStore.getState().reset();
  useChannelTreeStore.getState().reset();
  usePermissionsStore.getState().reset();
  useChatStore.getState().reset();
  useCustomEmojiStore.getState().reset();
  useDmStore.getState().reset();
  useServerSettingsStore.getState().reset();
  clearAppBadge();
}
