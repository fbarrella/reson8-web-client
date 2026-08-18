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
const NOISE_GATE_POLL_MS = 50;
const NOISE_GATE_FLOOR_DB = -100;

export interface UserAudioOverride {
  volumePercent: number;
  locallyMuted: boolean;
}

const DEFAULT_OVERRIDE: UserAudioOverride = { volumePercent: 100, locallyMuted: false };

/**
 * Client-side mediasoup voice engine — Device/transport/producer/consumer
 * lifecycle, ported from the desktop client's `voice.service.ts` (Phase 2
 * PRD P2.1). Phase 3 (P3.1/P3.2/P3.3) adds the noise gate and a shared
 * AudioContext-based `MediaElementAudioSourceNode -> GainNode -> destination`
 * chain per consumer, replacing the plain-`<audio>`-only playback path Phase
 * 2 intentionally left in place.
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
  /** True when the producer is paused because of an explicit Mute action (or PTT
   *  lock) — the noise gate must never fight this (Phase 3 PRD P3.1). */
  private _isManuallyMuted = false;

  /** Producers that arrived before the recv transport was ready. */
  private pendingProducers: { producerId: string; userId: string }[] = [];

  // ── Phase 3: shared AudioContext for per-user gain + noise-gate analysis ──
  private audioContext: AudioContext | null = null;
  private gainNodes = new Map<string, GainNode>();
  private mediaSources = new Map<string, MediaElementAudioSourceNode>();
  private consumerUserIds = new Map<string, string>();
  private userOverrides = new Map<string, UserAudioOverride>();
  private globalVoiceVolumePercent = 100;
  /** Supplies a persisted (localStorage-backed) override for a user the first
   *  time their producer is consumed this session — keeps VoiceService free of
   *  any store/localStorage import (Phase 2 PRD P2.1's testability goal). */
  private getInitialOverride: ((userId: string) => UserAudioOverride) | null = null;

  // ── Phase 3 P3.1: noise gate ─────────────────────────────────────────────
  private noiseGateEnabled = false;
  private noiseGateThresholdDb = -50;
  private noiseGateAnalyser: AnalyserNode | null = null;
  private noiseGateSource: MediaStreamAudioSourceNode | null = null;
  private noiseGateClonedTrack: MediaStreamTrack | null = null;
  private noiseGateInterval: ReturnType<typeof setInterval> | null = null;
  private originalTrack: MediaStreamTrack | null = null;
  /** Fired ~20x/sec with the current mic level in dB while producing — drives
   *  the live meter in both the active-session and Settings-preview contexts. */
  onMicLevel: ((db: number) => void) | null = null;

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

  setOverrideProvider(fn: (userId: string) => UserAudioOverride): void {
    this.getInitialOverride = fn;
  }

  // ── Phase 3 P3.3: global voice volume ───────────────────────────────────

  setGlobalVoiceVolume(percent: number): void {
    this.globalVoiceVolumePercent = percent;
    for (const consumerId of this.gainNodes.keys()) this.applyGain(consumerId);
  }

  // ── Phase 3 P3.2: per-user local volume / mute ──────────────────────────

  setUserVolume(userId: string, volumePercent: number): void {
    const current = this.userOverrides.get(userId) ?? DEFAULT_OVERRIDE;
    this.userOverrides.set(userId, { ...current, volumePercent });
    this.applyGainForUser(userId);
  }

  setUserLocalMute(userId: string, locallyMuted: boolean): void {
    const current = this.userOverrides.get(userId) ?? DEFAULT_OVERRIDE;
    this.userOverrides.set(userId, { ...current, locallyMuted });
    this.applyGainForUser(userId);
  }

  private applyGainForUser(userId: string): void {
    for (const [consumerId, uid] of this.consumerUserIds) {
      if (uid === userId) this.applyGain(consumerId);
    }
  }

  private applyGain(consumerId: string): void {
    const gainNode = this.gainNodes.get(consumerId);
    if (!gainNode) return;
    const userId = this.consumerUserIds.get(consumerId);
    const override = (userId ? this.userOverrides.get(userId) : undefined) ?? DEFAULT_OVERRIDE;
    gainNode.gain.value = override.locallyMuted
      ? 0
      : (override.volumePercent / 100) * (this.globalVoiceVolumePercent / 100);
  }

  // ── Phase 3 P3.1: noise gate ─────────────────────────────────────────────

  setNoiseGateEnabled(enabled: boolean): void {
    this.noiseGateEnabled = enabled;
    // Gate off -> track must stay fully open (baseline, no gating applied).
    if (!enabled && this.originalTrack && !this._isManuallyMuted) {
      this.originalTrack.enabled = true;
    }
  }

  setNoiseGateThresholdDb(db: number): void {
    this.noiseGateThresholdDb = db;
  }

  /**
   * Clones the raw mic track into its own AnalyserNode chain so that gating
   * the original track (`track.enabled = false`) never blinds the analysis
   * — a disabled track reads back as silence, which would leave the gate
   * permanently closed once it fired (Phase 3 PRD P3.1).
   */
  private setupNoiseGateAnalysis(track: MediaStreamTrack): void {
    if (!this.audioContext) this.audioContext = new AudioContext();
    this.noiseGateClonedTrack = track.clone();
    this.noiseGateSource = this.audioContext.createMediaStreamSource(
      new MediaStream([this.noiseGateClonedTrack]),
    );
    this.noiseGateAnalyser = this.audioContext.createAnalyser();
    this.noiseGateAnalyser.fftSize = 2048;
    this.noiseGateSource.connect(this.noiseGateAnalyser);
    this.startNoiseGateLoop();
  }

  private startNoiseGateLoop(): void {
    if (this.noiseGateInterval !== null || !this.noiseGateAnalyser) return;
    const analyser = this.noiseGateAnalyser;
    const data = new Uint8Array(analyser.fftSize);

    this.noiseGateInterval = setInterval(() => {
      analyser.getByteTimeDomainData(data);
      let sumSquares = 0;
      for (const sample of data) {
        const normalized = (sample - 128) / 128;
        sumSquares += normalized * normalized;
      }
      const rms = Math.sqrt(sumSquares / data.length);
      const db = rms > 0 ? 20 * Math.log10(rms) : NOISE_GATE_FLOOR_DB;
      this.onMicLevel?.(Number.isFinite(db) ? Math.max(db, NOISE_GATE_FLOOR_DB) : NOISE_GATE_FLOOR_DB);

      if (!this.noiseGateEnabled || this._isManuallyMuted || this._isDeafened || !this.originalTrack) return;
      this.originalTrack.enabled = db > this.noiseGateThresholdDb;
    }, NOISE_GATE_POLL_MS);
  }

  private stopNoiseGateLoop(): void {
    if (this.noiseGateInterval !== null) {
      clearInterval(this.noiseGateInterval);
      this.noiseGateInterval = null;
    }
  }

  // ── Join ─────────────────────────────────────────────────────────────

  async joinVoiceChannel(channelId: string): Promise<void> {
    this.channelId = channelId;

    const capRes = await this.signaling.getRouterCapabilities(channelId);
    if (!capRes.success || !capRes.rtpCapabilities) {
      throw new Error(capRes.error ?? "Failed to get router capabilities");
    }

    // Dynamic import (P7.6): mediasoup-client is one of the largest single
    // dependencies in this app and is only ever needed once a user actually
    // joins voice — connectionService imports this whole service eagerly at
    // connect time (to wire up NEW_PRODUCER/etc. socket listeners), so a
    // static top-level import here would put mediasoup-client in the
    // connect-screen's initial bundle for every visitor, voice or not.
    const { Device } = await import("mediasoup-client");
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

    this.originalTrack = track;
    this.setupNoiseGateAnalysis(track);

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

  async consumeProducer(producerId: string, userId: string): Promise<void> {
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
    this.consumerUserIds.set(consumer.id, userId);

    // Route through a per-consumer GainNode (Phase 3 PRD P3.2/P3.3) — the
    // element's own volume/muted still apply pre-graph (used for deafen
    // above), the GainNode carries per-user volume/local-mute * global volume.
    if (!this.audioContext) this.audioContext = new AudioContext();
    const source = this.audioContext.createMediaElementSource(audio);
    const gainNode = this.audioContext.createGain();
    source.connect(gainNode).connect(this.audioContext.destination);
    this.mediaSources.set(consumer.id, source);
    this.gainNodes.set(consumer.id, gainNode);

    if (!this.userOverrides.has(userId)) {
      this.userOverrides.set(userId, this.getInitialOverride?.(userId) ?? DEFAULT_OVERRIDE);
    }
    this.applyGain(consumer.id);

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
      this.gainNodes.delete(consumerId);
      this.mediaSources.delete(consumerId);
      this.consumerUserIds.delete(consumerId);
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
    this._isManuallyMuted = this.producer.paused;
    // Re-open immediately on unmute rather than waiting for the next gate
    // tick; the gate will re-close it within one tick if below threshold.
    if (!this._isManuallyMuted && this.originalTrack) this.originalTrack.enabled = true;
    return this.producer.paused;
  }

  /** Explicitly set mute state (used by PTT). No-op while deafened. */
  setMuted(muted: boolean): void {
    if (!this.producer || this._isDeafened) return;
    if (muted && !this.producer.paused) this.producer.pause();
    else if (!muted && this.producer.paused) this.producer.resume();
    this._isManuallyMuted = muted;
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

    this.stopNoiseGateLoop();
    if (this.noiseGateClonedTrack) {
      this.noiseGateClonedTrack.stop();
      this.noiseGateClonedTrack = null;
    }
    this.noiseGateSource = null;
    this.noiseGateAnalyser = null;
    this.originalTrack = null;
    this._isManuallyMuted = false;

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
    this.gainNodes.clear();
    this.mediaSources.clear();
    this.consumerUserIds.clear();

    if (this.audioContext) {
      void this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }

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
