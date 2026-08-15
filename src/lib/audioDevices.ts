export interface AudioDeviceOption {
  deviceId: string;
  label: string;
}

/**
 * Device *labels* come back empty until a permission grant has occurred at
 * least once for the origin (browser privacy behavior) — falls back to a
 * numbered placeholder rather than showing a blank entry (Phase 2 PRD P2.7).
 */
export async function enumerateAudioDevices(): Promise<{
  inputs: AudioDeviceOption[];
  outputs: AudioDeviceOption[];
}> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const inputs = devices
    .filter((d) => d.kind === "audioinput")
    .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Microphone ${i + 1}` }));
  const outputs = devices
    .filter((d) => d.kind === "audiooutput")
    .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Speaker ${i + 1}` }));
  return { inputs, outputs };
}

/** `setSinkId` is Chromium-only (no Safari/Firefox support as of writing). */
export function supportsOutputDeviceSelection(): boolean {
  return typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype;
}

/** Applies live to every currently-mounted `<audio>` element (Phase 2 PRD P2.7). */
export function applyOutputDeviceToLiveAudioElements(deviceId: string): void {
  if (!supportsOutputDeviceSelection()) return;
  document.querySelectorAll("audio").forEach((el) => {
    void el.setSinkId(deviceId).catch(() => {});
  });
}
