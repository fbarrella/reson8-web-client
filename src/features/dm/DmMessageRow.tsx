import { useState } from "react";
import { MoreVertical, Trash2, Check } from "lucide-react";

import { useConnectionStore } from "@/stores/connectionStore";
import { deleteDirectMessage, toggleReaction } from "@/services/dmService";
import { resolveMediaUrl } from "@/lib/serverUrl";
import { cn } from "@/lib/utils";
import { MessageContent } from "@/features/chat/MessageContent";
import { LinkPreviewCard } from "@/features/chat/LinkPreviewCard";
import { ReactionsRow } from "@/features/chat/ReactionsRow";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
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
import type { IDirectMessage } from "@/types/reson8-protocol";

function initials(nickname: string): string {
  return nickname.slice(0, 2).toUpperCase();
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/**
 * DMs are delete-only (the protocol has no EDIT_DIRECT_MESSAGE — confirmed
 * against the frozen contract, Phase 5 PRD P5.3) and carry a read-receipt
 * label instead of a pin affordance, otherwise mirrors MessageRow.
 */
export function DmMessageRow({ message, isLastOwn }: { message: IDirectMessage; isLastOwn: boolean }) {
  const selfUserId = useConnectionStore((s) => s.selfUserId);
  const nickname = useConnectionStore((s) => s.nickname);
  const serverUrl = useConnectionStore((s) => s.serverUrl);
  const isOwn = selfUserId !== null ? message.senderId === selfUserId : message.senderNickname === nickname;

  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <div
      id={`dm-${message.id}`}
      data-message-id={message.id}
      className="group flex gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-accent/40"
    >
      <span
        aria-hidden
        className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-medium text-secondary-foreground"
      >
        {initials(message.senderNickname)}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-foreground">{message.senderNickname}</span>
          <span className="text-xs text-muted-foreground">{formatTime(message.createdAt)}</span>
        </div>

        <MessageContent content={message.content} />
        {message.attachmentUrl && (
          <a href={resolveMediaUrl(message.attachmentUrl, serverUrl)} target="_blank" rel="noopener noreferrer">
            <img
              src={resolveMediaUrl(message.attachmentUrl, serverUrl)}
              alt="Attachment"
              className="mt-1.5 max-h-64 max-w-xs rounded-md border border-border object-contain"
            />
          </a>
        )}
        <LinkPreviewCard content={message.content} />

        <ReactionsRow reactions={message.reactions} onToggle={(token) => void toggleReaction(message.id, token)} />

        {isOwn && isLastOwn && (
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
            {message.readAt ? (
              <>
                <Check className="size-3" /> Read
              </>
            ) : (
              "Sent"
            )}
          </p>
        )}
      </div>

      {isOwn && (
        <div className={cn("shrink-0 opacity-70 group-hover:opacity-100", menuOpen && "opacity-100")}>
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Message actions"
                className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <MoreVertical className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirmingDelete(true)}>
                <Trash2 className="size-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this message?</AlertDialogTitle>
            <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button variant="destructive" onClick={() => void deleteDirectMessage(message.id)}>
                Delete
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
