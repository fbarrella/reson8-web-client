import { socketService } from "@/services/socketService";
import { VoiceService } from "@/services/voiceService";
import { useVoiceStore, readUserOverride } from "@/stores/voiceStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { toast } from "@/stores/toastStore";
import { soundAlert } from "@/lib/soundAlert";
import { noiseGatePreviewService } from "@/services/noiseGatePreviewService";
import type { ServerToClientEvents } from "@/types/reson8-protocol";

const REJOIN_MAX_ATTEMPTS = 3;
const REJOIN_RETRY_DELAY_MS = 1500;

let voiceService: VoiceService | null = null;
let voiceRejoinInFlight = false;
/** Occupant ids last seen in the channel we're currently in — diffed on
 *  every PRESENCE_UPDATE to fire exactly one join/leave sound per event,
 *  never per-user (Phase 2 PRD P2.12). */
let previousOccupantIds = new Set<string>();

function wireVoiceServiceCallbacks(vs: VoiceService): void {
  vs.onConnectionLost = () => {
    const channelId = useVoiceStore.getState().lastVoiceChannelId;
    if (channelId) void attemptVoiceRejoin(channelId);
  };
  vs.onError = (message) => {
    toast({ title: "Voice error", description: message, variant: "destructive" });
  };
}

function createVoiceService(): VoiceService {
  const vs = new VoiceService(socketService);
  wireVoiceServiceCallbacks(vs);
  vs.setAudioInputDeviceId(useVoiceStore.getState().selectedInputDeviceId);
  vs.setNoiseGateEnabled(useVoiceStore.getState().noiseGateEnabled);
  vs.setNoiseGateThresholdDb(useVoiceStore.getState().noiseGateThresholdDb);
  vs.setGlobalVoiceVolume(useSettingsStore.getState().globalVoiceVolume);
  vs.onMicLevel = (db) => useVoiceStore.getState().setMicLevelDb(db);
  vs.setOverrideProvider((userId) => {
    const cached = useVoiceStore.getState().userOverrides.get(userId);
    if (cached) return cached;
    const fromStorage = readUserOverride(userId);
    useVoiceStore.getState().setUserOverride(userId, fromStorage);
    return fromStorage;
  });
  return vs;
}

/** Settings tab / occupant sheet entry points (Phase 3 PRD P3.1/P3.2/P3.3). */
export function setNoiseGateEnabled(enabled: boolean): void {
  useVoiceStore.getState().setNoiseGateEnabled(enabled);
  voiceService?.setNoiseGateEnabled(enabled);
}

export function setNoiseGateThresholdDb(db: number): void {
  useVoiceStore.getState().setNoiseGateThresholdDb(db);
  voiceService?.setNoiseGateThresholdDb(db);
}

export function setGlobalVoiceVolume(percent: number): void {
  useSettingsStore.getState().setGlobalVoiceVolume(percent);
  voiceService?.setGlobalVoiceVolume(percent);
}

export function setUserVolume(userId: string, volumePercent: number): void {
  const current = useVoiceStore.getState().userOverrides.get(userId) ?? readUserOverride(userId);
  useVoiceStore.getState().setUserOverride(userId, { ...current, volumePercent });
  voiceService?.setUserVolume(userId, volumePercent);
}

export function setUserLocalMute(userId: string, locallyMuted: boolean): void {
  const current = useVoiceStore.getState().userOverrides.get(userId) ?? readUserOverride(userId);
  useVoiceStore.getState().setUserOverride(userId, { ...current, locallyMuted });
  voiceService?.setUserLocalMute(userId, locallyMuted);
}

/**
 * Sets the initial mic state right after producing starts. In PTT mode the
 * resting state is muted (transmit-blocked) but the store's `isMuted` flag
 * — which in PTT mode means "locked", not "currently transmitting" — stays
 * false so the PTT key/button is live. Ported from the desktop's join flow
 * (Phase 2 PRD P2.6).
 */
function applyInitialMuteState(vs: VoiceService): void {
  if (useVoiceStore.getState().pttMode) {
    vs.setMuted(true);
    useVoiceStore.getState().setMuted(false);
  } else {
    useVoiceStore.getState().setMuted(vs.isMuted);
  }
  useVoiceStore.getState().setDeafened(vs.isDeafened);
}

export interface JoinVoiceResult {
  success: boolean;
  error?: string;
  /** True when the failure was specifically a denied/blocked mic permission
   *  prompt — the caller shows browser-specific recovery guidance for this
   *  case rather than a generic error toast (Phase 2 PRD P2.3). */
  permissionDenied?: boolean;
}

/** Join a voice channel — Socket.io channel join, then the full mediasoup handshake. */
export async function joinVoiceChannel(channelId: string): Promise<JoinVoiceResult> {
  if (!socketService.isConnected()) {
    return { success: false, error: "Not connected." };
  }

  noiseGatePreviewService.stop();
  useVoiceStore.getState().setStatus("joining");
  voiceService?.cleanup();
  voiceService = createVoiceService();
  previousOccupantIds = new Set();

  try {
    const joinRes = await socketService.joinChannel(channelId);
    if (!joinRes.success) {
      useVoiceStore.getState().setStatus("idle");
      return { success: false, error: joinRes.error ?? "Failed to join channel" };
    }

    await voiceService.joinVoiceChannel(channelId);

    useVoiceStore.getState().setLastVoiceChannelId(channelId);
    useVoiceStore.getState().setChannel(channelId, null);
    useVoiceStore.getState().setStatus("connected");
    applyInitialMuteState(voiceService);
    soundAlert.play("joining-channel");
    const { isMuted, isDeafened } = useVoiceStore.getState();
    void socketService.setVoiceState(isMuted, isDeafened);
    return { success: true };
  } catch (err) {
    voiceService.cleanup();
    voiceService = null;
    useVoiceStore.getState().setStatus("idle");
    const permissionDenied =
      err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "PermissionDeniedError");
    const message = err instanceof Error ? err.message : "Failed to join voice.";
    return { success: false, error: message, permissionDenied };
  }
}

/** Explicit leave — clears lastVoiceChannelId so no reconnect auto-rejoins. */
export function leaveVoiceChannel(): void {
  const { currentChannelId } = useVoiceStore.getState();
  useVoiceStore.getState().setStatus("leaving");

  if (socketService.isConnected() && currentChannelId) {
    socketService.leaveChannel(currentChannelId);
  }
  voiceService?.cleanup();
  voiceService = null;
  previousOccupantIds = new Set();
  useVoiceStore.getState().reset();
  soundAlert.play("leaving-channel");
}

/**
 * Mute button/shortcut. While deafened, auto-undeafens first (restoring the
 * prior mute state) then applies a toggle on top of that — matches the
 * desktop's actual shipped behavior (see voiceService.toggleDeafen's doc
 * comment for the PRD/code discrepancy this ports). In PTT mode, "mute"
 * means toggling the lock flag: locking force-stops transmission;
 * unlocking leaves the mic in its resting (transmit-blocked) state until
 * the next PTT press — it does not itself resume transmission.
 */
export function toggleMute(): void {
  if (!voiceService) return;

  if (voiceService.isDeafened) {
    const resolved = voiceService.toggleDeafen();
    useVoiceStore.getState().setMuted(resolved.isMuted);
    useVoiceStore.getState().setDeafened(resolved.isDeafened);
    soundAlert.play(resolved.isDeafened ? "sound_muted" : "sound_resumed");
    void socketService.setVoiceState(resolved.isMuted, resolved.isDeafened);
    return;
  }

  const { pttMode, isMuted: wasLockedOrMuted } = useVoiceStore.getState();

  let isMuted: boolean;
  if (pttMode) {
    isMuted = !wasLockedOrMuted;
    if (isMuted) voiceService.setMuted(true);
  } else {
    isMuted = voiceService.toggleMute();
  }

  useVoiceStore.getState().setMuted(isMuted);
  soundAlert.play(isMuted ? "mic_muted" : "mic_activated");
  void socketService.setVoiceState(isMuted, false);
}

export function toggleDeafen(): void {
  if (!voiceService) return;
  const { isMuted, isDeafened } = voiceService.toggleDeafen();
  useVoiceStore.getState().setMuted(isMuted);
  useVoiceStore.getState().setDeafened(isDeafened);
  soundAlert.play(isDeafened ? "sound_muted" : "sound_resumed");
  void socketService.setVoiceState(isMuted, isDeafened);
}

/** PTT key/button pressed — transmits while held. No-op if locked/deafened/not in PTT mode. */
export function pttPress(): void {
  if (!voiceService) return;
  const { pttMode, isMuted, isDeafened, status } = useVoiceStore.getState();
  if (!pttMode || status !== "connected" || isMuted || isDeafened) return;
  voiceService.setMuted(false);
}

/** PTT key/button released. */
export function pttRelease(): void {
  if (!voiceService) return;
  const { pttMode, isMuted, isDeafened, status } = useVoiceStore.getState();
  if (!pttMode || status !== "connected" || isMuted || isDeafened) return;
  voiceService.setMuted(true);
}

/**
 * Rejoins a voice channel after it was lost — either the Socket.io
 * connection dropped and reconnected, or a WebRTC transport reported an
 * unrecovered failure while signaling stayed up. Retries the full join
 * handshake a few times, since the first attempt can race a server still
 * finishing cleanup of the old session (Phase 2 PRD P2.10).
 */
export async function attemptVoiceRejoin(channelId: string): Promise<void> {
  if (voiceRejoinInFlight) return;
  if (!socketService.isConnected()) return; // the socket "reconnect" handler will retry once reconnected
  voiceRejoinInFlight = true;
  useVoiceStore.getState().setStatus("reconnecting");

  let lastError: string | undefined;

  for (let attempt = 1; attempt <= REJOIN_MAX_ATTEMPTS; attempt++) {
    try {
      voiceService?.cleanup();
      voiceService = createVoiceService();
      previousOccupantIds = new Set();

      const joinRes = await socketService.joinChannel(channelId);
      if (!joinRes.success) throw new Error(joinRes.error ?? "Failed to rejoin channel");

      await voiceService.joinVoiceChannel(channelId);

      useVoiceStore.getState().setLastVoiceChannelId(channelId);
      useVoiceStore.getState().setChannel(channelId, null);
      useVoiceStore.getState().setStatus("connected");
      applyInitialMuteState(voiceService);
      const { isMuted, isDeafened } = useVoiceStore.getState();
      void socketService.setVoiceState(isMuted, isDeafened);
      soundAlert.play("connected");
      voiceRejoinInFlight = false;
      return;
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Unknown error";
      if (attempt < REJOIN_MAX_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, REJOIN_RETRY_DELAY_MS));
      }
    }
  }

  voiceRejoinInFlight = false;
  voiceService?.cleanup();
  voiceService = null;
  useVoiceStore.getState().reset();
  toast({
    title: "Couldn't reconnect to voice",
    description: lastError ?? "Please rejoin manually.",
    variant: "destructive",
  });
}

/** Called from connectionService's socket "reconnect" handler, after the server rejoin succeeds. */
export function rejoinVoiceIfNeeded(): void {
  const channelId = useVoiceStore.getState().lastVoiceChannelId;
  if (channelId) void attemptVoiceRejoin(channelId);
}

/** Called on the Page Visibility API's `visibilitychange` -> visible transition
 *  (Phase 2 PRD P2.10 mobile-specific addition) — a backgrounded tab may have
 *  silently lost its voice connection without firing a clean disconnect. */
export function rejoinVoiceIfConnectionLost(): void {
  const { lastVoiceChannelId, currentChannelId, status } = useVoiceStore.getState();
  if (!lastVoiceChannelId) return;
  if (currentChannelId === lastVoiceChannelId && status === "connected") return;
  void attemptVoiceRejoin(lastVoiceChannelId);
}

// ── Socket event handlers (wired from connectionService's lifecycle) ────

export const handleNewProducer: ServerToClientEvents["NEW_PRODUCER"] = (payload) => {
  voiceService?.queueConsumeProducer(payload.producerId, payload.userId);
};

export const handleProducerClosed: ServerToClientEvents["PRODUCER_CLOSED"] = (payload) => {
  voiceService?.removeConsumer(payload.producerId);
};

export const handleExistingProducers: ServerToClientEvents["EXISTING_PRODUCERS"] = (payload) => {
  for (const p of payload.producers) {
    voiceService?.queueConsumeProducer(p.producerId, p.userId);
  }
};

export const handleActiveSpeakers: ServerToClientEvents["ACTIVE_SPEAKERS"] = (payload) => {
  const { currentChannelId } = useVoiceStore.getState();
  if (payload.channelId !== currentChannelId) return;
  useVoiceStore.getState().setActiveSpeakers(payload.speakers);
};

export const handleVoiceSessionLost: ServerToClientEvents["VOICE_SESSION_LOST"] = (payload) => {
  const { lastVoiceChannelId } = useVoiceStore.getState();
  if (payload.channelId !== lastVoiceChannelId) return;
  void attemptVoiceRejoin(payload.channelId);
};

/**
 * Sources the voice session timer's start time and fires join/leave sound
 * cues, both scoped to the channel the local user is currently in (Phase 2
 * PRD P2.9 / P2.12). Called from connectionService's existing
 * PRESENCE_UPDATE listener rather than a second independent subscription.
 */
export const handlePresenceUpdateForVoice: ServerToClientEvents["PRESENCE_UPDATE"] = (payload) => {
  const { currentChannelId, sessionStartedAt } = useVoiceStore.getState();
  if (payload.channelId !== currentChannelId) return;

  if (payload.sessionStartedAt && payload.sessionStartedAt !== sessionStartedAt) {
    useVoiceStore.getState().setChannel(currentChannelId, payload.sessionStartedAt);
  }

  const nextOccupantIds = new Set(payload.occupants.map((o) => o.userId));
  const hadJoins = [...nextOccupantIds].some((id) => !previousOccupantIds.has(id));
  const hadLeaves = [...previousOccupantIds].some((id) => !nextOccupantIds.has(id));
  if (previousOccupantIds.size > 0 || nextOccupantIds.size > 0) {
    if (hadJoins) soundAlert.play("user_joined_channel");
    if (hadLeaves) soundAlert.play("user_disconnected_from_channel");
  }
  previousOccupantIds = nextOccupantIds;
};
