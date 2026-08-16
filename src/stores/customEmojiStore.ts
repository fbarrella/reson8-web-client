import { create } from "zustand";
import type { ICustomEmoji } from "@/types/reson8-protocol";

interface CustomEmojiState {
  /** Keyed by name — includes every APPROVED emoji (from GET_APPROVED_EMOJIS
   *  / CUSTOM_EMOJI_APPROVED) plus the local user's own still-PENDING
   *  submissions (Phase 4 PRD P4.9's "visibly-pending in their own picker"). */
  byName: Map<string, ICustomEmoji>;

  setApprovedList: (emojis: ICustomEmoji[]) => void;
  upsert: (emoji: ICustomEmoji) => void;
  reset: () => void;
}

export const useCustomEmojiStore = create<CustomEmojiState>((set, get) => ({
  byName: new Map(),

  setApprovedList: (emojis) => {
    const next = new Map(get().byName);
    for (const emoji of emojis) next.set(emoji.name, emoji);
    set({ byName: next });
  },

  upsert: (emoji) => {
    const next = new Map(get().byName);
    next.set(emoji.name, emoji);
    set({ byName: next });
  },

  reset: () => set({ byName: new Map() }),
}));
