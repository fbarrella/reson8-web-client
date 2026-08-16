import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Users } from "lucide-react";

import { loadOnlineUsers } from "@/services/dmService";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { IOnlineUser } from "@/types/reson8-protocol";

/**
 * GET_ONLINE_USERS-backed directory (Phase 5 PRD P5.2) — includes offline
 * DM partners per the protocol's own IOnlineUser contract, so this doubles
 * as "start a new conversation" and "message someone who's offline right
 * now but has messaged me before."
 */
/**
 * Mounted only while the dialog is open (see below) so its `loading` state
 * starts fresh every time without an imperative setState-in-effect reset —
 * same remount-via-key pattern LinkPreviewCard uses (Phase 4 PRD's purity
 * lint fix), applied here for the same reason.
 */
function OnlineUsersList({ onSelect }: { onSelect: (userId: string) => void }) {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<IOnlineUser[]>([]);

  useEffect(() => {
    void loadOnlineUsers().then((result) => {
      setLoading(false);
      setUsers(result);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading…
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1 p-8 text-center">
        <Users className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No one else here yet.</p>
      </div>
    );
  }

  return (
    <ul>
      {users.map((user) => (
        <li key={user.userId}>
          <button
            type="button"
            onClick={() => onSelect(user.userId)}
            className="flex min-h-11 w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
          >
            <span
              aria-label={user.isOnline ? "Online" : "Offline"}
              className={`size-2 shrink-0 rounded-full ${user.isOnline ? "bg-success" : "bg-muted-foreground/40"}`}
            />
            <span className="flex-1 truncate">{user.nickname}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function OnlineUsersDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate();

  const openConversation = (userId: string) => {
    onOpenChange(false);
    navigate(`/app/dms/${userId}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Online Users</DialogTitle>
        </DialogHeader>
        <div className="max-h-96 overflow-y-auto p-2">
          {open && <OnlineUsersList onSelect={openConversation} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
