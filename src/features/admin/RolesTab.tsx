import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";

import { useAdminStore, type IUserWithRoles } from "@/stores/adminStore";
import { useConnectionStore } from "@/stores/connectionStore";
import { loadUsersAndRoles, toggleUserRole } from "@/services/adminService";
import type { IRole } from "@/types/reson8-protocol";
import { cn } from "@/lib/utils";

/**
 * Desktop matches by this exact role name (renderer.ts) to block an admin
 * from removing their own admin-equivalent role — replicated verbatim per
 * the PRD rather than inventing a different mechanism, since the server
 * enforces nothing structural here itself (Phase 6 PRD P6.1). Unlike the
 * desktop client (which compares the raw instanceId against the DB user id
 * — not actually equivalent in general), this uses the already-resolved
 * `selfUserId`/nickname-fallback self-identification this project has used
 * since Phase 3, which is the correct comparison.
 */
const SELF_ADMIN_ROLE_NAME = "Server Admin";

function RoleToggle({
  role,
  active,
  disabled,
  disabledReason,
  onToggle,
}: {
  role: IRole;
  active: boolean;
  disabled: boolean;
  disabledReason?: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={disabled ? disabledReason : undefined}
      onClick={onToggle}
      style={
        role.color
          ? active
            ? { background: role.color, borderColor: role.color, color: "#fff" }
            : { borderColor: role.color }
          : undefined
      }
      className={cn(
        "min-h-9 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        !role.color && (active ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-accent"),
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      {role.name}
    </button>
  );
}

function UserRow({ user, roles, isSelf }: { user: IUserWithRoles; roles: IRole[]; isSelf: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [pendingRoleId, setPendingRoleId] = useState<string | null>(null);
  const userRoleIds = new Set(user.roles.map((r) => r.id));

  const handleToggle = async (role: IRole) => {
    const hasRole = userRoleIds.has(role.id);
    setPendingRoleId(role.id);
    await toggleUserRole(user.id, role.id, hasRole ? "remove" : "add");
    setPendingRoleId(null);
  };

  return (
    <li className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex min-h-11 w-full items-center gap-2 py-2 text-left hover:bg-accent"
      >
        {expanded ? (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        )}
        <span className="flex-1 truncate text-sm text-foreground">
          {user.nickname}
          {isSelf && <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>}
        </span>
        <span className="flex gap-1">
          {user.roles.slice(0, 3).map((r) => (
            <span key={r.id} className="text-xs text-muted-foreground">
              {r.name}
            </span>
          ))}
        </span>
      </button>

      {expanded && (
        <div className="flex flex-wrap gap-1.5 pb-3 pl-6">
          {roles.map((role) => {
            const active = userRoleIds.has(role.id);
            const guardSelfAdmin = isSelf && active && role.name === SELF_ADMIN_ROLE_NAME;
            return (
              <RoleToggle
                key={role.id}
                role={role}
                active={active}
                disabled={guardSelfAdmin || pendingRoleId === role.id}
                disabledReason={
                  guardSelfAdmin ? "You can't remove your own admin role." : undefined
                }
                onToggle={() => void handleToggle(role)}
              />
            );
          })}
        </div>
      )}
    </li>
  );
}

/** Settings → Roles (Phase 6 PRD P6.1), MANAGE_ROLES-gated at the SettingsSheet tab level. */
export function RolesTab() {
  const users = useAdminStore((s) => s.users);
  const roles = useAdminStore((s) => s.roles);
  const loading = useAdminStore((s) => s.usersLoading);
  const selfUserId = useConnectionStore((s) => s.selfUserId);
  const nickname = useConnectionStore((s) => s.nickname);

  useEffect(() => {
    void loadUsersAndRoles();
  }, []);

  if (loading && users.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading…
      </div>
    );
  }

  if (users.length === 0) {
    return <p className="text-sm text-muted-foreground">No users found.</p>;
  }

  return (
    <ul>
      {users.map((user) => {
        const isSelf = selfUserId ? user.id === selfUserId : user.nickname === nickname;
        return <UserRow key={user.id} user={user} roles={roles} isSelf={isSelf} />;
      })}
    </ul>
  );
}
