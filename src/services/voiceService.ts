import { Device } from "mediasoup-client";
import type { types as MsTypes } from "mediasoup-client";

/**
 * Signaling callbacks the mediasoup engine needs — deliberately narrow so
 * this class stays framework/transport-agnostic and independently testable
 * (Phase 2 PRD P2.1), mirroring the desktop client's `voice.service.ts`
 * design closely enough that its Phase 11 reconnection logic ports with
 * only browser-API substitutions. `socketService` already exposes methods
 * matching this shape 1:1, so no adapter object is needed at the call site.
 */
export interface VoiceSignaling {
  getRouterCapabilities(
    channelId: string,
  ): Promise<{ success: boolean; rtpCapabilities?: unknown; error?: string }>;
  createWebRtcTransport(
    channelId: string,
    direction: "send" | "recv",
  ): Promise<{
    success: boolean;
    transport?: {
      id: string;
      iceParameters: unknown;
      iceCandidates: unknown[];
      dtlsParameters: unknown;
    };
    iceServers?: Array<{ urls: string | string[]; username?: string; credential?: string }>;
    error?: string;
  }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mediasoup's own opaque wire shape
  connectTransport(transportId: string, dtlsParameters: any): Promise<{ success: boolean; error?: string }>;
  produce(
    transportId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mediasoup's own opaque wire shape
    rtpParameters: any,
  ): Promise<{ success: boolean; producerId?: string; error?: string }>;
  consume(
    producerId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mediasoup's own opaque wire shape
    rtpCapabilities?: any,
  ): Promise<{
    success: boolean;
    consumer?: { id: string; producerId: string; kind: string; rtpParameters: unknown };
    error?: string;
  }>;
  resumeConsumer(consumerId: string): Promise<{ success: boolean; error?: string }>;
}

const ICE_DISCONNECTED_GRACE_MS = 4000;
const CONSUME_MAX_ATTEMPTS = 3;
const CONSUME_RETRY_DELAY_MS = 1000;

/**
 * Client-side mediasoup voice engine — Device/transport/producer/consumer
 * lifecycle, ported from the desktop client's `voice.service.ts` (Phase 2
 * PRD P2.1). Scope is deliberately limited to what Phase 2 needs: the noise
 * gate, per-user volume/local mute, and global voice volume machinery the
 * desktop file also contains belong to Phase 3 and are intentionally not
 * ported here yet (per-user playback stays plain `<audio>` elements this
 * phase, not routed through AudioContext/GainNode — P2.5).
 */
export class VoiceService {
  private device: MsTypes.Device | null = null;
  private sendTransport: MsTypes.Transport | null = null;
  private recvTransport: MsTypes.Transport | null = null;
  private producer: MsTypes.Producer | null = null;
  private consumers = new Map<string, MsTypes.Consumer>();
  private audioElements = new Map<string, HTMLAudioElement>();
  private signaling: VoiceSignaling;
  private channelId: string | null = null;
  private localStream: MediaStream | null = null;
  private audioInputDeviceId: string | null = null;

  private _isDeafened = false;
  /** True only when deafening had to pause the producer itself — see toggleDeafen(). */
  private _deafenAutoMuted = false;

  /** Producers that arrived before the recv transport was ready. */
  private pendingProducers: { producerId: string; userId: string }[] = [];

  /**
   * Fired at most once per join when a transport's WebRTC connection is
   * confirmed lost (ICE failed, or stuck "disconnected" past the grace
   * period) — independent of the Socket.io signaling channel, which may
   * still be healthy. The caller is expected to tear down and rejoin
   * (Phase 2 PRD P2.10).
   */
  onConnectionLost: (() => void) | null = null;
  /** Fired when a non-fatal voice error should be surfaced to the UI. */
  onError: ((message: string) => void) | null = null;

  private iceGraceTimer: ReturnType<typeof setTimeout> | null = null;
  private connectionLossReported = false;

  constructor(signaling: VoiceSignaling) {
    this.signaling = signaling;
  }

  setAudioInputDeviceId(deviceId: string | null): void {
    this.audioInputDeviceId = deviceId;
  }

  // ── Join ─────────────────────────────────────────────────────────────

  async joinVoiceChannel(channelId: string): Promise<void> {
    this.channelId = channelId;

    const capRes = await this.signaling.getRouterCapabilities(channelId);
    if (!capRes.success || !capRes.rtpCapabilities) {
      throw new Error(capRes.error ?? "Failed to get router capabilities");
    }

    this.device = new Device();
    await this.device.load({
      routerRtpCapabilities: capRes.rtpCapabilities,
    });

    await this.createSendTransport(channelId);
    await this.createRecvTransport(channelId);
    await this.startProducing();

    if (this.pendingProducers.length > 0) {
      const pending = this.pendingProducers;
      this.pendingProducers = [];
      for (const { producerId, userId } of pending) {
        try {
          await this.consumeProducer(producerId, userId);
        } catch (err) {
          console.error("[voice] Failed to consume pending producer:", err);
        }
      }
    }
  }

  private async createSendTransport(channelId: string): Promise<void> {
    if (!this.device) throw new Error("Device not loaded");

    const res = await this.signaling.createWebRtcTransport(channelId, "send");
    if (!res.success || !res.transport) {
      throw new Error(res.error ?? "Failed to create send transport");
    }
    const tp = res.transport;

    this.sendTransport = this.device.createSendTransport({
      id: tp.id,
      iceParameters: tp.iceParameters as MsTypes.IceParameters,
      iceCandidates: tp.iceCandidates as MsTypes.IceCandidate[],
      dtlsParameters: tp.dtlsParameters as MsTypes.DtlsParameters,
      ...(res.iceServers ? { iceServers: res.iceServers } : {}),
    });

    this.sendTransport.on("connectionstatechange", (state) => {
      this.handleTransportConnectionStateChange(state);
    });

    this.sendTransport.on("connect", ({ dtlsParameters }, callback, errback) => {
      this.signaling
        .connectTransport(tp.id, dtlsParameters)
        .then((connectRes) => {
          if (!connectRes.success) throw new Error(connectRes.error);
          callback();
        })
        .catch((err: unknown) => errback(err instanceof Error ? err : new Error(String(err))));
    });

    this.sendTransport.on("produce", ({ kind, rtpParameters }, callback, errback) => {
      this.signaling
        .produce(tp.id, rtpParameters)
        .then((prodRes) => {
          if (!prodRes.success || !prodRes.producerId) throw new Error(prodRes.error);
          callback({ id: prodRes.producerId });
        })
        .catch((err: unknown) => errback(err instanceof Error ? err : new Error(String(err))));
      void kind;
    });
  }

  private async createRecvTransport(channelId: string): Promise<void> {
    if (!this.device) throw new Error("Device not loaded");

    const res = await this.signaling.createWebRtcTransport(channelId, "recv");
    if (!res.success || !res.transport) {
      throw new Error(res.error ?? "Failed to create recv transport");
    }
    const tp = res.transport;

    this.recvTransport = this.device.createRecvTransport({
      id: tp.id,
      iceParameters: tp.iceParameters as MsTypes.IceParameters,
      iceCandidates: tp.iceCandidates as MsTypes.IceCandidate[],
      dtlsParameters: tp.dtlsParameters as MsTypes.DtlsParameters,
      ...(res.iceServers ? { iceServers: res.iceServers } : {}),
    });

    this.recvTransport.on("connectionstatechange", (state) => {
      this.handleTransportConnectionStateChange(state);
    });

    this.recvTransport.on("connect", ({ dtlsParameters }, callback, errback) => {
      this.signaling
        .connectTransport(tp.id, dtlsParameters)
        .then((connectRes) => {
          if (!connectRes.success) throw new Error(connectRes.error);
          callback();
        })
        .catch((err: unknown) => errback(err instanceof Error ? err : new Error(String(err))));
    });
  }

  /**
   * "disconnected" gets a grace period (ICE frequently self-recovers, e.g.
   * a brief NAT rebind) before being treated as a real failure; "failed" is
   * terminal immediately. Only reports once per join (Phase 2 PRD P2.10).
   */
  private handleTransportConnectionStateChange(state: MsTypes.ConnectionState): void {
    if (state === "connected") {
      if (this.iceGraceTimer !== null) {
        clearTimeout(this.iceGraceTimer);
        this.iceGraceTimer = null;
      }
      return;
    }

    if (state === "failed") {
      if (this.iceGraceTimer !== null) {
        clearTimeout(this.iceGraceTimer);
        this.iceGraceTimer = null;
      }
      this.reportConnectionLost();
      return;
    }

    if (state === "disconnected") {
      if (this.iceGraceTimer !== null) return;
      this.iceGraceTimer = setTimeout(() => {
        this.iceGraceTimer = null;
        this.reportConnectionLost();
      }, ICE_DISCONNECTED_GRACE_MS);
    }
  }

  private reportConnectionLost(): void {
    if (this.connectionLossReported) return;
    this.connectionLossReported = true;
    this.onConnectionLost?.();
  }

  /**
   * Requests mic access and starts producing. Must only be called in
   * direct response to a user gesture (Join Voice tap) — never
   * speculatively (Phase 2 PRD P2.3).
   */
  async startProducing(): Promise<void> {
    if (!this.sendTransport) throw new Error("Send transport not ready");

    const audioConstraints: MediaTrackConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    };
    if (this.audioInputDeviceId) {
      audioConstraints.deviceId = { exact: this.audioInputDeviceId };
    }

    this.localStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
    const track = this.localStream.getAudioTracks()[0];
    if (!track) throw new Error("No audio track available from getUserMedia");

    this.producer = await this.sendTransport.produce({ track });
  }

  // ── Consume remote audio ────────────────────────────────────────────

  /** Queue a producer for consumption, retrying with backoff on failure. */
  queueConsumeProducer(producerId: string, userId: string, attempt = 1): void {
    if (this.recvTransport && this.device) {
      this.consumeProducer(producerId, userId).catch((err: unknown) => {
        console.error(`[voice] Failed to consume producer (attempt ${attempt}):`, err);
        if (attempt < CONSUME_MAX_ATTEMPTS) {
          setTimeout(() => {
            this.queueConsumeProducer(producerId, userId, attempt + 1);
          }, CONSUME_RETRY_DELAY_MS);
        } else {
          this.onError?.("Couldn't receive audio from a participant. They may need to rejoin.");
        }
      });
    } else {
      this.pendingProducers.push({ producerId, userId });
    }
  }

  async consumeProducer(producerId: string, _userId: string): Promise<void> {
    if (!this.recvTransport) throw new Error("Recv transport not ready");
    if (!this.device) throw new Error("Device not loaded");

    const res = await this.signaling.consume(producerId, this.device.rtpCapabilities);
    if (!res.success || !res.consumer) {
      throw new Error(res.error ?? "Failed to consume");
    }

    const { id, kind, rtpParameters } = res.consumer;
    const consumer = await this.recvTransport.consume({
      id,
      producerId,
      kind: kind as MsTypes.MediaKind,
      rtpParameters: rtpParameters as MsTypes.RtpParameters,
    });
    this.consumers.set(consumer.id, consumer);

    // Attached to the DOM (not a detached `new Audio()`) — required for
    // reliable playback, more so on mobile Safari (Phase 2 PRD P2.4).
    const audio = document.createElement("audio");
    audio.srcObject = new MediaStream([consumer.track]);
    audio.autoplay = true;
    audio.muted = this._isDeafened;
    document.body.appendChild(audio);
    void audio.play().catch(() => {
      // Autoplay can still be rejected on some browsers even after a join
      // gesture — not independently user-actionable beyond retrying join.
    });
    this.audioElements.set(consumer.id, audio);

    await this.signaling.resumeConsumer(consumer.id);
  }

  removeConsumer(producerId: string): void {
    for (const [consumerId, consumer] of this.consumers) {
      if (consumer.producerId !== producerId) continue;
      consumer.close();
      this.consumers.delete(consumerId);

      const audio = this.audioElements.get(consumerId);
      if (audio) {
        audio.pause();
        audio.srcObject = null;
        audio.remove();
        this.audioElements.delete(consumerId);
      }
      break;
    }
  }

  // ── Mute / Deafen ────────────────────────────────────────────────────

  /** Toggle mic mute (pauses/resumes the producer). No-op while deafened. */
  toggleMute(): boolean {
    if (!this.producer || this._isDeafened) return this.producer?.paused ?? false;
    if (this.producer.paused) {
      this.producer.resume();
    } else {
      this.producer.pause();
    }
    return this.producer.paused;
  }

  /** Explicitly set mute state (used by PTT). No-op while deafened. */
  setMuted(muted: boolean): void {
    if (!this.producer || this._isDeafened) return;
    if (muted && !this.producer.paused) this.producer.pause();
    else if (!muted && this.producer.paused) this.producer.resume();
  }

  /**
   * Combined deafen/undeafen state machine, ported 1:1 from the desktop's
   * shipped behavior (Phase 2 PRD P2.5 / desktop Phase 10 PRD 10.4):
   * deafening auto-mutes and remembers only if it had to (`_deafenAutoMuted`);
   * undeafening restores exactly that prior mute state. Returns the combined
   * result so the caller sends one SET_VOICE_STATE update, not two.
   */
  toggleDeafen(): { isMuted: boolean; isDeafened: boolean } {
    if (!this._isDeafened) {
      const wasPaused = this.producer?.paused ?? false;
      this._deafenAutoMuted = !wasPaused;
      if (this._deafenAutoMuted && this.producer) {
        this.producer.pause();
      }
      for (const audio of this.audioElements.values()) audio.muted = true;
      this._isDeafened = true;
    } else {
      for (const audio of this.audioElements.values()) audio.muted = false;
      this._isDeafened = false;
      if (this._deafenAutoMuted && this.producer) {
        this.producer.resume();
      }
      this._deafenAutoMuted = false;
    }
    return { isMuted: this.producer?.paused ?? false, isDeafened: this._isDeafened };
  }

  // ── Cleanup ──────────────────────────────────────────────────────────

  cleanup(): void {
    if (this.iceGraceTimer !== null) {
      clearTimeout(this.iceGraceTimer);
      this.iceGraceTimer = null;
    }
    this.connectionLossReported = false;

    if (this.localStream) {
      for (const track of this.localStream.getTracks()) track.stop();
      this.localStream = null;
    }
    if (this.producer) {
      this.producer.close();
      this.producer = null;
    }
    for (const consumer of this.consumers.values()) consumer.close();
    this.consumers.clear();
    for (const audio of this.audioElements.values()) {
      audio.pause();
      audio.srcObject = null;
      audio.remove();
    }
    this.audioElements.clear();

    if (this.sendTransport) {
      this.sendTransport.close();
      this.sendTransport = null;
    }
    if (this.recvTransport) {
      this.recvTransport.close();
      this.recvTransport = null;
    }

    this.device = null;
    this.channelId = null;
    this._isDeafened = false;
    this._deafenAutoMuted = false;
    this.pendingProducers = [];
  }

  get isInVoice(): boolean {
    return this.channelId !== null;
  }

  get currentChannelId(): string | null {
    return this.channelId;
  }

  get isMuted(): boolean {
    return this.producer?.paused ?? false;
  }

  get isDeafened(): boolean {
    return this._isDeafened;
  }
}
