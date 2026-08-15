import { create } from "zustand";

export type ConnectionStatus = "idle" | "connecting" | "connected" | "reconnecting" | "error";

interface ConnectionState {
  status: ConnectionStatus;
  serverId: string | null;
  nickname: string | null;
  instanceId: string | null;
  latencyMs: number | null;
  clockOffsetMs: number | null;
  error: string | null;

  setStatus: (status: ConnectionStatus) => void;
  setConnected: (serverId: string, nickname: string) => void;
  setError: (error: string) => void;
  setLatency: (latencyMs: number, clockOffsetMs: number) => void;
  setInstanceId: (instanceId: string) => void;
  reset: () => void;
}

const initialState = {
  status: "idle" as ConnectionStatus,
  serverId: null,
  nickname: null,
  instanceId: null,
  latencyMs: null,
  clockOffsetMs: null,
  error: null,
};

export const useConnectionStore = create<ConnectionState>((set) => ({
  ...initialState,

  setStatus: (status) => set((state) => ({ status, error: status === "error" ? state.error : null })),
  setConnected: (serverId, nickname) =>
    set({ status: "connected", serverId, nickname, error: null }),
  setError: (error) => set({ status: "error", error }),
  setLatency: (latencyMs, clockOffsetMs) => set({ latencyMs, clockOffsetMs }),
  setInstanceId: (instanceId) => set({ instanceId }),
  reset: () => set(initialState),
}));
