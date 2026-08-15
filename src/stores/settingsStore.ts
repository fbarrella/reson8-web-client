import { create } from "zustand";

const MUTE_ALERTS_KEY = "reson8-mute-alerts";
const ALERT_VOLUME_KEY = "reson8-alert-volume";
const NUDGE_VOLUME_KEY = "reson8-nudge-volume";

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

  setMuteAlerts: (muted: boolean) => void;
  setAlertVolume: (volume: number) => void;
  setNudgeVolume: (volume: number) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  muteAlerts: readBoolean(MUTE_ALERTS_KEY, false),
  alertVolume: readVolume(ALERT_VOLUME_KEY, 0.8),
  nudgeVolume: readVolume(NUDGE_VOLUME_KEY, 0.8),

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
}));
