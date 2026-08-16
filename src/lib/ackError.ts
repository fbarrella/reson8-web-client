import { toast } from "@/stores/toastStore";
import { soundAlert } from "@/lib/soundAlert";

/**
 * Same regex-based permission-denied detection connectionService's ERROR
 * listener already uses (Phase 1 PRD P1.5) — reused here for direct ack
 * rejections (CREATE_CHANNEL, DELETE_CHANNEL, etc.), which don't route
 * through the broadcast ERROR event at all (Phase 3 PRD P3.4).
 */
export function isPermissionDeniedMessage(message: string): boolean {
  return /permission/i.test(message);
}

/** Surfaces a failed ack as a toast, with the insufficient_perms sound cue
 *  when the server's error reads as a permission denial. */
export function reportAckError(title: string, message: string | undefined): void {
  const description = message ?? "Something went wrong.";
  toast({ title, description, variant: "destructive" });
  if (message && isPermissionDeniedMessage(message)) {
    soundAlert.play("insufficient_perms");
  }
}
