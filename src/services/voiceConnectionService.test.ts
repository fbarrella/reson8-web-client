import { beforeEach, describe, expect, it, vi } from "vitest";

const mockVoiceServiceInstance = {
  joinVoiceChannel: vi.fn().mockResolvedValue(undefined),
  cleanup: vi.fn(),
  setAudioInputDeviceId: vi.fn(),
  toggleMute: vi.fn(() => false),
  setMuted: vi.fn(),
  toggleDeafen: vi.fn(() => ({ isMuted: false, isDeafened: false })),
  setNoiseGateEnabled: vi.fn(),
  setNoiseGateThresholdDb: vi.fn(),
  setGlobalVoiceVolume: vi.fn(),
  setUserVolume: vi.fn(),
  setUserLocalMute: vi.fn(),
  setOverrideProvider: vi.fn(),
  isMuted: false,
  isDeafened: false,
  onConnectionLost: null as (() => void) | null,
  onError: null as ((message: string) => void) | null,
  onMicLevel: null as ((db: number) => void) | null,
};

vi.mock("@/services/voiceService", () => ({
  VoiceService: vi.fn().mockImplementation(function VoiceService() {
    return mockVoiceServiceInstance;
  }),
}));

vi.mock("@/services/socketService", () => ({
  socketService: {
    isConnected: vi.fn(() => true),
    joinChannel: vi.fn().mockResolvedValue({ success: true }),
    leaveChannel: vi.fn(),
    setVoiceState: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock("@/lib/soundAlert", () => ({
  soundAlert: { play: vi.fn() },
}));

vi.mock("@/stores/toastStore", () => ({
  toast: vi.fn(),
}));

import { useVoiceStore } from "@/stores/voiceStore";
import { toggleMute, toggleDeafen, pttPress, pttRelease, joinVoiceChannel } from "@/services/voiceConnectionService";

/**
 * These target voiceConnectionService's mode-aware branching layered on top
 * of VoiceService's own state machine (unit-tested separately in
 * voiceService.test.ts) — specifically the two behaviors flagged during
 * porting as real discrepancies from the desktop client's own PRD text vs.
 * its actual shipped code (Phase 2 PRD P2.5/P2.6):
 *   1. Clicking Mute while deafened auto-undeafens first, then applies a
 *      toggle on top — not a no-op.
 *   2. In PTT mode, the store's `isMuted` is a "locked" flag toggled only by
 *      the Mute button/shortcut, independent of live transmit state.
 */
describe("voiceConnectionService mode-aware mute/deafen branching", () => {
  beforeEach(async () => {
    useVoiceStore.getState().reset();
    useVoiceStore.setState({ pttMode: false, isMuted: false, isDeafened: false });
    mockVoiceServiceInstance.isDeafened = false;
    mockVoiceServiceInstance.isMuted = false;
    mockVoiceServiceInstance.toggleMute.mockReset().mockReturnValue(false);
    mockVoiceServiceInstance.toggleDeafen.mockReset().mockReturnValue({ isMuted: false, isDeafened: false });
    mockVoiceServiceInstance.setMuted.mockReset();
    // Establish an active voice session so the module-private `voiceService` is set.
    await joinVoiceChannel("voice-1");
  });

  it("clicking Mute while NOT deafened delegates to voiceService.toggleMute (VAD mode)", () => {
    mockVoiceServiceInstance.toggleMute.mockReturnValue(true);
    toggleMute();
    expect(mockVoiceServiceInstance.toggleMute).toHaveBeenCalledTimes(1);
    expect(useVoiceStore.getState().isMuted).toBe(true);
  });

  it("clicking Mute while deafened auto-undeafens and applies a toggle on top, not a no-op", () => {
    mockVoiceServiceInstance.isDeafened = true;
    mockVoiceServiceInstance.toggleDeafen.mockReturnValue({ isMuted: false, isDeafened: false });

    toggleMute();

    expect(mockVoiceServiceInstance.toggleDeafen).toHaveBeenCalledTimes(1);
    expect(mockVoiceServiceInstance.toggleMute).not.toHaveBeenCalled();
    expect(useVoiceStore.getState().isMuted).toBe(false);
    expect(useVoiceStore.getState().isDeafened).toBe(false);
  });

  it("toggleDeafen delegates straight to voiceService.toggleDeafen regardless of mode", () => {
    mockVoiceServiceInstance.toggleDeafen.mockReturnValue({ isMuted: true, isDeafened: true });
    toggleDeafen();
    expect(mockVoiceServiceInstance.toggleDeafen).toHaveBeenCalledTimes(1);
    expect(useVoiceStore.getState().isMuted).toBe(true);
    expect(useVoiceStore.getState().isDeafened).toBe(true);
  });

  it("in PTT mode, clicking Mute toggles the lock flag without calling voiceService.toggleMute", () => {
    useVoiceStore.setState({ pttMode: true, isMuted: false });
    toggleMute();
    expect(mockVoiceServiceInstance.toggleMute).not.toHaveBeenCalled();
    expect(mockVoiceServiceInstance.setMuted).toHaveBeenCalledWith(true);
    expect(useVoiceStore.getState().isMuted).toBe(true); // now locked
  });

  it("in PTT mode, unlocking (Mute click while locked) does not itself resume transmission", () => {
    useVoiceStore.setState({ pttMode: true, isMuted: true });
    toggleMute();
    // Unlocking should not force setMuted(false) — resting state stays transmit-blocked
    // until the next PTT press.
    expect(mockVoiceServiceInstance.setMuted).not.toHaveBeenCalled();
    expect(useVoiceStore.getState().isMuted).toBe(false); // unlocked
  });

  it("pttPress transmits only when in PTT mode, connected, unlocked, and not deafened", () => {
    useVoiceStore.setState({ pttMode: true, isMuted: false, isDeafened: false, status: "connected" });
    pttPress();
    expect(mockVoiceServiceInstance.setMuted).toHaveBeenCalledWith(false);
  });

  it("pttPress is a no-op while locked (isMuted true)", () => {
    useVoiceStore.setState({ pttMode: true, isMuted: true, isDeafened: false, status: "connected" });
    pttPress();
    expect(mockVoiceServiceInstance.setMuted).not.toHaveBeenCalled();
  });

  it("pttPress is a no-op outside PTT mode", () => {
    useVoiceStore.setState({ pttMode: false, isMuted: false, isDeafened: false, status: "connected" });
    pttPress();
    expect(mockVoiceServiceInstance.setMuted).not.toHaveBeenCalled();
  });

  it("pttRelease re-mutes (blocks transmission) when active", () => {
    useVoiceStore.setState({ pttMode: true, isMuted: false, isDeafened: false, status: "connected" });
    pttRelease();
    expect(mockVoiceServiceInstance.setMuted).toHaveBeenCalledWith(true);
  });
});

/**
 * The exact browser-permission-denial DOMException name is unreliable to
 * reproduce in this sandbox's headless Chromium (a live E2E pass produced
 * NotFoundError/NotSupportedError instead of NotAllowedError across
 * attempts — no real mic hardware and inconsistent permission-model
 * emulation, not a client bug — see MicPermissionDeniedPanel's UI rendering
 * verified separately by source read). This unit-tests the classification
 * logic directly instead: joinVoiceChannel's catch block must flag
 * `permissionDenied: true` only for the specific DOMException names a real
 * browser uses for a denied mic prompt, and false for any other failure
 * (Phase 2 PRD P2.3).
 */
describe("voiceConnectionService.joinVoiceChannel permission-denial classification", () => {
  beforeEach(() => {
    useVoiceStore.getState().reset();
    mockVoiceServiceInstance.joinVoiceChannel.mockReset();
  });

  it("flags permissionDenied for a NotAllowedError", async () => {
    mockVoiceServiceInstance.joinVoiceChannel.mockRejectedValue(
      new DOMException("Permission denied", "NotAllowedError"),
    );
    const result = await joinVoiceChannel("voice-1");
    expect(result.success).toBe(false);
    expect(result.permissionDenied).toBe(true);
    expect(useVoiceStore.getState().status).toBe("idle");
  });

  it("flags permissionDenied for the legacy PermissionDeniedError name", async () => {
    mockVoiceServiceInstance.joinVoiceChannel.mockRejectedValue(
      new DOMException("Permission denied", "PermissionDeniedError"),
    );
    const result = await joinVoiceChannel("voice-1");
    expect(result.permissionDenied).toBe(true);
  });

  it("does not flag permissionDenied for other getUserMedia failures (e.g. NotFoundError)", async () => {
    mockVoiceServiceInstance.joinVoiceChannel.mockRejectedValue(
      new DOMException("Requested device not found", "NotFoundError"),
    );
    const result = await joinVoiceChannel("voice-1");
    expect(result.permissionDenied).toBeFalsy();
    expect(result.success).toBe(false);
  });

  it("does not flag permissionDenied for a generic Error (e.g. WebRTC negotiation failure)", async () => {
    mockVoiceServiceInstance.joinVoiceChannel.mockRejectedValue(new Error("Failed to set remote description"));
    const result = await joinVoiceChannel("voice-1");
    expect(result.permissionDenied).toBeFalsy();
    expect(result.error).toBe("Failed to set remote description");
  });
});
