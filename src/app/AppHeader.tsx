import { Menu, Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LatencyIndicator } from "@/features/connection/LatencyIndicator";
import { useUiStore } from "@/stores/uiStore";

export function AppHeader() {
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);
  const setChannelDrawerOpen = useUiStore((s) => s.setChannelDrawerOpen);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-2">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="hidden md:inline-flex lg:hidden"
        aria-label="Open channels"
        onClick={() => setChannelDrawerOpen(true)}
      >
        <Menu className="size-5" />
      </Button>

      <h1 className="text-sm font-semibold text-foreground">Reson8</h1>

      <div className="flex items-center gap-3">
        <LatencyIndicator />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Open settings"
          onClick={() => setSettingsOpen(true)}
        >
          <Settings className="size-5" />
        </Button>
      </div>
    </header>
  );
}
