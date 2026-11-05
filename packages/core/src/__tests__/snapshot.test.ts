import { describe, it, expect } from "vitest";
import { MockRuntimeAdapter } from "../mock-runtime.js";
import { sampleProfile } from "./fixtures.js";

describe("runtime snapshots", () => {
  it("round-trips through JSON and restores frame, inputs, media", async () => {
    const a = new MockRuntimeAdapter();
    await a.loadGame(sampleProfile());
    a.start(); a.tick(); a.tick(); a.pressInput("fire", true);
    const snap = JSON.parse(JSON.stringify(a.exportSnapshot()));
    expect(snap).toMatchObject({ version: 1, adapterId: "mock", profileId: "demo", frame: 2, inputs: ["fire"] });
    a.tick(); a.pressInput("fire", false);
    a.insertMedia({ id: "df1", kind: "adf", filename: "b.adf", sha256: "b".repeat(64) });
    a.importSnapshot(snap);
    expect(a.currentFrame).toBe(2);
    expect(a.activeInputs).toEqual(["fire"]);
    expect(a.currentMedia).toHaveLength(1);
    a.stop();
  });
  it("rejects wrong profile, version, adapter and unloaded state", async () => {
    const a = new MockRuntimeAdapter();
    expect(() => a.exportSnapshot()).toThrow();
    await a.loadGame(sampleProfile());
    const s = a.exportSnapshot();
    expect(() => a.importSnapshot({ ...s, profileId: "other" })).toThrow(/other/);
    expect(() => a.importSnapshot({ ...s, version: 2 as 1 })).toThrow(/version/);
    expect(() => a.importSnapshot({ ...s, adapterId: "puae" })).toThrow(/adapter/);
    a.stop();
    expect(() => a.importSnapshot(s)).toThrow();
  });
});
