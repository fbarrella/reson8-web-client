import { useEffect, useRef } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { X } from "lucide-react";

import { AppHeader } from "@/app/AppHeader";
import { BottomTabBar } from "@/app/BottomTabBar";
import { ChannelTreePanel } from "@/features/channels/ChannelTreePanel";
import { VoiceMiniBar } from "@/features/voice/VoiceMiniBar";
import { VoicePanel } from "@/features/voice/VoicePanel";
import { useUiStore } from "@/stores/uiStore";
import { useDmStore } from "@/stores/dmStore";
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
  const pendingAutoOpenPartnerId = useDmStore((s) => s.pendingAutoOpenPartnerId);
  const navigate = useNavigate();
  const voicePanelRef = useRef<HTMLDivElement>(null);

  // One-shot mobile auto-open of the sole unread DM conversation right
  // after connect (Phase 5 PRD P5.2) — desktop instead just opens the tab,
  // handled directly by connectionService's hydration without navigating.
  useEffect(() => {
    if (!pendingAutoOpenPartnerId) return;
    navigate(`/app/dms/${pendingAutoOpenPartnerId}`);
    useDmStore.getState().setPendingAutoOpen(null);
  }, [pendingAutoOpenPartnerId, navigate]);

  // Matches SettingsSheet's own modal contract (focus-on-open, Escape-to-close)
  // — this sheet is functionally identical (full-screen, has a Close button)
  // but previously had neither, and no role/landmark at all (axe: region,
  // found in the P7.5 audit).
  useEffect(() => {
    if (!voicePanelOpen) return;
    voicePanelRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setVoicePanelOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [voicePanelOpen, setVoicePanelOpen]);

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

      <div
        className="flex min-w-0 flex-1 flex-col overflow-hidden"
        aria-hidden={channelDrawerOpen || voicePanelOpen ? true : undefined}
      >
        <AppHeader />
        <main className={cn("flex-1 overflow-y-auto")}>
          <Outlet />
        </main>
        <VoiceMiniBar />
        <BottomTabBar />
      </div>

      {/* lg: persistent third pane */}
      <aside
        aria-label="Voice"
        className="hidden lg:block lg:w-80 lg:shrink-0 lg:border-l lg:border-border"
      >
        <VoicePanel />
      </aside>

      {/* base/md: voice panel expands as a full-screen sheet over the mini-bar */}
      {voicePanelOpen && (
        <div
          ref={voicePanelRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby="voice-panel-heading"
          className="fixed inset-0 z-50 flex flex-col bg-card outline-none lg:hidden"
        >
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
            <h2 id="voice-panel-heading" className="text-base font-semibold text-foreground">
              Voice
            </h2>
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
