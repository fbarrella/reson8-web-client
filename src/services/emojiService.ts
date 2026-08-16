import { socketService } from "@/services/socketService";
import { useConnectionStore } from "@/stores/connectionStore";
import { useCustomEmojiStore } from "@/stores/customEmojiStore";
import { uploadEmojiImage } from "@/services/uploadService";
import { reportAckError } from "@/lib/ackError";

/** Submits a pre-cropped 128x128 emoji image (Phase 4 PRD P4.9). */
export async function submitCustomEmoji(name: string, blob: Blob): Promise<boolean> {
  const { serverUrl, serverId, nickname } = useConnectionStore.getState();
  if (!serverUrl) return false;

  try {
    const uploadResult = await uploadEmojiImage(serverUrl, blob, `${name}.png`);
    const res = await socketService.createCustomEmoji(name, uploadResult.url, uploadResult.publicId);
    if (!res.success) {
      reportAckError("Couldn't submit emoji", res.error);
      return false;
    }

    // Optimistic local PENDING entry — the CREATE_CUSTOM_EMOJI ack doesn't
    // echo back the full record, but the submitter already has everything
    // needed to show it grayed-out in their own picker immediately (P4.9),
    // without waiting on a server round trip for data we already have.
    useCustomEmojiStore.getState().upsert({
      id: res.emojiId ?? uploadResult.publicId ?? name,
      serverId: serverId ?? "",
      name,
      imageUrl: uploadResult.url,
      uploadedBy: "self",
      uploadedByNickname: nickname ?? undefined,
      status: "PENDING",
      createdAt: new Date().toISOString(),
    });
    return true;
  } catch (err) {
    reportAckError("Emoji upload failed", err instanceof Error ? err.message : undefined);
    return false;
  }
}
