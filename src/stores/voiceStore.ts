import { create } from "zustand";
import type { UserAudioOverride } from "@/services/voiceService";

export type VoiceStatus = "idle" | "joining" | "connected" | "reconnecting" | "leaving";

const PTT_MODE_KEY = "reson8-ptt-mode";
const AUDIO_INPUT_KEY = "reson8-audio-input";
const AUDIO_OUTPUT_KEY = "reson8-audio-output";
const NOISE_GATE_ENABLED_KEY = "reson8-noise-gate-enabled";
const NOISE_GATE_THRESHOLD_KEY = "reson8-noise-gate-threshold-db";

function localVolumeKey(userId: string): string {
  return `reson8-local-volume-${userId}`;
}
function localMuteKey(userId: string): string {
  return `reson8-local-mute-${userId}`;
}

/** Reads a user's persisted local volume/mute override, if any (Phase 3 PRD P3.2). */
export function readUserOverride(userId: string): UserAudioOverride {
  const volumeRaw = localStorage.getItem(localVolumeKey(userId));
  const muteRaw = localStorage.getItem(localMuteKey(userId));
  const volumePercent = volumeRaw !== null ? Number(volumeRaw) : 100;
  return {
    volumePercent: Number.isFinite(volumePercent) ? volumePercent : 100,
    locallyMuted: muteRaw === "true",
  };
}

interface VoiceState {
  status: VoiceStatus;
  currentChannelId: string | null;
  sessionStartedAt: string | null;
  isMuted: boolean;
  isDeafened: boolean;
  pttMode: boolean;
  activeSpeakerUserIds: Set<string>;
  /**
   * In-memory only (no localStorage) — a page reload is a legitimate fresh
   * start on the web. Tracks the channel to auto-rejoin after a Socket.io
   * reconnect or WebRTC failure (Phase 2 PRD P2.10); cleared only on an
   * explicit leave, not on a transient disconnect.
   */
  lastVoiceChannelId: string | null;

  selectedInputDeviceId: string | null;
  selectedOutputDeviceId: string | null;
  stagedInputDeviceId: string | null;
  stagedOutputDeviceId: string | null;

  noiseGateEnabled: boolean;
  noiseGateThresholdDb: number;
  /** Live mic level in dB, ~20x/sec while producing — null when not in voice. */
  micLevelDb: number | null;
  /** Per-user local volume/mute overrides, keyed by userId — reactive mirror of
   *  localStorage (Phase 3 PRD P3.2 "hydrated from localStorage on connect"). */
  userOverrides: Map<string, UserAudioOverride>;

  setStatus: (status: VoiceStatus) => void;
  setChannel: (channelId: string | null, sessionStartedAt: string | null) => void;
  setMuted: (muted: boolean) => void;
  setDeafened: (deafened: boolean) => void;
  setPttMode: (ptt: boolean) => void;
  setActiveSpeakers: (userIds: string[]) => void;
  setLastVoiceChannelId: (channelId: string | null) => void;
  setStagedInputDeviceId: (deviceId: string | null) => void;
  setStagedOutputDeviceId: (deviceId: string | null) => void;
  applyStagedDevices: () => void;
  setNoiseGateEnabled: (enabled: boolean) => void;
  setNoiseGateThresholdDb: (db: number) => void;
  setMicLevelDb: (db: number | null) => void;
  setUserOverride: (userId: string, override: UserAudioOverride) => void;
  /** Full reset for an explicit leave — clears lastVoiceChannelId too, so no auto-rejoin fires. */
  reset: () => void;
}

const sessionFields = {
  status: "idle" as VoiceStatus,
  currentChannelId: null,
  sessionStartedAt: null,
  isMuted: false,
  isDeafened: false,
  activeSpeakerUserIds: new Set<string>(),
  lastVoiceChannelId: null,
  micLevelDb: null,
};

export const useVoiceStore = create<VoiceState>((set, get) => ({
  ...sessionFields,
  pttMode: localStorage.getItem(PTT_MODE_KEY) === "true",
  selectedInputDeviceId: localStorage.getItem(AUDIO_INPUT_KEY) || null,
  selectedOutputDeviceId: localStorage.getItem(AUDIO_OUTPUT_KEY) || null,
  stagedInputDeviceId: null,
  stagedOutputDeviceId: null,
  noiseGateEnabled: localStorage.getItem(NOISE_GATE_ENABLED_KEY) === "true",
  noiseGateThresholdDb: (() => {
    const raw = localStorage.getItem(NOISE_GATE_THRESHOLD_KEY);
    const parsed = raw !== null ? Number(raw) : NaN;
    return Number.isFinite(parsed) ? parsed : -50;
  })(),
  userOverrides: new Map<string, UserAudioOverride>(),

  setStatus: (status) => set({ status }),
  setChannel: (currentChannelId, sessionStartedAt) => set({ currentChannelId, sessionStartedAt }),
  setMuted: (isMuted) => set({ isMuted }),
  setDeafened: (isDeafened) => set({ isDeafened }),
  setPttMode: (pttMode) => {
    localStorage.setItem(PTT_MODE_KEY, String(pttMode));
    set({ pttMode });
  },
  setActiveSpeakers: (userIds) => set({ activeSpeakerUserIds: new Set(userIds) }),
  setLastVoiceChannelId: (lastVoiceChannelId) => set({ lastVoiceChannelId }),
  setStagedInputDeviceId: (stagedInputDeviceId) => set({ stagedInputDeviceId }),
  setStagedOutputDeviceId: (stagedOutputDeviceId) => set({ stagedOutputDeviceId }),
  applyStagedDevices: () => {
    const { stagedInputDeviceId, stagedOutputDeviceId } = get();
    if (stagedInputDeviceId !== null) localStorage.setItem(AUDIO_INPUT_KEY, stagedInputDeviceId);
    if (stagedOutputDeviceId !== null) localStorage.setItem(AUDIO_OUTPUT_KEY, stagedOutputDeviceId);
    set({
      selectedInputDeviceId: stagedInputDeviceId ?? get().selectedInputDeviceId,
      selectedOutputDeviceId: stagedOutputDeviceId ?? get().selectedOutputDeviceId,
      stagedInputDeviceId: null,
      stagedOutputDeviceId: null,
    });
  },
  setNoiseGateEnabled: (noiseGateEnabled) => {
    localStorage.setItem(NOISE_GATE_ENABLED_KEY, String(noiseGateEnabled));
    set({ noiseGateEnabled });
  },
  setNoiseGateThresholdDb: (noiseGateThresholdDb) => {
    localStorage.setItem(NOISE_GATE_THRESHOLD_KEY, String(noiseGateThresholdDb));
    set({ noiseGateThresholdDb });
  },
  setMicLevelDb: (micLevelDb) => set({ micLevelDb }),
  setUserOverride: (userId, override) => {
    localStorage.setItem(localVolumeKey(userId), String(override.volumePercent));
    localStorage.setItem(localMuteKey(userId), String(override.locallyMuted));
    const next = new Map(get().userOverrides);
    next.set(userId, override);
    set({ userOverrides: next });
  },
  reset: () =>
    set({
      ...sessionFields,
      activeSpeakerUserIds: new Set<string>(),
    }),
}));
