import { useEffect, useState } from "react";

import { useVoiceStore } from "@/stores/voiceStore";
import { useShortcutStore } from "@/stores/shortcutStore";
import { type ShortcutSlot, comboToDisplay } from "@/lib/keyboardShortcut";
import {
  enumerateAudioDevices,
  applyOutputDeviceToLiveAudioElements,
  supportsOutputDeviceSelection,
  type AudioDeviceOption,
} from "@/lib/audioDevices";
import { Button } from "@/components/ui/button";

const SHORTCUT_ROWS: { slot: ShortcutSlot; label: string }[] = [
  { slot: "ptt", label: "Push-to-talk" },
  { slot: "mute", label: "Mute" },
  { slot: "deafen", label: "Deafen" },
  { slot: "disconnect", label: "Disconnect" },
];

function ShortcutRow({ slot, label }: { slot: ShortcutSlot; label: string }) {
  const shortcut = useShortcutStore((s) => s.shortcuts[slot]);
  const recordingSlot = useShortcutStore((s) => s.recordingSlot);
  const setRecordingSlot = useShortcutStore((s) => s.setRecordingSlot);
  const setShortcut = useShortcutStore((s) => s.setShortcut);
  const clearShortcutSlot = useShortcutStore((s) => s.clearShortcutSlot);
  const [recordingKeys, setRecordingKeys] = useState<string[]>([]);
  const isRecording = recordingSlot === slot;

  useEffect(() => {
    if (!isRecording) return;
    const keys = new Set<string>();

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      keys.add(e.code);
      setRecordingKeys([...keys]);
    };
    const handleKeyUp = () => {
      if (keys.size === 0) return;
      setShortcut(slot, [...keys]);
      setRecordingSlot(null);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isRecording, slot, setShortcut, setRecordingSlot]);

  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <span className="text-sm text-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className="min-w-28 rounded-md border border-input px-2 py-1.5 text-center text-xs text-muted-foreground">
          {isRecording
            ? recordingKeys.length > 0
              ? comboToDisplay(recordingKeys)
              : "Press keys…"
            : (shortcut?.display ?? "Not set")}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setRecordingKeys([]);
            setRecordingSlot(slot);
          }}
          disabled={recordingSlot !== null}
        >
          Set
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => clearShortcutSlot(slot)}
          disabled={recordingSlot !== null || !shortcut}
        >
          Clear
        </Button>
      </div>
    </div>
  );
}

function DeviceSelectionSection() {
  const selectedInputDeviceId = useVoiceStore((s) => s.selectedInputDeviceId);
  const selectedOutputDeviceId = useVoiceStore((s) => s.selectedOutputDeviceId);
  const stagedInputDeviceId = useVoiceStore((s) => s.stagedInputDeviceId);
  const stagedOutputDeviceId = useVoiceStore((s) => s.stagedOutputDeviceId);
  const setStagedInputDeviceId = useVoiceStore((s) => s.setStagedInputDeviceId);
  const setStagedOutputDeviceId = useVoiceStore((s) => s.setStagedOutputDeviceId);
  const applyStagedDevices = useVoiceStore((s) => s.applyStagedDevices);

  const [inputs, setInputs] = useState<AudioDeviceOption[]>([]);
  const [outputs, setOutputs] = useState<AudioDeviceOption[]>([]);

  useEffect(() => {
    void enumerateAudioDevices().then((res) => {
      setInputs(res.inputs);
      setOutputs(res.outputs);
    });
  }, []);

  const hasPendingChange = stagedInputDeviceId !== null || stagedOutputDeviceId !== null;
  const effectiveInput = stagedInputDeviceId ?? selectedInputDeviceId ?? "";
  const effectiveOutput = stagedOutputDeviceId ?? selectedOutputDeviceId ?? "";

  const handleSave = () => {
    const outputToApply = stagedOutputDeviceId;
    applyStagedDevices();
    if (outputToApply) applyOutputDeviceToLiveAudioElements(outputToApply);
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="text-sm font-medium text-foreground" htmlFor="audio-input-select">
          Microphone
        </label>
        <select
          id="audio-input-select"
          className="mt-1.5 h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          value={effectiveInput}
          onChange={(e) => setStagedInputDeviceId(e.target.value || null)}
        >
          <option value="">System Default</option>
          {inputs.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-muted-foreground">Applies the next time you join voice.</p>
      </div>

      {supportsOutputDeviceSelection() ? (
        <div>
          <label className="text-sm font-medium text-foreground" htmlFor="audio-output-select">
            Speaker
          </label>
          <select
            id="audio-output-select"
            className="mt-1.5 h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            value={effectiveOutput}
            onChange={(e) => setStagedOutputDeviceId(e.target.value || null)}
          >
            <option value="">System Default</option>
            {outputs.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Speaker selection isn't supported by this browser — audio plays through your system's
          default output.
        </p>
      )}

      {hasPendingChange && (
        <Button type="button" size="sm" onClick={handleSave} className="self-start">
          Save
        </Button>
      )}
    </div>
  );
}

export function VoiceShortcutsTab() {
  const pttMode = useVoiceStore((s) => s.pttMode);
  const setPttMode = useVoiceStore((s) => s.setPttMode);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="mb-2 text-sm font-medium text-foreground">Mic input mode</h3>
        <div className="flex gap-2">
          <Button type="button" variant={pttMode ? "outline" : "default"} size="sm" onClick={() => setPttMode(false)}>
            Voice Activation
          </Button>
          <Button type="button" variant={pttMode ? "default" : "outline"} size="sm" onClick={() => setPttMode(true)}>
            Push-to-Talk
          </Button>
        </div>
      </div>

      <div>
        <h3 className="mb-1 text-sm font-medium text-foreground">Keyboard shortcuts</h3>
        <p className="mb-3 text-xs text-muted-foreground">
          Only work while this tab is focused — browsers have no API for a truly global,
          OS-level hotkey that fires while the tab is unfocused or backgrounded. On mobile, use
          the press-and-hold button in the voice panel instead.
        </p>
        <div className="divide-y divide-border">
          {SHORTCUT_ROWS.map(({ slot, label }) => (
            <ShortcutRow key={slot} slot={slot} label={label} />
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium text-foreground">Audio devices</h3>
        <DeviceSelectionSection />
      </div>
    </div>
  );
}
