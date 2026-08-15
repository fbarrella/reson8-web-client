import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@/types/reson8-protocol";

export type ResonSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

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
}

export const socketService = new SocketService();
