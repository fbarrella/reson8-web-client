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

  setTree: (tree: IChannelTreeNode[]) => void;
  updatePresence: (channelId: string, occupants: IUserPresence[]) => void;
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

  setTree: (tree) => set({ tree, nodesById: indexTree(tree) }),

  updatePresence: (channelId, occupants) => {
    const node = get().nodesById.get(channelId);
    if (!node) return;
    node.occupants = occupants;
    // Shallow-clone the tree root array so subscribers keyed on `tree` re-render.
    set({ tree: [...get().tree] });
  },

  reset: () => set({ tree: [], nodesById: new Map() }),
}));
