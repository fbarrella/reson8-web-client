import { create } from "zustand";

const MUTE_ALERTS_KEY = "reson8-mute-alerts";
const ALERT_VOLUME_KEY = "reson8-alert-volume";
const NUDGE_VOLUME_KEY = "reson8-nudge-volume";
const VOICE_VOLUME_KEY = "reson8-voice-volume";

function readBoolean(key: string, fallback: boolean): boolean {
  const raw = localStorage.getItem(key);
  return raw === null ? fallback : raw === "true";
}

function readVolume(key: string, fallback: number): number {
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

interface SettingsState {
  muteAlerts: boolean;
  alertVolume: number;
  nudgeVolume: number;
  /** 0-100 master attenuator multiplied into every per-user voice gain (Phase 3 PRD P3.3). */
  globalVoiceVolume: number;

  setMuteAlerts: (muted: boolean) => void;
  setAlertVolume: (volume: number) => void;
  setNudgeVolume: (volume: number) => void;
  setGlobalVoiceVolume: (volume: number) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  muteAlerts: readBoolean(MUTE_ALERTS_KEY, false),
  alertVolume: readVolume(ALERT_VOLUME_KEY, 0.8),
  nudgeVolume: readVolume(NUDGE_VOLUME_KEY, 0.8),
  globalVoiceVolume: readVolume(VOICE_VOLUME_KEY, 100),

  setMuteAlerts: (muted) => {
    localStorage.setItem(MUTE_ALERTS_KEY, String(muted));
    set({ muteAlerts: muted });
  },
  setAlertVolume: (volume) => {
    localStorage.setItem(ALERT_VOLUME_KEY, String(volume));
    set({ alertVolume: volume });
  },
  setNudgeVolume: (volume) => {
    localStorage.setItem(NUDGE_VOLUME_KEY, String(volume));
    set({ nudgeVolume: volume });
  },
  setGlobalVoiceVolume: (volume) => {
    localStorage.setItem(VOICE_VOLUME_KEY, String(volume));
    set({ globalVoiceVolume: volume });
  },
}));
