import { Mic, MicOff, PhoneOff, Volume2, VolumeX } from "lucide-react";

import { useVoiceStore } from "@/stores/voiceStore";
import { useChannelTreeStore } from "@/stores/channelTreeStore";
import { toggleMute, toggleDeafen, leaveVoiceChannel } from "@/services/voiceConnectionService";
import { useSessionTimer } from "@/hooks/useSessionTimer";
import { useJoinVoice } from "@/hooks/useJoinVoice";
import { useConnectionStore } from "@/stores/connectionStore";
import { Button } from "@/components/ui/button";
import { PttButton } from "@/features/voice/PttButton";
import { MicPermissionDeniedPanel } from "@/features/voice/MicPermissionDeniedPanel";
import { OccupantActionsPopover } from "@/features/voice/OccupantActionsPopover";
import { MicLevelMeter } from "@/features/voice/MicLevelMeter";
import { cn } from "@/lib/utils";

function initials(nickname: string): string {
  return nickname.slice(0, 2).toUpperCase();
}

/**
 * Full voice panel — occupant list, mute/deafen/leave, PTT (in PTT mode).
 * Device-agnostic: this exact component renders both as a mobile/tablet
 * expanded sheet and as the persistent lg: third pane (master PRD "one
 * component set, three compositions" principle) — Phase 2 PRD P2.11.
 */
export function VoicePanel() {
  const status = useVoiceStore((s) => s.status);
  const currentChannelId = useVoiceStore((s) => s.currentChannelId);
  const sessionStartedAt = useVoiceStore((s) => s.sessionStartedAt);
  const isMuted = useVoiceStore((s) => s.isMuted);
  const isDeafened = useVoiceStore((s) => s.isDeafened);
  const pttMode = useVoiceStore((s) => s.pttMode);
  const activeSpeakerUserIds = useVoiceStore((s) => s.activeSpeakerUserIds);
  const node = useChannelTreeStore((s) =>
    currentChannelId ? s.nodesById.get(currentChannelId) : undefined,
  );
  const timer = useSessionTimer(sessionStartedAt);
  const { permissionDenied, join } = useJoinVoice();
  const selfNickname = useConnectionStore((s) => s.nickname);
  const micLevelDb = useVoiceStore((s) => s.micLevelDb);
  const noiseGateEnabled = useVoiceStore((s) => s.noiseGateEnabled);
  const noiseGateThresholdDb = useVoiceStore((s) => s.noiseGateThresholdDb);

  const isActive = status === "connected" || status === "joining" || status === "reconnecting";

  if (!isActive) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <Volume2 className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Not in a voice channel.</p>
        {permissionDenied && currentChannelId && (
          <MicPermissionDeniedPanel onRetry={() => join(currentChannelId)} />
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-4">
        <p className="truncate text-sm font-semibold text-foreground">{node?.name ?? "Voice"}</p>
        <p className="text-xs text-muted-foreground">
          {status === "joining" && "Joining…"}
          {status === "reconnecting" && "Reconnecting…"}
          {status === "connected" && (timer ?? "00:00")}
        </p>
      </div>

      {permissionDenied && currentChannelId && (
        <div className="p-4">
          <MicPermissionDeniedPanel onRetry={() => join(currentChannelId)} />
        </div>
      )}

      <ul className="flex-1 space-y-1 overflow-y-auto p-3">
        {(node?.occupants ?? []).map((occupant) => {
          const isSpeaking = activeSpeakerUserIds.has(occupant.userId);
          return (
            <li key={occupant.userId} className="flex items-center gap-2 rounded-md px-2 py-1.5">
              <span
                aria-hidden
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-medium text-secondary-foreground transition-shadow",
                  isSpeaking && "ring-2 ring-success",
                )}
              >
                {initials(occupant.nickname)}
              </span>
              <span className="flex-1 truncate text-sm text-foreground">{occupant.nickname}</span>
              {occupant.isDeafened && <VolumeX className="size-4 shrink-0 text-muted-foreground" aria-label="Deafened" />}
              {!occupant.isDeafened && occupant.isMuted && (
                <MicOff className="size-4 shrink-0 text-muted-foreground" aria-label="Muted" />
              )}
              {occupant.isAway && (
                <>
                  <span aria-hidden="true">💤</span>
                  <span className="sr-only">Away</span>
                </>
              )}
              {occupant.nickname !== selfNickname && currentChannelId && (
                <OccupantActionsPopover
                  userId={occupant.userId}
                  nickname={occupant.nickname}
                  channelId={currentChannelId}
                />
              )}
            </li>
          );
        })}
      </ul>

      {pttMode && status === "connected" && (
        <div className="flex flex-col items-center gap-2 border-t border-border p-4">
          <PttButton disabled={isDeafened} />
          <p className="text-xs text-muted-foreground">Press and hold to talk</p>
        </div>
      )}

      {status === "connected" && (
        <div className="px-4 pt-3">
          <MicLevelMeter levelDb={micLevelDb} thresholdDb={noiseGateEnabled ? noiseGateThresholdDb : undefined} />
        </div>
      )}

      <div className="flex items-center justify-center gap-3 border-t border-border p-4">
        <Button
          type="button"
          variant={isMuted ? "secondary" : "outline"}
          size="icon"
          aria-label={isMuted ? "Unmute" : "Mute"}
          onClick={toggleMute}
        >
          {isMuted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
        </Button>
        <Button
          type="button"
          variant={isDeafened ? "secondary" : "outline"}
          size="icon"
          aria-label={isDeafened ? "Undeafen" : "Deafen"}
          onClick={toggleDeafen}
        >
          {isDeafened ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="icon"
          aria-label="Leave voice"
          onClick={leaveVoiceChannel}
        >
          <PhoneOff className="size-5" />
        </Button>
      </div>
    </div>
  );
}
