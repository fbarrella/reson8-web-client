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
 * Shown on every entry into an NSFW text channel, from every entry path
 * (Improvements Round IR1) — deliberately re-prompts each time rather than
 * remembering a prior confirmation; the single gate lives in `ChatRoute`,
 * the route both the channel tree and the Chats tab navigate through.
 */
export function NsfwConfirmDialog({
  open,
  onOpenChange,
  channelName,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelName: string;
  onConfirm: () => void;
  onCancel?: () => void;
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
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button onClick={onConfirm}>Continue</Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
