import { useState } from "react";
import { ChevronDown, ChevronRight, Hash, Volume2 } from "lucide-react";

import { useChannelTreeStore } from "@/stores/channelTreeStore";
import { ChannelType, type IChannelTreeNode } from "@/types/reson8-protocol";
import { toast } from "@/stores/toastStore";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

function initials(nickname: string): string {
  return nickname.slice(0, 2).toUpperCase();
}

function ChannelRow({ node, depth }: { node: IChannelTreeNode; depth: number }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const isVoice = node.type === ChannelType.VOICE;

  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        className={cn(
          "flex min-h-11 w-full items-center gap-2 rounded-md py-2 pr-2 text-sm",
          "hover:bg-accent hover:text-accent-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
        onClick={() => {
          if (hasChildren) setExpanded((e) => !e);
          else toast({ title: "Coming soon", description: `${isVoice ? "Voice" : "Chat"} lands in a later phase.` });
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            (e.currentTarget as HTMLElement).click();
          }
        }}
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

        {!isVoice && node.hasUnread && (
          <span
            aria-label="Unread messages"
            className="size-2 shrink-0 rounded-full bg-primary"
          />
        )}

        {isVoice && node.occupants.length > 0 && (
          <span className="shrink-0 text-xs text-muted-foreground">{node.occupants.length}</span>
        )}
      </div>

      {isVoice && node.occupants.length > 0 && (
        <ul className="flex flex-col gap-0.5" style={{ paddingLeft: `${depth * 16 + 32}px` }}>
          {node.occupants.map((occupant) => (
            <li key={occupant.userId} className="flex items-center gap-2 py-0.5 text-xs text-muted-foreground">
              <span
                aria-hidden
                className="flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-medium text-secondary-foreground"
              >
                {initials(occupant.nickname)}
              </span>
              <span className="truncate">{occupant.nickname}</span>
              {occupant.isDeafened && <span aria-label="Deafened">🔇</span>}
              {!occupant.isDeafened && occupant.isMuted && <span aria-label="Muted">🔈</span>}
              {occupant.isAway && <span aria-label="Away">💤</span>}
            </li>
          ))}
        </ul>
      )}

      {hasChildren && expanded && (
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

  return (
    <nav aria-label="Channels" className={cn("overflow-y-auto p-2", className)}>
      {tree.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">No channels yet.</p>
      ) : (
        <ul>
          {tree.map((node) => (
            <ChannelRow key={node.id} node={node} depth={0} />
          ))}
        </ul>
      )}
    </nav>
  );
}
