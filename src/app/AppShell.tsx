import { Outlet } from "react-router-dom";

import { AppHeader } from "@/app/AppHeader";
import { BottomTabBar } from "@/app/BottomTabBar";
import { ChannelTreePanel } from "@/features/channels/ChannelTreePanel";
import { VoiceMiniBar } from "@/features/voice/VoiceMiniBar";
import { useUiStore } from "@/stores/uiStore";
import { cn } from "@/lib/utils";

/**
 * Three-breakpoint composition of one component set (master PRD §5.1):
 *  - base (<768px): single-column nav-stack, bottom tab bar.
 *  - md (>=768px): collapsible channel drawer + content pane.
 *  - lg (>=1024px): fixed three-pane (channel tree | content | voice bar slot).
 */
export function AppShell() {
  const channelDrawerOpen = useUiStore((s) => s.channelDrawerOpen);
  const setChannelDrawerOpen = useUiStore((s) => s.setChannelDrawerOpen);

  return (
    <div className="flex h-dvh flex-col overflow-hidden lg:flex-row">
      {/* lg: persistent fixed channel tree pane */}
      <ChannelTreePanel className="hidden lg:block lg:w-72 lg:shrink-0 lg:border-r lg:border-border" />

      {/* md: collapsible overlay drawer */}
      {channelDrawerOpen && (
        <div className="fixed inset-0 z-40 hidden md:block lg:hidden">
          <button
            type="button"
            aria-label="Close channels"
            className="absolute inset-0 bg-black/50"
            onClick={() => setChannelDrawerOpen(false)}
          />
          <ChannelTreePanel className="relative z-10 h-full w-80 border-r border-border bg-card" />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <AppHeader />
        <main className={cn("flex-1 overflow-y-auto")}>
          <Outlet />
        </main>
        <VoiceMiniBar />
        <BottomTabBar />
      </div>
    </div>
  );
}
