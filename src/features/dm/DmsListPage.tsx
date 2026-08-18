import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Users } from "lucide-react";

import { useDmStore } from "@/stores/dmStore";
import { Button } from "@/components/ui/button";
import { OnlineUsersDialog } from "@/features/dm/OnlineUsersDialog";

/**
 * The bottom tab bar's "DMs" destination (mobile nav-stack entry point) —
 * a flat, quick-jump list of conversations with unread activity or opened
 * this session, mirroring ChatTabPage's role for channels (Phase 5 PRD
 * P5.1/P5.2). "Online Users" is the separate directory for starting new
 * conversations.
 */
export function DmsListPage() {
  const navigate = useNavigate();
  const partners = useDmStore((s) => s.partners);
  const openPartnerIds = useDmStore((s) => s.openPartnerIds);
  const [onlineUsersOpen, setOnlineUsersOpen] = useState(false);

  const ids = [...new Set([...partners.keys(), ...openPartnerIds])];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-end border-b border-border p-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setOnlineUsersOpen(true)}>
          <Users className="size-4" /> Online Users
        </Button>
      </div>

      {ids.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 p-8 text-center">
          <Mail className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No conversations yet.</p>
          <p className="text-xs text-muted-foreground">Tap "Online Users" to start one.</p>
        </div>
      ) : (
        <ul className="flex-1 overflow-y-auto p-2">
          {ids.map((id) => {
            const partner = partners.get(id);
            if (!partner) return null;
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => navigate(`/app/dms/${id}`)}
                  className="flex min-h-11 w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
                >
                  <span
                    aria-hidden="true"
                    className={`size-2 shrink-0 rounded-full ${partner.isOnline ? "bg-success" : "bg-muted-foreground/40"}`}
                  />
                  <span className="sr-only">{partner.isOnline ? "Online" : "Offline"}</span>
                  <span className="flex-1 truncate">{partner.nickname}</span>
                  {partner.unreadCount > 0 && (
                    <span className="flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                      {partner.unreadCount}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <OnlineUsersDialog open={onlineUsersOpen} onOpenChange={setOnlineUsersOpen} />
    </div>
  );
}
