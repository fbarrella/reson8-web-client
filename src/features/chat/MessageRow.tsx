import { useEffect, useRef, useState } from "react";
import { MoreVertical, Pencil, Trash2, Pin, PinOff } from "lucide-react";

import { useConnectionStore } from "@/stores/connectionStore";
import { useChatStore } from "@/stores/chatStore";
import { editMessage, deleteMessage, pinMessage, unpinMessage } from "@/services/chatService";
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
import type { IMessage } from "@/types/reson8-protocol";

const EDIT_WINDOW_MS = 2 * 60 * 1000;

function initials(nickname: string): string {
  return nickname.slice(0, 2).toUpperCase();
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function MessageRow({ message, isPinned }: { message: IMessage; isPinned: boolean }) {
  const selfUserId = useConnectionStore((s) => s.selfUserId);
  const nickname = useConnectionStore((s) => s.nickname);
  const serverUrl = useConnectionStore((s) => s.serverUrl);
  const isOwn = selfUserId !== null ? message.userId === selfUserId : message.nickname === nickname;

  const [menuOpen, setMenuOpen] = useState(false);
  // Computed at menu-open time (a user event), not during render — Date.now()
  // is impure and React's render body must stay pure. Client-side hiding is
  // UX only anyway; the server ack remains the real source of truth.
  const [withinEditWindow, setWithinEditWindow] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(message.content);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingPinReplace, setConfirmingPinReplace] = useState(false);
  const editInputRef = useRef<HTMLTextAreaElement>(null);
  const currentPinnedId = useChatStore((s) => s.channels.get(message.channelId)?.pinnedMessage?.id);
  const isHighlighted = useChatStore((s) => s.highlightedMessageId === message.id);

  useEffect(() => {
    if (editing) editInputRef.current?.focus();
  }, [editing]);

  const commitEdit = () => {
    const trimmed = editValue.trim();
    setEditing(false);
    if (trimmed && trimmed !== message.content) void editMessage(message.id, trimmed);
  };

  const handlePinToggle = () => {
    if (isPinned) {
      void unpinMessage(message.channelId);
    } else if (currentPinnedId) {
      setConfirmingPinReplace(true);
    } else {
      void pinMessage(message.channelId, message.id);
    }
  };

  return (
    <div
      id={`message-${message.id}`}
      data-message-id={message.id}
      className={cn(
        "group flex gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-accent/40",
        isHighlighted && "bg-warning/15 ring-1 ring-warning",
      )}
    >
      <span
        aria-hidden
        className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-medium text-secondary-foreground"
      >
        {initials(message.nickname)}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-foreground">{message.nickname}</span>
          <span className="text-xs text-muted-foreground">{formatTime(message.createdAt)}</span>
          {message.editedAt && <span className="text-xs text-muted-foreground">(edited)</span>}
          {isPinned && <Pin className="size-3 text-warning" aria-label="Pinned" />}
        </div>

        {editing ? (
          <div className="mt-1 flex flex-col gap-1.5">
            <textarea
              ref={editInputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  commitEdit();
                } else if (e.key === "Escape") {
                  setEditValue(message.content);
                  setEditing(false);
                }
              }}
              className="min-h-16 w-full rounded-md border border-input bg-transparent p-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={commitEdit}>
                Save
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditValue(message.content);
                  setEditing(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
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
          </>
        )}

        <ReactionsRow messageId={message.id} reactions={message.reactions} />
      </div>

      <div className={cn("shrink-0 opacity-70 group-hover:opacity-100", menuOpen && "opacity-100")}>
        <DropdownMenu
          open={menuOpen}
          onOpenChange={(open) => {
            setMenuOpen(open);
            if (open) setWithinEditWindow(Date.now() - new Date(message.createdAt).getTime() < EDIT_WINDOW_MS);
          }}
        >
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
            {isOwn && withinEditWindow && (
              <DropdownMenuItem onSelect={() => setEditing(true)}>
                <Pencil className="size-4" /> Edit
              </DropdownMenuItem>
            )}
            {/* Pin shown to everyone — the server enforces MANAGE_CHANNELS, not
                a client-side hide, matching the desktop's documented convention. */}
            <DropdownMenuItem onSelect={handlePinToggle}>
              {isPinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
              {isPinned ? "Unpin" : "Pin"}
            </DropdownMenuItem>
            {isOwn && (
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirmingDelete(true)}>
                <Trash2 className="size-4" /> Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this message?</AlertDialogTitle>
            <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button variant="destructive" onClick={() => void deleteMessage(message.id)}>
                Delete
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmingPinReplace} onOpenChange={setConfirmingPinReplace}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace the current pin?</AlertDialogTitle>
            <AlertDialogDescription>
              This channel already has a pinned message. Pinning this one will replace it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button onClick={() => void pinMessage(message.channelId, message.id)}>Replace</Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
