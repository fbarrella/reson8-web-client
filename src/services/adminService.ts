import { socketService } from "@/services/socketService";
import { useAdminStore } from "@/stores/adminStore";
import { useConnectionStore } from "@/stores/connectionStore";
import { useServerSettingsStore } from "@/stores/serverSettingsStore";
import { reportAckError } from "@/lib/ackError";
import { soundAlert } from "@/lib/soundAlert";
import { toast } from "@/stores/toastStore";

/** Server settings tab (Phase 6 PRD P6.3) — requires literal ADMIN. The
 *  live SERVER_SETTINGS_UPDATED broadcast (already handled in
 *  connectionService since Phase 5) is what actually updates the store on
 *  success; this just surfaces a failed ack. */
export async function updateNudgeEnabled(nudgeEnabled: boolean): Promise<boolean> {
  const res = await socketService.updateServerSettings(nudgeEnabled);
  if (!res.success) {
    reportAckError("Couldn't update server settings", res.error);
    return false;
  }
  useServerSettingsStore.getState().setNudgeEnabled(nudgeEnabled);
  return true;
}

/** Roles tab (Phase 6 PRD P6.1) — GET_ALL_USERS + GET_ROLES, both MANAGE_ROLES-gated server-side. */
export async function loadUsersAndRoles(): Promise<void> {
  const serverId = useConnectionStore.getState().serverId;
  if (!serverId) return;
  useAdminStore.getState().setUsersLoading(true);
  const [usersRes, rolesRes] = await Promise.all([
    socketService.getAllUsers(serverId),
    socketService.getRoles(serverId),
  ]);
  useAdminStore.getState().setUsersLoading(false);
  if (!usersRes.success || !usersRes.users) {
    reportAckError("Couldn't load users", usersRes.error);
    return;
  }
  if (!rolesRes.success || !rolesRes.roles) {
    reportAckError("Couldn't load roles", rolesRes.error);
    return;
  }
  useAdminStore.getState().setUsersAndRoles(usersRes.users, rolesRes.roles);
}

export async function toggleUserRole(
  userId: string,
  roleId: string,
  action: "add" | "remove",
): Promise<boolean> {
  const res = await socketService.assignRole(userId, roleId, action);
  if (!res.success) {
    reportAckError(`Couldn't ${action === "add" ? "assign" : "remove"} role`, res.error);
    return false;
  }
  await loadUsersAndRoles();
  return true;
}

/** Emoji approval queue (Phase 6 PRD P6.2) — both MANAGE_EMOJIS-gated server-side. */
export async function loadPendingEmojis(): Promise<void> {
  useAdminStore.getState().setPendingEmojisLoading(true);
  const res = await socketService.getPendingEmojis();
  useAdminStore.getState().setPendingEmojisLoading(false);
  if (!res.success || !res.emojis) {
    reportAckError("Couldn't load pending emoji", res.error);
    return;
  }
  useAdminStore.getState().setPendingEmojis(res.emojis);
}

export async function reviewEmoji(emojiId: string, decision: "APPROVED" | "REJECTED"): Promise<boolean> {
  const res = await socketService.reviewCustomEmoji(emojiId, decision);
  if (!res.success) {
    reportAckError(`Couldn't ${decision === "APPROVED" ? "approve" : "reject"} emoji`, res.error);
    return false;
  }
  useAdminStore.getState().removePendingEmoji(emojiId);
  return true;
}

/** Banned users list (Phase 6 PRD P6.5) — all BAN_USER-gated server-side. */
export async function loadBannedUsers(): Promise<void> {
  useAdminStore.getState().setBannedUsersLoading(true);
  const res = await socketService.getBannedUsers();
  useAdminStore.getState().setBannedUsersLoading(false);
  if (!res.success || !res.users) {
    reportAckError("Couldn't load banned users", res.error);
    return;
  }
  useAdminStore.getState().setBannedUsers(res.users);
}

export async function banUser(userId: string): Promise<boolean> {
  const res = await socketService.banUser(userId);
  if (!res.success) {
    reportAckError("Couldn't ban user", res.error);
    return false;
  }
  soundAlert.play("user_banned_from_server");
  toast({ title: "User banned" });
  return true;
}

export async function unbanUser(userId: string): Promise<boolean> {
  const res = await socketService.unbanUser(userId);
  if (!res.success) {
    reportAckError("Couldn't unban user", res.error);
    return false;
  }
  useAdminStore.getState().removeBannedUser(userId);
  soundAlert.play("user_unbanned_from_server");
  toast({ title: "User unbanned" });
  return true;
}

/**
 * Kick from voice channel (Phase 6 PRD P6.4) — KICK_USER-gated server-side,
 * rejoinable (not a ban). The `user_kicked_from_channel`/
 * `you_were_kicked_from_channel` sound cues fire from connectionService's
 * CHANNEL_USER_KICKED/USER_KICKED broadcast handlers, not from this ack —
 * same broadcast-driven convention channelService's CREATE/DELETE_CHANNEL
 * already use, so the acting admin (who is typically still in the channel
 * and would otherwise receive the broadcast too) doesn't hear it twice.
 */
export async function kickUser(userId: string, channelId: string): Promise<boolean> {
  const res = await socketService.kickUser(userId, channelId);
  if (!res.success) {
    reportAckError("Couldn't kick user", res.error);
    return false;
  }
  return true;
}
