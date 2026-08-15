import { useShortcutStore } from "@/stores/shortcutStore";
import { comboMatches } from "@/lib/keyboardShortcut";
import * as voiceConnectionService from "@/services/voiceConnectionService";
import { leaveVoiceChannel } from "@/services/voiceConnectionService";

const heldKeys = new Set<string>();

/**
 * Global in-tab keydown/keyup listener driving the mute/deafen/disconnect/
 * PTT keyboard shortcuts (Phase 2 PRD P2.6). Desktop's Electron
 * `globalShortcut` fires even while the window is unfocused — no browser
 * equivalent exists, so this only fires while the tab is focused, a
 * documented platform limitation surfaced again in the shortcut recorder's
 * own UI copy, not just here.
 *
 * Suppressed entirely while the Settings UI is recording a new combo
 * (`shortcutStore.recordingSlot`), which owns keydown/keyup during that
 * window instead.
 */
export function attachVoiceShortcutListeners(): () => void {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (useShortcutStore.getState().recordingSlot !== null) return;

    heldKeys.add(e.code);
    if (e.repeat) return;

    const { shortcuts } = useShortcutStore.getState();
    if (comboMatches(shortcuts.mute, heldKeys)) voiceConnectionService.toggleMute();
    if (comboMatches(shortcuts.deafen, heldKeys)) voiceConnectionService.toggleDeafen();
    if (comboMatches(shortcuts.disconnect, heldKeys)) leaveVoiceChannel();
    if (comboMatches(shortcuts.ptt, heldKeys)) voiceConnectionService.pttPress();
  };

  const handleKeyUp = (e: KeyboardEvent) => {
    if (useShortcutStore.getState().recordingSlot !== null) {
      heldKeys.delete(e.code);
      return;
    }

    const { shortcuts } = useShortcutStore.getState();
    if (comboMatches(shortcuts.ptt, heldKeys) && heldKeys.has(e.code)) {
      voiceConnectionService.pttRelease();
    }
    heldKeys.delete(e.code);
  };

  const handleBlur = () => {
    // A held PTT key whose keyup we'll never see (e.g. alt-tab away) must
    // not leave the mic stuck open.
    if (heldKeys.size === 0) return;
    const { shortcuts } = useShortcutStore.getState();
    if (comboMatches(shortcuts.ptt, heldKeys)) voiceConnectionService.pttRelease();
    heldKeys.clear();
  };

  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
  window.addEventListener("blur", handleBlur);

  return () => {
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("keyup", handleKeyUp);
    window.removeEventListener("blur", handleBlur);
  };
}
