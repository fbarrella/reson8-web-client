import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

/**
 * Shown once per NSFW text channel per session, before its content renders
 * (Phase 3 PRD P3.5) — `useChannelTreeStore.confirmedNsfwChannelIds` tracks
 * which channels have already been confirmed this session.
 */
export function NsfwConfirmDialog({
  open,
  onOpenChange,
  channelName,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelName: string;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle>"{channelName}" is marked NSFW</AlertDialogTitle>
          <AlertDialogDescription>
            This channel may contain content not suitable for all audiences. Continue?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button onClick={onConfirm}>Continue</Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
