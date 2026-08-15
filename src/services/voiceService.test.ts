import { describe, expect, it, vi } from "vitest";

import { VoiceService, type VoiceSignaling } from "@/services/voiceService";

function fakeSignaling(): VoiceSignaling {
  return {
    getRouterCapabilities: vi.fn(),
    createWebRtcTransport: vi.fn(),
    connectTransport: vi.fn(),
    produce: vi.fn(),
    consume: vi.fn(),
    resumeConsumer: vi.fn(),
  };
}

function fakeProducer(initiallyPaused: boolean) {
  return {
    paused: initiallyPaused,
    pause() {
      this.paused = true;
    },
    resume() {
      this.paused = false;
    },
  };
}

/**
 * VoiceService.joinVoiceChannel() drives a full mediasoup handshake that
 * needs a real signaling server — out of scope for a unit test (Phase 2 PRD
 * explicitly requires a reachable reson8/mediasoup dev server for that).
 * These tests instead target the mute/deafen state machine directly by
 * injecting a fake producer via the private field, since that machine is
 * pure logic ported 1:1 from the desktop client's actual shipped behavior
 * and is exactly the part most likely to regress silently.
 */
describe("VoiceService mute/deafen state machine", () => {
  it("toggleMute pauses an unmuted producer and returns true", () => {
    const vs = new VoiceService(fakeSignaling());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- reaching into private state for a unit test
    (vs as any).producer = fakeProducer(false);
    expect(vs.toggleMute()).toBe(true);
    expect(vs.isMuted).toBe(true);
  });

  it("toggleMute resumes a muted producer and returns false", () => {
    const vs = new VoiceService(fakeSignaling());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- reaching into private state for a unit test
    (vs as any).producer = fakeProducer(true);
    expect(vs.toggleMute()).toBe(false);
    expect(vs.isMuted).toBe(false);
  });

  it("toggleMute is a no-op while deafened", () => {
    const vs = new VoiceService(fakeSignaling());
    const producer = fakeProducer(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- reaching into private state for a unit test
    (vs as any).producer = producer;
    vs.toggleDeafen(); // deafen (auto-mutes since not already muted)
    expect(producer.paused).toBe(true);
    const result = vs.toggleMute();
    expect(result).toBe(true); // reports current paused state, but did not toggle it
    expect(producer.paused).toBe(true);
  });

  it("setMuted(true/false) is a no-op while deafened", () => {
    const vs = new VoiceService(fakeSignaling());
    const producer = fakeProducer(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- reaching into private state for a unit test
    (vs as any).producer = producer;
    vs.toggleDeafen();
    vs.setMuted(false);
    expect(producer.paused).toBe(true); // still deafen-muted, setMuted ignored
  });

  it("deafening while unmuted auto-mutes and remembers it did so", () => {
    const vs = new VoiceService(fakeSignaling());
    const producer = fakeProducer(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- reaching into private state for a unit test
    (vs as any).producer = producer;
    const result = vs.toggleDeafen();
    expect(result).toEqual({ isMuted: true, isDeafened: true });
    expect(producer.paused).toBe(true);
  });

  it("deafening while already muted does not touch producer, and undeafen restores it muted", () => {
    const vs = new VoiceService(fakeSignaling());
    const producer = fakeProducer(true); // already muted before deafening
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- reaching into private state for a unit test
    (vs as any).producer = producer;
    const deafenResult = vs.toggleDeafen();
    expect(deafenResult).toEqual({ isMuted: true, isDeafened: true });

    const undeafenResult = vs.toggleDeafen();
    // Was already muted pre-deafen, so undeafen must NOT auto-unmute it.
    expect(undeafenResult).toEqual({ isMuted: true, isDeafened: false });
    expect(producer.paused).toBe(true);
  });

  it("undeafening restores an auto-muted producer back to unmuted", () => {
    const vs = new VoiceService(fakeSignaling());
    const producer = fakeProducer(false); // unmuted before deafening
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- reaching into private state for a unit test
    (vs as any).producer = producer;
    vs.toggleDeafen(); // auto-mutes
    const undeafenResult = vs.toggleDeafen();
    expect(undeafenResult).toEqual({ isMuted: false, isDeafened: false });
    expect(producer.paused).toBe(false);
  });

  it("mutes and unmutes attached audio elements when deafening/undeafening", () => {
    const vs = new VoiceService(fakeSignaling());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- reaching into private state for a unit test
    (vs as any).producer = fakeProducer(false);
    const audioEl = { muted: false } as HTMLAudioElement;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- reaching into private state for a unit test
    (vs as any).audioElements = new Map([["c1", audioEl]]);

    vs.toggleDeafen();
    expect(audioEl.muted).toBe(true);

    vs.toggleDeafen();
    expect(audioEl.muted).toBe(false);
  });

  it("toggleMute/setMuted with no producer yet (not joined) never throws", () => {
    const vs = new VoiceService(fakeSignaling());
    expect(() => vs.toggleMute()).not.toThrow();
    expect(() => {
      vs.setMuted(true);
    }).not.toThrow();
    expect(vs.isMuted).toBe(false);
  });
});
