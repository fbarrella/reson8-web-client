import { useSettingsStore } from "@/stores/settingsStore";

export function ApplicationTab() {
  const muteAlerts = useSettingsStore((s) => s.muteAlerts);
  const setMuteAlerts = useSettingsStore((s) => s.setMuteAlerts);

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
    </div>
  );
}
