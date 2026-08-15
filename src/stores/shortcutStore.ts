import { create } from "zustand";

import {
  type ShortcutSlot,
  type ShortcutCombo,
  loadShortcut,
  saveShortcut,
  clearShortcut,
} from "@/lib/keyboardShortcut";

const SLOTS: ShortcutSlot[] = ["ptt", "mute", "deafen", "disconnect"];

interface ShortcutState {
  shortcuts: Record<ShortcutSlot, ShortcutCombo | null>;
  /** Non-null while the Settings UI is capturing a new combo — the global
   *  PTT/mute/deafen/disconnect listener suppresses itself during this. */
  recordingSlot: ShortcutSlot | null;

  setRecordingSlot: (slot: ShortcutSlot | null) => void;
  setShortcut: (slot: ShortcutSlot, keys: string[]) => void;
  clearShortcutSlot: (slot: ShortcutSlot) => void;
}

export const useShortcutStore = create<ShortcutState>((set) => ({
  shortcuts: Object.fromEntries(SLOTS.map((slot) => [slot, loadShortcut(slot)])) as Record<
    ShortcutSlot,
    ShortcutCombo | null
  >,
  recordingSlot: null,

  setRecordingSlot: (recordingSlot) => set({ recordingSlot }),
  setShortcut: (slot, keys) => {
    const combo = saveShortcut(slot, keys);
    set((state) => ({ shortcuts: { ...state.shortcuts, [slot]: combo } }));
  },
  clearShortcutSlot: (slot) => {
    clearShortcut(slot);
    set((state) => ({ shortcuts: { ...state.shortcuts, [slot]: null } }));
  },
}));
