import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { useAdminStore } from "@/stores/adminStore";
import { useServerSettingsStore } from "@/stores/serverSettingsStore";
import { useHasPermission } from "@/stores/permissionsStore";
import { updateNudgeEnabled, loadBannedUsers, unbanUser } from "@/services/adminService";
import { PermissionFlags } from "@/types/reson8-protocol";
import { Button } from "@/components/ui/button";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function BannedUsersList() {
  const bannedUsers = useAdminStore((s) => s.bannedUsers);
  const loading = useAdminStore((s) => s.bannedUsersLoading);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    void loadBannedUsers();
  }, []);

  const handleUnban = async (userId: string) => {
    setPendingId(userId);
    await unbanUser(userId);
    setPendingId(null);
  };

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-foreground">Banned Users</h3>
      {loading && bannedUsers.length === 0 ? (
        <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : bannedUsers.length === 0 ? (
        <p className="text-sm text-muted-foreground">No banned users.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {bannedUsers.map((u) => (
            <li
              key={u.userId}
              className="flex min-h-11 items-center gap-2 rounded-md border border-border px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-foreground">{u.nickname}</p>
                <p className="text-xs text-muted-foreground">Banned {formatDate(u.bannedAt)}</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pendingId === u.userId}
                onClick={() => void handleUnban(u.userId)}
              >
                Unban
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Settings → Server (Phase 6 PRD P6.3/P6.5). Tab-level visibility (in
 * SettingsSheet) requires ADMIN or BAN_USER; the Nudge toggle itself is
 * additionally gated on literal ADMIN here (not the bypass-inclusive
 * MANAGE_CHANNELS/etc — the server's own UPDATE_SERVER_SETTINGS handler
 * requires exactly ADMIN, confirmed against
 * ../reson8/apps/server/src/handlers/nudge.handler.ts), so a BAN_USER-only
 * moderator sees the banned-users list but not the Nudge toggle.
 */
export function ServerSettingsTab() {
  const nudgeEnabled = useServerSettingsStore((s) => s.nudgeEnabled);
  const canManageServerSettings = useHasPermission(PermissionFlags.ADMIN);
  const canBan = useHasPermission(PermissionFlags.BAN_USER);
  const [saving, setSaving] = useState(false);

  const handleToggle = async (checked: boolean) => {
    setSaving(true);
    await updateNudgeEnabled(checked);
    setSaving(false);
  };

  return (
    <div className="flex flex-col gap-6">
      {canManageServerSettings && (
        <label className="flex min-h-11 items-center justify-between gap-4">
          <span className="text-sm font-medium text-foreground">Nudge enabled server-wide</span>
          <input
            type="checkbox"
            className="size-5"
            checked={nudgeEnabled}
            disabled={saving}
            onChange={(e) => void handleToggle(e.target.checked)}
          />
        </label>
      )}

      {canBan && <BannedUsersList />}
    </div>
  );
}
