import { NavLink } from "react-router-dom";
import { Menu, Settings, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LatencyIndicator } from "@/features/connection/LatencyIndicator";
import { useUiStore } from "@/stores/uiStore";
import { useDmStore } from "@/stores/dmStore";
import { cn } from "@/lib/utils";

/**
 * Always rendered regardless of breakpoint (unlike BottomTabBar, which is
 * `lg:hidden`) — this is desktop's only persistent entry point into DMs,
 * since there's no channel-tree-equivalent persistent DM pane in the
 * lg three-pane layout (Phase 5 PRD P5.1).
 */
export function AppHeader() {
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);
  const setChannelDrawerOpen = useUiStore((s) => s.setChannelDrawerOpen);
  const hasUnreadDms = useDmStore((s) => [...s.partners.values()].some((p) => p.unreadCount > 0));

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-2">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="hidden md:inline-flex lg:hidden"
        aria-label="Open channels"
        onClick={() => setChannelDrawerOpen(true)}
      >
        <Menu className="size-5" />
      </Button>

      <div className="flex items-center gap-2">
        <img src="/favicon.svg" alt="" aria-hidden="true" className="size-6" />
        <h1 className="text-sm font-semibold text-foreground">Reson8</h1>
      </div>

      <div className="flex items-center gap-3">
        <LatencyIndicator />
        <NavLink
          to="/app/dms"
          aria-label={hasUnreadDms ? "Direct Messages (unread)" : "Direct Messages"}
          className={({ isActive }) =>
            cn(
              "relative hidden size-9 items-center justify-center rounded-md lg:flex",
              isActive ? "text-primary" : "text-muted-foreground hover:text-foreground hover:bg-accent",
            )
          }
        >
          <Mail className="size-5" />
          {hasUnreadDms && (
            <span
              aria-hidden="true"
              className="absolute top-1 right-1 size-2 rounded-full bg-primary ring-2 ring-card"
            />
          )}
        </NavLink>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Open settings"
          onClick={() => setSettingsOpen(true)}
        >
          <Settings className="size-5" />
        </Button>
      </div>
    </header>
  );
}
