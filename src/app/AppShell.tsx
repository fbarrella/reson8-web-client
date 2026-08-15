import { Outlet } from "react-router-dom";
import { X } from "lucide-react";

import { AppHeader } from "@/app/AppHeader";
import { BottomTabBar } from "@/app/BottomTabBar";
import { ChannelTreePanel } from "@/features/channels/ChannelTreePanel";
import { VoiceMiniBar } from "@/features/voice/VoiceMiniBar";
import { VoicePanel } from "@/features/voice/VoicePanel";
import { useUiStore } from "@/stores/uiStore";
import { cn } from "@/lib/utils";

/**
 * Three-breakpoint composition of one component set (master PRD §5.1):
 *  - base (<768px): single-column nav-stack, bottom tab bar, voice mini-bar
 *    that expands to a full-screen VoicePanel sheet.
 *  - md (>=768px): collapsible channel drawer + content pane, same
 *    mini-bar/sheet pattern as base.
 *  - lg (>=1024px): fixed three-pane — channel tree | content | persistent
 *    voice control pane (VoicePanel always rendered, not gated by a sheet).
 */
export function AppShell() {
  const channelDrawerOpen = useUiStore((s) => s.channelDrawerOpen);
  const setChannelDrawerOpen = useUiStore((s) => s.setChannelDrawerOpen);
  const voicePanelOpen = useUiStore((s) => s.voicePanelOpen);
  const setVoicePanelOpen = useUiStore((s) => s.setVoicePanelOpen);

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

      {/* lg: persistent third pane */}
      <div className="hidden lg:block lg:w-80 lg:shrink-0 lg:border-l lg:border-border">
        <VoicePanel />
      </div>

      {/* base/md: voice panel expands as a full-screen sheet over the mini-bar */}
      {voicePanelOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-card lg:hidden">
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
            <h2 className="text-base font-semibold text-foreground">Voice</h2>
            <button
              type="button"
              aria-label="Close voice panel"
              onClick={() => setVoicePanelOpen(false)}
              className="flex size-11 items-center justify-center text-muted-foreground hover:text-foreground"
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="min-h-0 flex-1">
            <VoicePanel />
          </div>
        </div>
      )}
    </div>
  );
}
