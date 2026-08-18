import { Mic, MicOff, PhoneOff, Volume2, VolumeX } from "lucide-react";

import { useVoiceStore } from "@/stores/voiceStore";
import { useChannelTreeStore } from "@/stores/channelTreeStore";
import { useUiStore } from "@/stores/uiStore";
import { toggleMute, toggleDeafen, leaveVoiceChannel } from "@/services/voiceConnectionService";
import { useSessionTimer } from "@/hooks/useSessionTimer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Slim always-visible bar, pinned above the mobile tab bar (base/md — lg:
 * shows the full VoicePanel persistently instead, see AppShell). Modeled on
 * a "now playing" mini-player so voice never gets buried behind chat
 * navigation (master PRD §5.1). Tapping it expands the full panel.
 */
export function VoiceMiniBar() {
  const status = useVoiceStore((s) => s.status);
  const currentChannelId = useVoiceStore((s) => s.currentChannelId);
  const sessionStartedAt = useVoiceStore((s) => s.sessionStartedAt);
  const isMuted = useVoiceStore((s) => s.isMuted);
  const isDeafened = useVoiceStore((s) => s.isDeafened);
  const node = useChannelTreeStore((s) =>
    currentChannelId ? s.nodesById.get(currentChannelId) : undefined,
  );
  const timer = useSessionTimer(sessionStartedAt);
  const setVoicePanelOpen = useUiStore((s) => s.setVoicePanelOpen);

  if (status === "idle" || status === "leaving") return null;

  const statusText =
    status === "joining" ? "Joining…" : status === "reconnecting" ? "Reconnecting…" : (timer ?? "00:00");

  return (
    // A plain wrapper, not a <button> — the mute/deafen/leave Buttons below
    // are siblings, not nested descendants, so screen readers never see one
    // interactive control nested inside another (axe: nested-interactive;
    // same fix as ChannelTreePanel's ChannelRow).
    <div
      className={cn(
        "flex h-14 shrink-0 items-center gap-3 border-t border-border bg-card px-3 lg:hidden",
        status === "reconnecting" && "animate-pulse",
      )}
    >
      <button
        type="button"
        aria-label="Expand voice panel"
        onClick={() => setVoicePanelOpen(true)}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <Volume2 className="size-5 shrink-0 text-primary" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">
            {node?.name ?? "Voice"}
          </span>
          <span className="block text-xs text-muted-foreground">{statusText}</span>
        </span>
      </button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={isMuted ? "Unmute" : "Mute"}
        onClick={toggleMute}
      >
        {isMuted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={isDeafened ? "Undeafen" : "Deafen"}
        onClick={toggleDeafen}
      >
        {isDeafened ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
      </Button>
      <Button type="button" variant="ghost" size="icon" aria-label="Leave voice" onClick={leaveVoiceChannel}>
        <PhoneOff className="size-5" />
      </Button>
    </div>
  );
}
