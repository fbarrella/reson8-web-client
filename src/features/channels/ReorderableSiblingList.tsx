import { useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronUp, ChevronDown, GripVertical } from "lucide-react";

import { useChannelTreeStore } from "@/stores/channelTreeStore";
import { reorderChannels } from "@/services/channelService";
import type { IChannelTreeNode } from "@/types/reson8-protocol";
import { Button } from "@/components/ui/button";

/**
 * Explicit Reorder Mode (Phase 3 PRD P3.6): up/down buttons alone are always
 * sufficient — no drag required — with `dnd-kit`'s PointerSensor (unlike
 * native HTML5 `draggable`, it has first-class touch support) layered on as
 * a progressive enhancement for pointer/touch users who prefer it. Both
 * mechanisms only ever stage local order; the parent commits once via
 * REORDER_CHANNELS on "Done", atomically.
 */
export function ReorderableSiblingList({
  parentId,
  siblings,
  depth,
}: {
  parentId: string | null;
  siblings: IChannelTreeNode[];
  depth: number;
}) {
  const stagedOrder = useChannelTreeStore((s) => s.stagedOrder);
  const setStagedOrder = useChannelTreeStore((s) => s.setStagedOrder);
  const cancelReorder = useChannelTreeStore((s) => s.cancelReorder);
  const [saving, setSaving] = useState(false);
  const byId = new Map(siblings.map((s) => [s.id, s]));
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = stagedOrder.indexOf(String(active.id));
    const newIndex = stagedOrder.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    setStagedOrder(arrayMove(stagedOrder, oldIndex, newIndex));
  };

  const handleDone = async () => {
    setSaving(true);
    const success = await reorderChannels(parentId, stagedOrder);
    setSaving(false);
    if (success) cancelReorder();
  };

  return (
    <div
      style={{ marginLeft: `${depth * 16 + 8}px` }}
      className="my-1 rounded-md border border-dashed border-border p-2"
    >
      <p className="mb-2 px-1 text-xs font-medium text-muted-foreground">Reordering channels</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={stagedOrder} strategy={verticalListSortingStrategy}>
          <ul className="flex flex-col gap-1">
            {stagedOrder.map((id, index) => {
              const node = byId.get(id);
              if (!node) return null;
              return (
                <SortableReorderRow key={id} node={node} index={index} total={stagedOrder.length} />
              );
            })}
          </ul>
        </SortableContext>
      </DndContext>
      <div className="mt-2 flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={cancelReorder} disabled={saving}>
          Cancel
        </Button>
        <Button type="button" size="sm" onClick={() => void handleDone()} disabled={saving}>
          {saving ? "Saving…" : "Done"}
        </Button>
      </div>
    </div>
  );
}

function SortableReorderRow({
  node,
  index,
  total,
}: {
  node: IChannelTreeNode;
  index: number;
  total: number;
}) {
  const moveStaged = useChannelTreeStore((s) => s.moveStaged);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: node.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex min-h-11 items-center gap-1 rounded-md border border-border bg-card px-2 py-1.5"
    >
      <button
        type="button"
        aria-label={`Drag to reorder ${node.name}`}
        {...attributes}
        {...listeners}
        className="flex size-8 shrink-0 touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
      >
        <GripVertical className="size-4" />
      </button>
      <span className="flex-1 truncate text-sm text-foreground">{node.name}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Move ${node.name} up`}
        disabled={index === 0}
        onClick={() => moveStaged(node.id, "up")}
      >
        <ChevronUp className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Move ${node.name} down`}
        disabled={index === total - 1}
        onClick={() => moveStaged(node.id, "down")}
      >
        <ChevronDown className="size-4" />
      </Button>
    </li>
  );
}
