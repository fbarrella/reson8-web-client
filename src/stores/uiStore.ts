import { create } from "zustand";

interface UiState {
  settingsOpen: boolean;
  channelDrawerOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  setChannelDrawerOpen: (open: boolean) => void;
}

/** Ephemeral, non-persisted UI chrome state (settings sheet, tablet drawer). */
export const useUiStore = create<UiState>((set) => ({
  settingsOpen: false,
  channelDrawerOpen: false,
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setChannelDrawerOpen: (open) => set({ channelDrawerOpen: open }),
}));
