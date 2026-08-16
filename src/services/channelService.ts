import { socketService } from "@/services/socketService";
import { useConnectionStore } from "@/stores/connectionStore";
import { reportAckError } from "@/lib/ackError";
import type { ChannelType } from "@/types/reson8-protocol";

/**
 * Channel CRUD/reorder mutations (Phase 3 PRD P3.4/P3.5/P3.6). The
 * `channel_created`/`channel_deleted` sound cues fire from the CHANNEL_CREATED/
 * CHANNEL_DELETED broadcast handlers in connectionService, not from the local
 * ack here — every connected client (including the actor) should hear them
 * exactly once per event, matching the desktop's broadcast-driven convention
 * (same reasoning as the join/leave presence-diff sounds in Phase 2 P2.12).
 */

export async function createChannel(payload: {
  name: string;
  type: ChannelType;
  parentId?: string | null;
  isNsfw?: boolean;
}): Promise<boolean> {
  const serverId = useConnectionStore.getState().serverId;
  if (!serverId) return false;
  const res = await socketService.createChannel({ serverId, ...payload });
  if (!res.success) {
    reportAckError("Couldn't create channel", res.error);
    return false;
  }
  return true;
}

export async function renameChannel(channelId: string, name: string): Promise<boolean> {
  const res = await socketService.updateChannel({ channelId, name });
  if (!res.success) {
    reportAckError("Couldn't rename channel", res.error);
    return false;
  }
  return true;
}

export async function setChannelNsfw(channelId: string, isNsfw: boolean): Promise<boolean> {
  const res = await socketService.updateChannel({ channelId, isNsfw });
  if (!res.success) {
    reportAckError("Couldn't update channel", res.error);
    return false;
  }
  return true;
}

export async function deleteChannel(channelId: string): Promise<boolean> {
  const res = await socketService.deleteChannel(channelId);
  if (!res.success) {
    reportAckError("Couldn't delete channel", res.error);
    return false;
  }
  return true;
}

export async function reorderChannels(parentId: string | null, orderedChannelIds: string[]): Promise<boolean> {
  const res = await socketService.reorderChannels(parentId, orderedChannelIds);
  if (!res.success) {
    reportAckError("Couldn't reorder channels", res.error);
    return false;
  }
  return true;
}
