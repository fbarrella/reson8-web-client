import { create } from "zustand";
import { PermissionFlags } from "@/types/reson8-protocol";

interface PermissionsState {
  /** Bitwise OR of every role assigned to the local user. 0n until resolved. */
  flags: bigint;
  /** True once a GET_ALL_USERS round trip (success or failure) has completed
   *  at least once this session — lets gated UI distinguish "still loading"
   *  from "confirmed no permissions", avoiding an admin-affordance flash. */
  resolved: boolean;

  setFlags: (flags: bigint) => void;
  markResolved: () => void;
  reset: () => void;
}

export const usePermissionsStore = create<PermissionsState>((set) => ({
  flags: 0n,
  resolved: false,
  setFlags: (flags) => set({ flags, resolved: true }),
  markResolved: () => set({ resolved: true }),
  reset: () => set({ flags: 0n, resolved: false }),
}));

/** ADMIN bypasses every other check, mirroring the server's own requirePermission contract. */
export function hasPermission(flags: bigint, flag: PermissionFlags): boolean {
  const admin = BigInt(PermissionFlags.ADMIN);
  const bit = BigInt(flag);
  return (flags & admin) === admin || (flags & bit) === bit;
}

export function useHasPermission(flag: PermissionFlags): boolean {
  return usePermissionsStore((s) => hasPermission(s.flags, flag));
}
