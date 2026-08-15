import { create } from "zustand";

export type ToastVariant = "default" | "destructive" | "success";

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastState {
  toasts: ToastItem[];
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

const DEFAULT_DURATION_MS = 5000;

/**
 * Generic toast helper used by every phase (Phase 1 PRD P1.12). Presentation
 * (the <Toaster> component rendering these, ARIA role=status/alert via
 * Radix Toast) lives in components/ui/toaster.tsx.
 */
export function toast(params: { title: string; description?: string; variant?: ToastVariant }): void {
  const id = crypto.randomUUID();
  useToastStore.setState((state) => ({
    toasts: [...state.toasts, { id, variant: "default", ...params }],
  }));
  setTimeout(() => useToastStore.getState().dismiss(id), DEFAULT_DURATION_MS);
}
