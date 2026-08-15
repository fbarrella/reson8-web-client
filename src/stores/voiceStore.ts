import { create } from "zustand";

export type VoiceStatus = "idle" | "joining" | "connected" | "reconnecting" | "leaving";

const PTT_MODE_KEY = "reson8-ptt-mode";
const AUDIO_INPUT_KEY = "reson8-audio-input";
const AUDIO_OUTPUT_KEY = "reson8-audio-output";

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
};

export const useVoiceStore = create<VoiceState>((set, get) => ({
  ...sessionFields,
  pttMode: localStorage.getItem(PTT_MODE_KEY) === "true",
  selectedInputDeviceId: localStorage.getItem(AUDIO_INPUT_KEY) || null,
  selectedOutputDeviceId: localStorage.getItem(AUDIO_OUTPUT_KEY) || null,
  stagedInputDeviceId: null,
  stagedOutputDeviceId: null,

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
  reset: () =>
    set({
      ...sessionFields,
      activeSpeakerUserIds: new Set<string>(),
    }),
}));
