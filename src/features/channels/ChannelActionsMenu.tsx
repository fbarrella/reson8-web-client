import { useState } from "react";
import { MoreVertical, Pencil, Trash2, ShieldAlert, ArrowUpDown } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { useChannelTreeStore } from "@/stores/channelTreeStore";
import { deleteChannel, setChannelNsfw } from "@/services/channelService";
import { ChannelType, type IChannelTreeNode } from "@/types/reson8-protocol";

/**
 * Always-visible kebab menu — the discoverable, mouse-accessible equivalent
 * to long-press (master PRD §5.1's touch-replacement pattern; ChannelRow
 * wires a long-press handler that opens this same menu). MANAGE_CHANNELS-
 * gated at the call site, not here.
 */
export function ChannelActionsMenu({
  node,
  open,
  onOpenChange,
  onRename,
}: {
  node: IChannelTreeNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRename: () => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const startReorder = useChannelTreeStore((s) => s.startReorder);
  const hasChildren = node.children.length > 0;

  const handleDelete = async () => {
    setDeleting(true);
    await deleteChannel(node.id);
    setDeleting(false);
  };

  return (
    <>
      {/* modal=false: this is a small kebab menu, not a page-blocking dialog —
          Radix's default modal behavior aria-hides the rest of the app
          (including the only <main>/<h1>) while it's open, which is both
          unnecessary here and a real axe violation (aria-hidden-focus,
          landmark-one-main, page-has-heading-one) since the hidden siblings
          stay focusable. */}
      <DropdownMenu open={open} onOpenChange={onOpenChange} modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Actions for ${node.name}`}
            onClick={(e) => e.stopPropagation()}
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <MoreVertical className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onSelect={onRename}>
            <Pencil className="size-4" /> Rename
          </DropdownMenuItem>
          {node.type === ChannelType.TEXT && (
            <DropdownMenuItem onSelect={() => void setChannelNsfw(node.id, !node.isNsfw)}>
              <ShieldAlert className="size-4" /> {node.isNsfw ? "Remove NSFW" : "Mark NSFW"}
            </DropdownMenuItem>
          )}
          {hasChildren && (
            <DropdownMenuItem
              onSelect={() =>
                startReorder(
                  node.id,
                  node.children.map((c) => c.id),
                )
              }
            >
              <ArrowUpDown className="size-4" /> Reorder Channels
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmingDelete(true)}>
            <Trash2 className="size-4" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{node.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the channel{hasChildren ? " and everything inside it" : ""}. This
              can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button variant="destructive" disabled={deleting} onClick={() => void handleDelete()}>
                Delete
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
