import { NavLink } from "react-router-dom";
import { Hash, MessageSquare, Mail, Mic } from "lucide-react";

import { useChatStore } from "@/stores/chatStore";
import { useDmStore } from "@/stores/dmStore";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/app", label: "Channels", icon: Hash, end: true },
  { to: "/app/chat", label: "Chat", icon: MessageSquare, end: false },
  { to: "/app/dms", label: "DMs", icon: Mail, end: false },
  { to: "/app/voice", label: "Voice", icon: Mic, end: false },
] as const;

/**
 * Mobile-only bottom tab bar (master PRD §5.1). Settings is reached via a
 * header icon, not a tab slot, so this always has exactly 4 destinations.
 * Chat's badge = total unread channels (Phase 4 PRD P4.6).
 */
export function BottomTabBar() {
  const hasUnread = useChatStore((s) => s.unreadChannelIds.size > 0);
  const hasUnreadDms = useDmStore((s) => [...s.partners.values()].some((p) => p.unreadCount > 0));

  return (
    <nav
      aria-label="Primary"
      className="flex h-16 shrink-0 items-stretch border-t border-border bg-card lg:hidden"
    >
      {TABS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cn(
              "relative flex flex-1 flex-col items-center justify-center gap-1 text-xs",
              isActive ? "text-primary" : "text-muted-foreground",
            )
          }
        >
          <span className="relative">
            <Icon className="size-5" />
            {to === "/app/chat" && hasUnread && (
              <span
                aria-label="Unread"
                className="absolute -top-0.5 -right-1 size-2 rounded-full bg-primary ring-2 ring-card"
              />
            )}
            {to === "/app/dms" && hasUnreadDms && (
              <span
                aria-label="Unread"
                className="absolute -top-0.5 -right-1 size-2 rounded-full bg-primary ring-2 ring-card"
              />
            )}
          </span>
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
