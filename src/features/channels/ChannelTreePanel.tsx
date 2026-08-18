import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronRight, Hash, Volume2, Plus, ArrowUpDown } from "lucide-react";

import { useChannelTreeStore } from "@/stores/channelTreeStore";
import { useVoiceStore } from "@/stores/voiceStore";
import { useChatStore } from "@/stores/chatStore";
import { useHasPermission } from "@/stores/permissionsStore";
import { ChannelType, PermissionFlags, type IChannelTreeNode } from "@/types/reson8-protocol";
import { toast } from "@/stores/toastStore";
import { joinVoiceChannel } from "@/services/voiceConnectionService";
import { renameChannel } from "@/services/channelService";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChannelActionsMenu } from "@/features/channels/ChannelActionsMenu";
import { NsfwConfirmDialog } from "@/features/channels/NsfwConfirmDialog";
import { CreateChannelDialog } from "@/features/channels/CreateChannelDialog";
import { ReorderableSiblingList } from "@/features/channels/ReorderableSiblingList";

const LONG_PRESS_MS = 500;

function initials(nickname: string): string {
  return nickname.slice(0, 2).toUpperCase();
}

function ChannelRow({ node, depth }: { node: IChannelTreeNode; depth: number }) {
  const [expanded, setExpanded] = useState(true);
  const [joining, setJoining] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(node.name);
  const [menuOpen, setMenuOpen] = useState(false);
  const [nsfwConfirmOpen, setNsfwConfirmOpen] = useState(false);
  const hasChildren = node.children.length > 0;
  const isVoice = node.type === ChannelType.VOICE;
  const currentVoiceChannelId = useVoiceStore((s) => s.currentChannelId);
  const activeSpeakerUserIds = useVoiceStore((s) => s.activeSpeakerUserIds);
  const isCurrentVoiceChannel = isVoice && node.id === currentVoiceChannelId;
  const canManageChannels = useHasPermission(PermissionFlags.MANAGE_CHANNELS);
  const isNsfwConfirmed = useChannelTreeStore((s) => s.confirmedNsfwChannelIds.has(node.id));
  const confirmNsfw = useChannelTreeStore((s) => s.confirmNsfw);
  const reorderingParentId = useChannelTreeStore((s) => s.reorderingParentId);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const isUnread = useChatStore((s) => s.unreadChannelIds.has(node.id));

  useEffect(() => {
    if (renaming) renameInputRef.current?.focus();
  }, [renaming]);

  const proceedWithClick = () => {
    if (hasChildren) {
      setExpanded((e) => !e);
      return;
    }
    if (!isVoice) {
      navigate(`/app/channels/${node.id}`);
      return;
    }
    if (isCurrentVoiceChannel || joining) return;
    setJoining(true);
    void joinVoiceChannel(node.id).then((result) => {
      setJoining(false);
      if (!result.success) {
        toast({
          title: result.permissionDenied ? "Microphone access needed" : "Couldn't join voice",
          description:
            result.error ??
            (result.permissionDenied
              ? "Allow microphone access in your browser to join voice channels."
              : undefined),
          variant: "destructive",
        });
      }
    });
  };

  const handleClick = () => {
    if (longPressFired.current) {
      longPressFired.current = false;
      return;
    }
    // NSFW confirmation gates first entry to a text channel this session
    // (Phase 3 PRD P3.5) — only meaningful once Phase 4 renders real chat
    // content, but the gate is wired now so that surface can build behind it.
    if (!isVoice && !hasChildren && node.isNsfw && !isNsfwConfirmed) {
      setNsfwConfirmOpen(true);
      return;
    }
    proceedWithClick();
  };

  const startLongPress = () => {
    if (!canManageChannels || renaming) return;
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      setMenuOpen(true);
    }, LONG_PRESS_MS);
  };
  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const commitRename = () => {
    const trimmed = renameValue.trim();
    setRenaming(false);
    if (trimmed && trimmed !== node.name) void renameChannel(node.id, trimmed);
  };

  return (
    <li>
      <div
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        className="flex min-h-11 w-full items-center gap-2 rounded-md py-2 pr-2 text-sm"
        onPointerDown={renaming ? undefined : startLongPress}
        onPointerUp={cancelLongPress}
        onPointerLeave={cancelLongPress}
        onPointerCancel={cancelLongPress}
      >
        {renaming ? (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {hasChildren ? (
              expanded ? (
                <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              )
            ) : (
              <span className="w-4 shrink-0" />
            )}
            {isVoice ? (
              <Volume2 className="size-4 shrink-0 text-muted-foreground" />
            ) : (
              <Hash className="size-4 shrink-0 text-muted-foreground" />
            )}
            <input
              ref={renameInputRef}
              value={renameValue}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") {
                  setRenameValue(node.name);
                  setRenaming(false);
                }
              }}
              className="min-w-0 flex-1 rounded-md border border-input bg-transparent px-1.5 py-0.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        ) : (
          // A real <button>, not a nested div[role=button] — the kebab menu
          // below is a sibling, not a descendant, so screen readers never see
          // one interactive control nested inside another (axe: nested-interactive).
          <button
            type="button"
            aria-current={isCurrentVoiceChannel ? "true" : undefined}
            className={cn(
              "flex min-w-0 flex-1 items-center gap-2 rounded-md text-left",
              "hover:bg-accent hover:text-accent-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isCurrentVoiceChannel && "bg-accent/60 text-accent-foreground",
            )}
            onClick={handleClick}
          >
            {hasChildren ? (
              expanded ? (
                <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              )
            ) : (
              <span className="w-4 shrink-0" />
            )}

            {isVoice ? (
              <Volume2 className="size-4 shrink-0 text-muted-foreground" />
            ) : (
              <Hash className="size-4 shrink-0 text-muted-foreground" />
            )}

            <span className="flex-1 truncate">{node.name}</span>

            {node.isNsfw && (
              <Badge variant="destructive" className="shrink-0">
                18+
              </Badge>
            )}

            {!isVoice && !hasChildren && isUnread && (
              <>
                <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-primary" />
                <span className="sr-only">Unread messages</span>
              </>
            )}

            {joining && (
              <>
                <span aria-hidden="true" className="size-3 shrink-0 animate-pulse rounded-full bg-primary" />
                <span className="sr-only">Joining…</span>
              </>
            )}

            {isVoice && node.occupants.length > 0 && (
              <span className="shrink-0 text-xs text-muted-foreground">{node.occupants.length}</span>
            )}
          </button>
        )}

        {canManageChannels && !renaming && (
          <ChannelActionsMenu
            node={node}
            open={menuOpen}
            onOpenChange={setMenuOpen}
            onRename={() => {
              setRenameValue(node.name);
              setRenaming(true);
            }}
          />
        )}
      </div>

      <NsfwConfirmDialog
        open={nsfwConfirmOpen}
        onOpenChange={setNsfwConfirmOpen}
        channelName={node.name}
        onConfirm={() => {
          confirmNsfw(node.id);
          setNsfwConfirmOpen(false);
          proceedWithClick();
        }}
      />

      {isVoice && node.occupants.length > 0 && (
        <ul className="flex flex-col gap-0.5" style={{ paddingLeft: `${depth * 16 + 32}px` }}>
          {node.occupants.map((occupant) => {
            const isSpeaking = isCurrentVoiceChannel && activeSpeakerUserIds.has(occupant.userId);
            return (
            <li key={occupant.userId} className="flex items-center gap-2 py-0.5 text-xs text-muted-foreground">
              <span
                aria-hidden
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-medium text-secondary-foreground transition-shadow",
                  isSpeaking && "ring-2 ring-success",
                )}
              >
                {initials(occupant.nickname)}
              </span>
              <span className="truncate">{occupant.nickname}</span>
              {occupant.isDeafened && (
                <>
                  <span aria-hidden="true">🔇</span>
                  <span className="sr-only">Deafened</span>
                </>
              )}
              {!occupant.isDeafened && occupant.isMuted && (
                <>
                  <span aria-hidden="true">🔈</span>
                  <span className="sr-only">Muted</span>
                </>
              )}
              {occupant.isAway && (
                <>
                  <span aria-hidden="true">💤</span>
                  <span className="sr-only">Away</span>
                </>
              )}
            </li>
            );
          })}
        </ul>
      )}

      {hasChildren && expanded && reorderingParentId === node.id && (
        <ReorderableSiblingList parentId={node.id} siblings={node.children} depth={depth + 1} />
      )}

      {hasChildren && expanded && reorderingParentId !== node.id && (
        <ul>
          {node.children.map((child) => (
            <ChannelRow key={child.id} node={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function ChannelTreePanel({ className }: { className?: string }) {
  const tree = useChannelTreeStore((s) => s.tree);
  const reorderingParentId = useChannelTreeStore((s) => s.reorderingParentId);
  const startReorder = useChannelTreeStore((s) => s.startReorder);
  const canManageChannels = useHasPermission(PermissionFlags.MANAGE_CHANNELS);
  const canCreateChannel = useHasPermission(PermissionFlags.CREATE_CHANNEL) || canManageChannels;
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <nav aria-label="Channels" className={cn("flex flex-col overflow-y-auto p-2", className)}>
      {(canCreateChannel || canManageChannels) && (
        <div className="mb-1 flex items-center justify-end gap-1">
          {canManageChannels && tree.length > 1 && reorderingParentId === undefined && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => startReorder(null, tree.map((n) => n.id))}
            >
              <ArrowUpDown className="size-4" /> Reorder
            </Button>
          )}
          {canCreateChannel && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" /> New
            </Button>
          )}
        </div>
      )}

      {tree.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">No channels yet.</p>
      ) : reorderingParentId === null ? (
        <ReorderableSiblingList parentId={null} siblings={tree} depth={0} />
      ) : (
        <ul>
          {tree.map((node) => (
            <ChannelRow key={node.id} node={node} depth={0} />
          ))}
        </ul>
      )}

      <CreateChannelDialog open={createOpen} onOpenChange={setCreateOpen} />
    </nav>
  );
}
