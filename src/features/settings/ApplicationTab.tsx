import { useSettingsStore } from "@/stores/settingsStore";
import { useConnectionStore } from "@/stores/connectionStore";
import { useUiStore } from "@/stores/uiStore";
import { leaveServer } from "@/services/connectionService";
import { Button } from "@/components/ui/button";

export function ApplicationTab() {
  const muteAlerts = useSettingsStore((s) => s.muteAlerts);
  const setMuteAlerts = useSettingsStore((s) => s.setMuteAlerts);
  const status = useConnectionStore((s) => s.status);
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);

  const handleDisconnect = () => {
    leaveServer();
    setSettingsOpen(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <label className="flex min-h-11 items-center justify-between gap-4">
        <span className="text-sm font-medium text-foreground">Mute sound alerts</span>
        <input
          type="checkbox"
          className="size-5"
          checked={muteAlerts}
          onChange={(e) => setMuteAlerts(e.target.checked)}
        />
      </label>

      {status === "connected" && (
        <div className="border-t border-border pt-4">
          <Button type="button" variant="destructive" onClick={handleDisconnect}>
            Disconnect
          </Button>
        </div>
      )}
    </div>
  );
}
