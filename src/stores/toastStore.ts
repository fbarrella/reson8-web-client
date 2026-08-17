import { create } from "zustand";

export type ToastVariant = "default" | "destructive" | "success";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  action?: ToastAction;
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
 *
 * `persistent: true` skips the auto-dismiss timer — for a toast whose only
 * dismissal should be a deliberate user action (e.g. the P7.2 service-worker
 * update prompt, which must not vanish on its own and silently drop an
 * available update).
 */
export function toast(params: {
  title: string;
  description?: string;
  variant?: ToastVariant;
  action?: ToastAction;
  persistent?: boolean;
}): string {
  const id = crypto.randomUUID();
  const { persistent, ...item } = params;
  useToastStore.setState((state) => ({
    toasts: [...state.toasts, { id, variant: "default", ...item }],
  }));
  if (!persistent) {
    setTimeout(() => useToastStore.getState().dismiss(id), DEFAULT_DURATION_MS);
  }
  return id;
}
