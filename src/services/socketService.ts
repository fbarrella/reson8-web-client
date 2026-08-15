import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@/types/reson8-protocol";

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
}

export const socketService = new SocketService();
