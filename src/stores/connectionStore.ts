import { create } from "zustand";

export type ConnectionStatus = "idle" | "connecting" | "connected" | "reconnecting" | "error";

interface ConnectionState {
  status: ConnectionStatus;
  serverId: string | null;
  serverUrl: string | null;
  nickname: string | null;
  /** The connected user's own server-assigned userId. The protocol has no
   *  direct "here's who you are" event, so this resolves opportunistically —
   *  either from GET_ALL_USERS's nickname self-match (permissionsService) or
   *  from the first MESSAGE_RECEIVED broadcast carrying our own nickname
   *  (connectionService) — whichever happens first. Null until then; several
   *  "is this me" UI checks (own-message styling, reaction-active state)
   *  fall back to a nickname comparison in the meantime. */
  selfUserId: string | null;
  instanceId: string | null;
  latencyMs: number | null;
  clockOffsetMs: number | null;
  error: string | null;

  setStatus: (status: ConnectionStatus) => void;
  setConnected: (serverId: string, nickname: string, serverUrl: string) => void;
  setError: (error: string) => void;
  setLatency: (latencyMs: number, clockOffsetMs: number) => void;
  setInstanceId: (instanceId: string) => void;
  setSelfUserId: (userId: string) => void;
  reset: () => void;
}

const initialState = {
  status: "idle" as ConnectionStatus,
  serverId: null,
  serverUrl: null,
  nickname: null,
  selfUserId: null,
  instanceId: null,
  latencyMs: null,
  clockOffsetMs: null,
  error: null,
};

export const useConnectionStore = create<ConnectionState>((set) => ({
  ...initialState,

  setStatus: (status) => set((state) => ({ status, error: status === "error" ? state.error : null })),
  setConnected: (serverId, nickname, serverUrl) =>
    set({ status: "connected", serverId, nickname, serverUrl, error: null }),
  setError: (error) => set({ status: "error", error }),
  setLatency: (latencyMs, clockOffsetMs) => set({ latencyMs, clockOffsetMs }),
  setInstanceId: (instanceId) => set({ instanceId }),
  setSelfUserId: (selfUserId) => set({ selfUserId }),
  reset: () => set(initialState),
}));
