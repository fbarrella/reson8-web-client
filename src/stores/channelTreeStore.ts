import { create } from "zustand";
import type { IChannelTreeNode, IUserPresence } from "@/types/reson8-protocol";

/**
 * Presence lives embedded on each IChannelTreeNode.occupants (per Phase 1 PRD
 * P1.8 — folding it into this store instead of a separate presenceStore,
 * since PRESENCE_UPDATE targets a single channel's occupant list and the
 * tree node is already the natural owner of that data).
 */
interface ChannelTreeState {
  tree: IChannelTreeNode[];
  nodesById: Map<string, IChannelTreeNode>;

  /**
   * Reorder Mode staging (Phase 3 PRD P3.6) — ephemeral, not persisted.
   * `reorderingParentId` is `undefined` when Reorder Mode is off; `null`
   * means "reordering the root-level siblings"; a channel id means
   * "reordering that category's children".
   */
  reorderingParentId: string | null | undefined;
  stagedOrder: string[];

  setTree: (tree: IChannelTreeNode[]) => void;
  updatePresence: (channelId: string, occupants: IUserPresence[]) => void;
  startReorder: (parentId: string | null, currentOrder: string[]) => void;
  moveStaged: (channelId: string, direction: "up" | "down") => void;
  setStagedOrder: (order: string[]) => void;
  cancelReorder: () => void;
  reset: () => void;
}

function indexTree(tree: IChannelTreeNode[]): Map<string, IChannelTreeNode> {
  const map = new Map<string, IChannelTreeNode>();
  const visit = (nodes: IChannelTreeNode[]) => {
    for (const node of nodes) {
      map.set(node.id, node);
      if (node.children.length > 0) visit(node.children);
    }
  };
  visit(tree);
  return map;
}

export const useChannelTreeStore = create<ChannelTreeState>((set, get) => ({
  tree: [],
  nodesById: new Map(),
  reorderingParentId: undefined,
  stagedOrder: [],

  setTree: (tree) => set({ tree, nodesById: indexTree(tree) }),

  updatePresence: (channelId, occupants) => {
    const node = get().nodesById.get(channelId);
    if (!node) return;
    node.occupants = occupants;
    // Shallow-clone the tree root array so subscribers keyed on `tree` re-render.
    set({ tree: [...get().tree] });
  },

  startReorder: (parentId, currentOrder) => set({ reorderingParentId: parentId, stagedOrder: currentOrder }),

  moveStaged: (channelId, direction) => {
    const order = [...get().stagedOrder];
    const index = order.indexOf(channelId);
    const swapWith = direction === "up" ? index - 1 : index + 1;
    if (index === -1 || swapWith < 0 || swapWith >= order.length) return;
    const a = order[index];
    const b = order[swapWith];
    if (a === undefined || b === undefined) return;
    order[index] = b;
    order[swapWith] = a;
    set({ stagedOrder: order });
  },

  setStagedOrder: (stagedOrder) => set({ stagedOrder }),

  cancelReorder: () => set({ reorderingParentId: undefined, stagedOrder: [] }),

  reset: () =>
    set({
      tree: [],
      nodesById: new Map(),
      reorderingParentId: undefined,
      stagedOrder: [],
    }),
}));
