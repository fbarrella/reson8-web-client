import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Users, Ban } from "lucide-react";

import { loadOnlineUsers } from "@/services/dmService";
import { banUser } from "@/services/adminService";
import { useConnectionStore } from "@/stores/connectionStore";
import { useHasPermission } from "@/stores/permissionsStore";
import { PermissionFlags, type IOnlineUser } from "@/types/reson8-protocol";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

/**
 * GET_ONLINE_USERS-backed directory (Phase 5 PRD P5.2) — includes offline
 * DM partners per the protocol's own IOnlineUser contract, so this doubles
 * as "start a new conversation" and "message someone who's offline right
 * now but has messaged me before." Also the reachable entry point for the
 * Ban action (Phase 6 PRD P6.5).
 */
function UserRow({ user, onSelect }: { user: IOnlineUser; onSelect: (userId: string) => void }) {
  const canBan = useHasPermission(PermissionFlags.BAN_USER);
  const selfUserId = useConnectionStore((s) => s.selfUserId);
  const nickname = useConnectionStore((s) => s.nickname);
  const isSelf = selfUserId ? user.userId === selfUserId : user.nickname === nickname;
  const [confirmingBan, setConfirmingBan] = useState(false);
  const [banning, setBanning] = useState(false);

  const handleBan = async () => {
    setBanning(true);
    await banUser(user.userId);
    setBanning(false);
    setConfirmingBan(false);
  };

  return (
    <li className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onSelect(user.userId)}
        className="flex min-h-11 flex-1 items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
      >
        <span
          aria-label={user.isOnline ? "Online" : "Offline"}
          className={`size-2 shrink-0 rounded-full ${user.isOnline ? "bg-success" : "bg-muted-foreground/40"}`}
        />
        <span className="flex-1 truncate">{user.nickname}</span>
      </button>

      {canBan && !isSelf && (
        <button
          type="button"
          aria-label={`Ban ${user.nickname}`}
          onClick={() => setConfirmingBan(true)}
          className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-destructive"
        >
          <Ban className="size-4" />
        </button>
      )}

      <AlertDialog open={confirmingBan} onOpenChange={setConfirmingBan}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ban {user.nickname}?</AlertDialogTitle>
            <AlertDialogDescription>
              This blocks their instance ID from rejoining this server. Note: they can circumvent this by
              clearing their browser's site data and reconnecting with a new identity — this is a known
              limitation of the server's own instance-based identity model, not something this client can
              close.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={banning}>Cancel</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button variant="destructive" disabled={banning} onClick={() => void handleBan()}>
                Ban
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}

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
        <UserRow key={user.userId} user={user} onSelect={onSelect} />
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
