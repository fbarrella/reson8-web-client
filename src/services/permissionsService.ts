import { socketService } from "@/services/socketService";
import { useConnectionStore } from "@/stores/connectionStore";
import { usePermissionsStore } from "@/stores/permissionsStore";

/**
 * The wire protocol has no dedicated "what are my own permissions" event —
 * GET_ALL_USERS is the only event that returns per-user role assignments,
 * and it has no self-only variant (Phase 3 PRD P3.4 needs this to gate
 * channel CRUD/reorder UI; the full Roles admin surface is Phase 6).
 *
 * Judgment call (documented rather than silently assumed): fetch the full
 * user list and self-identify by nickname match against
 * connectionStore.nickname. If the ack itself fails — which a
 * permission-gated GET_ALL_USERS would do for a non-admin — that's treated
 * as "no elevated permissions", which is also the correct UI outcome, so
 * either way the gating comes out right. Aggregate every matched role's
 * permission bits via bitwise OR, same contract the server's own
 * requirePermission check uses. Revisit if Phase 6 reveals a more direct
 * mechanism (e.g. the server starts echoing the caller's own userId/roles
 * on join) rather than this self-match workaround.
 */
export async function refreshPermissions(): Promise<void> {
  const { serverId, nickname } = useConnectionStore.getState();
  if (!serverId || !nickname) {
    usePermissionsStore.getState().reset();
    return;
  }

  try {
    const res = await socketService.getAllUsers(serverId);
    if (!res.success || !res.users) {
      usePermissionsStore.getState().setFlags(0n);
      return;
    }

    const self = res.users.find((u) => u.nickname === nickname);
    if (!self) {
      usePermissionsStore.getState().setFlags(0n);
      return;
    }
    if (!useConnectionStore.getState().selfUserId) {
      useConnectionStore.getState().setSelfUserId(self.id);
    }

    let flags = 0n;
    for (const role of self.roles) {
      try {
        flags |= BigInt(role.permissions);
      } catch {
        // Malformed permissions string on some role — skip it rather than fail the whole aggregate.
      }
    }
    usePermissionsStore.getState().setFlags(flags);
  } catch {
    usePermissionsStore.getState().setFlags(0n);
  }
}
