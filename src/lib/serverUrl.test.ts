import { describe, expect, it } from "vitest";
import { normalizeServerUrl } from "@/lib/serverUrl";

describe("normalizeServerUrl", () => {
  it("keeps an explicit wss:// scheme as-is", () => {
    expect(normalizeServerUrl("wss://voice.example.com:9800")).toBe(
      "wss://voice.example.com:9800",
    );
  });

  it("keeps an explicit https:// scheme as-is", () => {
    expect(normalizeServerUrl("https://voice.example.com")).toBe("https://voice.example.com");
  });

  it("defaults a bare remote host to wss://", () => {
    expect(normalizeServerUrl("voice.example.com:9800")).toBe("wss://voice.example.com:9800");
  });

  it("defaults localhost to ws://", () => {
    expect(normalizeServerUrl("localhost:9800")).toBe("ws://localhost:9800");
  });

  it("defaults 127.0.0.1 to ws://", () => {
    expect(normalizeServerUrl("127.0.0.1:9800")).toBe("ws://127.0.0.1:9800");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeServerUrl("  voice.example.com  ")).toBe("wss://voice.example.com");
  });
});
