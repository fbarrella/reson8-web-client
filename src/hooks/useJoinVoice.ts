import { useState } from "react";

import { joinVoiceChannel } from "@/services/voiceConnectionService";
import { toast } from "@/stores/toastStore";

interface JoinVoiceState {
  joining: boolean;
  permissionDenied: boolean;
  error: string | null;
}

/** Shared join-voice UX state (Phase 2 PRD P2.3) — used by both the channel
 *  tree's tap-to-join rows and the voice panel's own join/retry affordance. */
export function useJoinVoice(): JoinVoiceState & { join: (channelId: string) => void } {
  const [state, setState] = useState<JoinVoiceState>({
    joining: false,
    permissionDenied: false,
    error: null,
  });

  const join = (channelId: string) => {
    setState({ joining: true, permissionDenied: false, error: null });
    void joinVoiceChannel(channelId).then((result) => {
      if (result.success) {
        setState({ joining: false, permissionDenied: false, error: null });
        return;
      }
      setState({
        joining: false,
        permissionDenied: !!result.permissionDenied,
        error: result.error ?? "Couldn't join voice.",
      });
      if (!result.permissionDenied) {
        toast({ title: "Couldn't join voice", description: result.error, variant: "destructive" });
      }
    });
  };

  return { ...state, join };
}
