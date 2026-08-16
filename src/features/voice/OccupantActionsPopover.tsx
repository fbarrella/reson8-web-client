import { MoreVertical, Volume2, VolumeX, UserX } from "lucide-react";

import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { useVoiceStore, readUserOverride } from "@/stores/voiceStore";
import { useHasPermission } from "@/stores/permissionsStore";
import { setUserVolume, setUserLocalMute } from "@/services/voiceConnectionService";
import { kickUser } from "@/services/adminService";
import { PermissionFlags } from "@/types/reson8-protocol";

/**
 * Touch replacement for the desktop's right-click-on-occupant menu (Phase 3
 * PRD P3.2) — kebab-triggered, containing a volume slider (0-200%) and a
 * Mute Locally toggle. Client-local only, never transmitted to the server.
 * "Kick from Channel" (Phase 6 PRD P6.4) is the action slot this component
 * was originally built to accept without restructuring.
 */
export function OccupantActionsPopover({
  userId,
  nickname,
  channelId,
}: {
  userId: string;
  nickname: string;
  channelId: string;
}) {
  const override = useVoiceStore((s) => s.userOverrides.get(userId)) ?? readUserOverride(userId);
  const canKick = useHasPermission(PermissionFlags.KICK_USER);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Actions for ${nickname}`}
          onClick={(e) => e.stopPropagation()}
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <MoreVertical className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent onClick={(e) => e.stopPropagation()}>
        <p className="mb-3 truncate text-sm font-medium text-foreground">{nickname}</p>

        <div className="mb-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Volume</span>
            <span className="text-xs text-muted-foreground">{override.volumePercent}%</span>
          </div>
          <Slider
            value={[override.volumePercent]}
            max={200}
            step={5}
            disabled={override.locallyMuted}
            onValueChange={([v]) => v !== undefined && setUserVolume(userId, v)}
          />
        </div>

        <Button
          type="button"
          variant={override.locallyMuted ? "secondary" : "outline"}
          size="sm"
          className="w-full"
          onClick={() => setUserLocalMute(userId, !override.locallyMuted)}
        >
          {override.locallyMuted ? (
            <>
              <VolumeX className="size-4" /> Unmute Locally
            </>
          ) : (
            <>
              <Volume2 className="size-4" /> Mute Locally
            </>
          )}
        </Button>

        {canKick && (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="mt-2 w-full"
            onClick={() => void kickUser(userId, channelId)}
          >
            <UserX className="size-4" /> Kick from Channel
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
