import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

import { useUiStore } from "@/stores/uiStore";
import { useConnectionStore } from "@/stores/connectionStore";
import { cn } from "@/lib/utils";
import { AboutTab } from "@/features/settings/AboutTab";
import { ApplicationTab } from "@/features/settings/ApplicationTab";
import { VoiceShortcutsTab } from "@/features/settings/VoiceShortcutsTab";
import { AudioTab } from "@/features/settings/AudioTab";

/**
 * Roles/Emojis/Server tabs are gated on cached connect-time permission flags
 * (Phase 1 PRD P1.10) — Phase 1 has no permission cache yet, so they render
 * for everyone as "coming soon" rather than being hidden, avoiding a false
 * "this feature doesn't exist" impression before Phase 3/6 land it.
 */
const TABS = [
  { id: "roles", label: "Roles" },
  { id: "emojis", label: "Emojis" },
  { id: "server", label: "Server" },
  { id: "voice", label: "Voice & Shortcuts" },
  { id: "application", label: "Application" },
  { id: "audio", label: "Audio" },
  { id: "about", label: "About" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function SettingsSheet() {
  const open = useUiStore((s) => s.settingsOpen);
  const setOpen = useUiStore((s) => s.setSettingsOpen);
  const status = useConnectionStore((s) => s.status);
  const [activeTab, setActiveTab] = useState<TabId>("about");
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end lg:items-center lg:justify-center">
      <button
        type="button"
        aria-label="Close settings"
        className="absolute inset-0 bg-black/50"
        onClick={() => setOpen(false)}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        className="relative z-10 flex h-full w-full flex-col bg-card outline-none lg:h-[32rem] lg:w-[40rem] lg:rounded-lg lg:border lg:border-border"
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <h2 className="text-base font-semibold text-card-foreground">Settings</h2>
          <button
            type="button"
            aria-label="Close settings"
            onClick={() => setOpen(false)}
            className="flex size-11 items-center justify-center text-muted-foreground hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div
            role="tablist"
            aria-label="Settings sections"
            className="flex shrink-0 gap-1 overflow-x-auto border-b border-border p-2 lg:w-44 lg:flex-col lg:overflow-visible lg:border-r lg:border-b-0"
          >
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "min-h-11 shrink-0 rounded-md px-3 py-2 text-left text-sm whitespace-nowrap",
                  activeTab === tab.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div role="tabpanel" className="min-h-0 flex-1 overflow-y-auto p-4">
            {activeTab === "about" && <AboutTab />}
            {activeTab === "application" && <ApplicationTab />}
            {activeTab === "roles" && <ComingSoon />}
            {activeTab === "emojis" && <ComingSoon />}
            {activeTab === "server" && <ComingSoon disabled={status !== "connected"} />}
            {activeTab === "voice" && <VoiceShortcutsTab />}
            {activeTab === "audio" && <AudioTab />}
          </div>
        </div>
      </div>
    </div>
  );
}

function ComingSoon({ disabled }: { disabled?: boolean } = {}) {
  return (
    <p className="text-sm text-muted-foreground">
      {disabled ? "Connect to a server to manage this." : "Coming in a later phase."}
    </p>
  );
}
