import { create } from "zustand";

interface UiState {
  settingsOpen: boolean;
  channelDrawerOpen: boolean;
  /** Mobile/tablet only — the expanded voice panel sheet (lg: shows it persistently instead). */
  voicePanelOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  setChannelDrawerOpen: (open: boolean) => void;
  setVoicePanelOpen: (open: boolean) => void;
}

/** Ephemeral, non-persisted UI chrome state (settings sheet, tablet drawer, voice panel). */
export const useUiStore = create<UiState>((set) => ({
  settingsOpen: false,
  channelDrawerOpen: false,
  voicePanelOpen: false,
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setChannelDrawerOpen: (open) => set({ channelDrawerOpen: open }),
  setVoicePanelOpen: (open) => set({ voicePanelOpen: open }),
}));
