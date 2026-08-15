import { socketService, type ResonSocket } from "@/services/socketService";
import { useConnectionStore } from "@/stores/connectionStore";
import { useChannelTreeStore } from "@/stores/channelTreeStore";
import { toast } from "@/stores/toastStore";
import { soundAlert } from "@/lib/soundAlert";
import * as voiceConnectionService from "@/services/voiceConnectionService";
import type { ServerToClientEvents } from "@/types/reson8-protocol";

const PING_INTERVAL_MS = 3000;

let cleanupLifecycle: (() => void) | null = null;

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

  const handleTreeUpdate: ServerToClientEvents["CHANNEL_TREE_UPDATE"] = (payload) => {
    useChannelTreeStore.getState().setTree(payload.tree);
  };
  const handlePresenceUpdate: ServerToClientEvents["PRESENCE_UPDATE"] = (payload) => {
    useChannelTreeStore.getState().updatePresence(payload.channelId, payload.occupants);
    voiceConnectionService.handlePresenceUpdateForVoice(payload);
  };
  const handleError: ServerToClientEvents["ERROR"] = (payload) => {
    toast({ title: "Server error", description: payload.message, variant: "destructive" });
    if (/permission/i.test(payload.code) || /permission/i.test(payload.message)) {
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
      });
  };
  const handleReconnectFailed = () => {
    useConnectionStore.getState().setError("Lost connection to the server.");
  };
  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      voiceConnectionService.rejoinVoiceIfConnectionLost();
    }
  };

  socket.on("CHANNEL_TREE_UPDATE", handleTreeUpdate);
  socket.on("PRESENCE_UPDATE", handlePresenceUpdate);
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
          useConnectionStore.getState().setConnected(ack.serverId ?? "", nickname);
          soundAlert.play("connected");
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
}
