import { create } from "zustand";
import type { IUser, IRole, ICustomEmoji, IBannedUser } from "@/types/reson8-protocol";

export type IUserWithRoles = IUser & { roles: IRole[] };

interface AdminState {
  /** Refetched on tab open, not kept live — Phase 6 PRD's State/Data Additions
   *  note: no persistent subscription needed beyond what's already broadcast
   *  elsewhere (CUSTOM_EMOJI_APPROVED, SERVER_SETTINGS_UPDATED, etc). */
  users: IUserWithRoles[];
  roles: IRole[];
  pendingEmojis: ICustomEmoji[];
  bannedUsers: IBannedUser[];
  usersLoading: boolean;
  pendingEmojisLoading: boolean;
  bannedUsersLoading: boolean;

  setUsersAndRoles: (users: IUserWithRoles[], roles: IRole[]) => void;
  setUsersLoading: (loading: boolean) => void;
  setPendingEmojis: (emojis: ICustomEmoji[]) => void;
  setPendingEmojisLoading: (loading: boolean) => void;
  removePendingEmoji: (emojiId: string) => void;
  setBannedUsers: (users: IBannedUser[]) => void;
  setBannedUsersLoading: (loading: boolean) => void;
  removeBannedUser: (userId: string) => void;
  reset: () => void;
}

const initialState = {
  users: [],
  roles: [],
  pendingEmojis: [],
  bannedUsers: [],
  usersLoading: false,
  pendingEmojisLoading: false,
  bannedUsersLoading: false,
};

export const useAdminStore = create<AdminState>((set) => ({
  ...initialState,

  setUsersAndRoles: (users, roles) => set({ users, roles }),
  setUsersLoading: (usersLoading) => set({ usersLoading }),
  setPendingEmojis: (pendingEmojis) => set({ pendingEmojis }),
  setPendingEmojisLoading: (pendingEmojisLoading) => set({ pendingEmojisLoading }),
  removePendingEmoji: (emojiId) =>
    set((s) => ({ pendingEmojis: s.pendingEmojis.filter((e) => e.id !== emojiId) })),
  setBannedUsers: (bannedUsers) => set({ bannedUsers }),
  setBannedUsersLoading: (bannedUsersLoading) => set({ bannedUsersLoading }),
  removeBannedUser: (userId) =>
    set((s) => ({ bannedUsers: s.bannedUsers.filter((u) => u.userId !== userId) })),
  reset: () => set(initialState),
}));
