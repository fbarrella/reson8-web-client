import { beforeEach, describe, expect, it } from "vitest";
import { getOrCreateInstanceId } from "@/lib/instanceId";

describe("getOrCreateInstanceId", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("creates and persists an instance id on first call", () => {
    const id = getOrCreateInstanceId();
    expect(id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(localStorage.getItem("reson8-instance-id")).toBe(id);
  });

  it("returns the same id on subsequent calls", () => {
    const first = getOrCreateInstanceId();
    const second = getOrCreateInstanceId();
    expect(second).toBe(first);
  });
});
