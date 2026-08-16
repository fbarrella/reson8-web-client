import { useSettingsStore } from "@/stores/settingsStore";
import { setGlobalVoiceVolume } from "@/services/voiceConnectionService";
import { Slider } from "@/components/ui/slider";

function VolumeRow({
  label,
  value,
  onChange,
  max = 100,
  step = 5,
  formatValue,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  max?: number;
  step?: number;
  formatValue?: (value: number) => string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">
          {formatValue ? formatValue(value) : `${Math.round(value)}%`}
        </span>
      </div>
      <Slider
        value={[value]}
        max={max}
        step={step}
        onValueChange={([v]) => v !== undefined && onChange(v)}
      />
    </div>
  );
}

/**
 * Global Voice Chat Volume applies live (no Save step), matching the desktop
 * client's own behavior for this specific slider (Phase 3 PRD P3.3) — unlike
 * device selection (Phase 2 P2.7), which stages changes.
 */
export function AudioTab() {
  const globalVoiceVolume = useSettingsStore((s) => s.globalVoiceVolume);
  const alertVolume = useSettingsStore((s) => s.alertVolume);
  const nudgeVolume = useSettingsStore((s) => s.nudgeVolume);
  const setAlertVolume = useSettingsStore((s) => s.setAlertVolume);
  const setNudgeVolume = useSettingsStore((s) => s.setNudgeVolume);

  return (
    <div className="flex flex-col gap-5">
      <VolumeRow label="Voice Chat Volume" value={globalVoiceVolume} onChange={setGlobalVoiceVolume} />
      <VolumeRow
        label="Alert Volume"
        value={Math.round(alertVolume * 100)}
        onChange={(v) => setAlertVolume(v / 100)}
      />
      <VolumeRow
        label="Nudge Volume"
        value={Math.round(nudgeVolume * 100)}
        onChange={(v) => setNudgeVolume(v / 100)}
      />
    </div>
  );
}
