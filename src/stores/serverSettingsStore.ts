import { create } from "zustand";

interface ServerSettingsState {
  /** Server-wide, admin-toggleable (Phase 6 writes it) — null until the
   *  first GET_SERVER_SETTINGS response arrives post-connect, defaulting to
   *  "shown" in the meantime so the Nudge action doesn't flash-hide. */
  nudgeEnabled: boolean;
  setNudgeEnabled: (enabled: boolean) => void;
  reset: () => void;
}

export const useServerSettingsStore = create<ServerSettingsState>((set) => ({
  nudgeEnabled: true,
  setNudgeEnabled: (enabled) => set({ nudgeEnabled: enabled }),
  reset: () => set({ nudgeEnabled: true }),
}));
