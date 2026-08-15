import { useSettingsStore } from "@/stores/settingsStore";

/**
 * Filenames match public/sounds/*.mp3 (ported from the desktop client's
 * assets/sound-alerts/ set — CLAUDE.md "Sound alert filenames"). Only a
 * subset is wired to live events this phase (connected/disconnected); the
 * rest are referenced here so later phases can add `play(name)` calls
 * without touching this list.
 */
export type SoundName =
  | "channel_created"
  | "channel_deleted"
  | "connected"
  | "disconnected"
  | "hey_wake_up"
  | "insufficient_perms"
  | "joining-channel"
  | "leaving-channel"
  | "mic_activated"
  | "mic_muted"
  | "nudge"
  | "sound_muted"
  | "sound_resumed"
  | "user_banned_from_server"
  | "user_unbanned_from_server"
  | "user_disconnected_from_channel"
  | "user_joined_channel"
  | "user_kicked_from_channel"
  | "you_were_kicked_from_channel";

export type VolumeCategory = "alert" | "nudge";

/**
 * Browsers block audio playback until a user gesture occurs on the page.
 * `<audio>` elements are lazily created on first pointerdown/keydown rather
 * than at module load, and play() is skipped entirely before that gesture —
 * see Phase 1 PRD P1.11.
 */
class SoundAlertService {
  private unlocked = false;
  private cache = new Map<SoundName, HTMLAudioElement>();

  init(): void {
    if (typeof window === "undefined") return;
    const unlock = () => {
      this.unlocked = true;
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
  }

  play(name: SoundName, category: VolumeCategory = "alert"): void {
    if (!this.unlocked) return;

    const { muteAlerts, alertVolume, nudgeVolume } = useSettingsStore.getState();
    if (muteAlerts) return;

    let audio = this.cache.get(name);
    if (!audio) {
      audio = new Audio(`/sounds/${name}.mp3`);
      this.cache.set(name, audio);
    }
    audio.volume = category === "nudge" ? nudgeVolume : alertVolume;
    audio.currentTime = 0;
    void audio.play().catch(() => {
      // Playback can still be rejected (e.g. tab backgrounded) — not user-actionable.
    });
  }
}

export const soundAlert = new SoundAlertService();
