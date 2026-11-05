import { describe, it, expect, vi } from "vitest";
import { MockRuntimeAdapter, PAL_HZ, type CanvasLike } from "../mock-runtime.js";
import { sampleProfile } from "./fixtures.js";

function fakeCanvas() {
  const calls: string[] = [];
  const ctx = { fillStyle: "", fillRect: (...a: number[]) => void calls.push(a.join(",")) };
  const canvas: CanvasLike = { width: 0, height: 0, getContext: () => ctx };
  return { canvas, calls };
}

describe("MockRuntimeAdapter", () => {
  it("walks UNLOADED -> LOADED -> RUNNING -> PAUSED -> STOPPED", async () => {
    const a = new MockRuntimeAdapter();
    expect(a.state).toBe("UNLOADED");
    await a.loadGame(sampleProfile());
    expect(a.state).toBe("LOADED");
    a.start();
    expect(a.state).toBe("RUNNING");
    a.pause();
    expect(a.state).toBe("PAUSED");
    a.start();
    expect(a.state).toBe("RUNNING");
    a.stop();
    expect(a.state).toBe("STOPPED");
  });
  it("rejects illegal transitions", () => {
    const a = new MockRuntimeAdapter();
    expect(() => a.start()).toThrow();
    expect(() => a.pause()).toThrow();
    expect(() => a.reset()).toThrow();
    expect(() => a.saveState(0)).toThrow();
  });
  it("renders a 320x256 PAL pattern and advances frames", async () => {
    const { canvas, calls } = fakeCanvas();
    const a = new MockRuntimeAdapter(canvas);
    expect(canvas.width).toBe(320);
    expect(canvas.height).toBe(256);
    await a.loadGame(sampleProfile());
    a.start();
    const before = calls.length;
    a.tick();
    a.tick();
    expect(a.currentFrame).toBe(2);
    expect(calls.length).toBeGreaterThan(before);
    a.pause();
    a.tick();
    expect(a.currentFrame).toBe(2);
    a.stop();
  });
  it("runs at 50Hz", async () => {
    vi.useFakeTimers();
    const a = new MockRuntimeAdapter();
    await a.loadGame(sampleProfile());
    a.start();
    vi.advanceTimersByTime(1000);
    expect(a.currentFrame).toBe(PAL_HZ);
    a.stop();
    vi.useRealTimers();
  });
  it("saves and restores state slots with timestamps", async () => {
    let t = 1000;
    const a = new MockRuntimeAdapter(undefined, () => t);
    await a.loadGame(sampleProfile());
    a.start();
    a.tick(); a.tick(); a.tick();
    const meta = a.saveState(1);
    expect(meta).toMatchObject({ slot: 1, frame: 3, savedAt: 1000, profileId: "demo" });
    a.tick();
    t = 2000;
    expect(a.loadState(1).frame).toBe(3);
    expect(a.currentFrame).toBe(3);
    expect(a.listSaveStates()).toHaveLength(1);
    expect(() => a.loadState(2)).toThrow(/empty/);
    expect(() => a.saveState(10)).toThrow(RangeError);
    a.stop();
  });
  it("reset returns to frame 0", async () => {
    const a = new MockRuntimeAdapter();
    await a.loadGame(sampleProfile());
    a.start(); a.tick(); a.tick();
    a.reset();
    expect(a.currentFrame).toBe(0);
    expect(a.state).toBe("RUNNING");
    a.stop();
  });
  it("tracks input, media, display and status events", async () => {
    const a = new MockRuntimeAdapter();
    const seen: string[] = [];
    const off = a.onStatus((s) => seen.push(s.state));
    await a.loadGame(sampleProfile());
    a.pressInput("fire", true);
    expect(a.activeInputs).toEqual(["fire"]);
    a.pressInput("fire", false);
    expect(a.activeInputs).toEqual([]);
    a.insertMedia({ id: "df1", kind: "adf", filename: "b.adf", sha256: "b".repeat(64) });
    expect(a.currentMedia).toHaveLength(2);
    a.setDisplayProfile({ id: "crt", aspect: "4:3", scaling: "integer", crt: true, aspectAltered: false });
    expect(a.currentDisplay?.crt).toBe(true);
    expect(a.identifyCapabilities().frameRateHz).toBe(50);
    off();
    expect(seen).toContain("LOADED");
  });
});
