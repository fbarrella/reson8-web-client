import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

import { useUiStore } from "@/stores/uiStore";
import { useConnectionStore } from "@/stores/connectionStore";
import { useHasPermission } from "@/stores/permissionsStore";
import { PermissionFlags } from "@/types/reson8-protocol";
import { cn } from "@/lib/utils";
import { AboutTab } from "@/features/settings/AboutTab";
import { ApplicationTab } from "@/features/settings/ApplicationTab";
import { VoiceShortcutsTab } from "@/features/settings/VoiceShortcutsTab";
import { AudioTab } from "@/features/settings/AudioTab";
import { RolesTab } from "@/features/admin/RolesTab";
import { EmojiApprovalTab } from "@/features/admin/EmojiApprovalTab";
import { ServerSettingsTab } from "@/features/admin/ServerSettingsTab";

const ALL_TABS = [
  { id: "roles", label: "Roles" },
  { id: "emojis", label: "Emojis" },
  { id: "server", label: "Server" },
  { id: "voice", label: "Voice & Shortcuts" },
  { id: "application", label: "Application" },
  { id: "audio", label: "Audio" },
  { id: "about", label: "About" },
] as const;

type TabId = (typeof ALL_TABS)[number]["id"];

export function SettingsSheet() {
  const open = useUiStore((s) => s.settingsOpen);
  const setOpen = useUiStore((s) => s.setSettingsOpen);
  const status = useConnectionStore((s) => s.status);
  const [activeTab, setActiveTab] = useState<TabId>("about");
  const panelRef = useRef<HTMLDivElement>(null);

  // Roles/Emojis/Server tabs never render for a non-admin account — not
  // just hidden content behind a visible tab (Phase 6 PRD acceptance
  // criteria: "a non-admin account never sees the Roles/Emojis/Server
  // settings tabs"). ADMIN bypasses every other check per hasPermission's
  // own contract, so a full admin sees all three regardless of which
  // specific flag each one checks.
  const canManageRoles = useHasPermission(PermissionFlags.MANAGE_ROLES);
  const canManageEmojis = useHasPermission(PermissionFlags.MANAGE_EMOJIS);
  // Both hooks must run unconditionally every render — `||` would
  // short-circuit and skip the second call once the first is true,
  // changing the hook count between renders (Rules of Hooks violation).
  const isAdmin = useHasPermission(PermissionFlags.ADMIN);
  const canBan = useHasPermission(PermissionFlags.BAN_USER);
  const canSeeServerTab = isAdmin || canBan;
  const TABS = ALL_TABS.filter((tab) => {
    if (tab.id === "roles") return canManageRoles;
    if (tab.id === "emojis") return canManageEmojis;
    if (tab.id === "server") return canSeeServerTab;
    return true;
  });

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
            {activeTab === "roles" && canManageRoles && <RolesTab />}
            {activeTab === "emojis" && canManageEmojis && <EmojiApprovalTab />}
            {activeTab === "server" &&
              canSeeServerTab &&
              (status === "connected" ? (
                <ServerSettingsTab />
              ) : (
                <p className="text-sm text-muted-foreground">Connect to a server to manage this.</p>
              ))}
            {activeTab === "voice" && <VoiceShortcutsTab />}
            {activeTab === "audio" && <AudioTab />}
          </div>
        </div>
      </div>
    </div>
  );
}
