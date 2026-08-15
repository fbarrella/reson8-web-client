import { useRef, useState } from "react";
import { Mic } from "lucide-react";

import { pttPress, pttRelease } from "@/services/voiceConnectionService";
import { cn } from "@/lib/utils";

/**
 * Large, thumb-reachable press-and-hold PTT control — the primary
 * interaction on touch (Phase 2 PRD P2.6). Uses Pointer Events (not
 * touchstart/touchend) so it also works correctly with a mouse on a
 * touchscreen laptop, and `touch-action: none` to prevent scroll
 * interference while held.
 */
export function PttButton({ disabled }: { disabled?: boolean }) {
  const [pressed, setPressed] = useState(false);
  const activePointerId = useRef<number | null>(null);

  const release = (pointerId: number) => {
    if (activePointerId.current !== pointerId) return;
    activePointerId.current = null;
    setPressed(false);
    pttRelease();
  };

  return (
    <button
      type="button"
      aria-label="Push to talk — press and hold"
      aria-pressed={pressed}
      disabled={disabled}
      style={{ touchAction: "none" }}
      className={cn(
        "flex size-20 shrink-0 items-center justify-center rounded-full border-2 transition-colors select-none",
        pressed ? "border-success bg-success/20 text-success" : "border-border bg-secondary text-foreground",
        disabled && "opacity-50",
      )}
      onPointerDown={(e) => {
        if (disabled) return;
        e.preventDefault();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        activePointerId.current = e.pointerId;
        setPressed(true);
        pttPress();
      }}
      onPointerUp={(e) => release(e.pointerId)}
      onPointerCancel={(e) => release(e.pointerId)}
    >
      <Mic className="size-8" />
    </button>
  );
}
