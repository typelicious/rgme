import { describe, it, expect } from "vitest";
import { parseGameProfile, safeParseGameProfile } from "../profile.js";
import { sampleProfile } from "./fixtures.js";

describe("GameProfile schema", () => {
  it("accepts a valid profile", () => {
    expect(parseGameProfile(sampleProfile()).title).toBe("Demo");
  });
  it("rejects wrong schema version", () => {
    expect(safeParseGameProfile({ ...sampleProfile(), schema: "rgme.game/v0.1" }).success).toBe(false);
  });
  it("rejects unsupported machine values", () => {
    const p = sampleProfile();
    expect(safeParseGameProfile({ ...p, machine: { ...p.machine, model: "A1200" } }).success).toBe(false);
    expect(safeParseGameProfile({ ...p, machine: { ...p.machine, chipset: "AGA" } }).success).toBe(false);
    expect(safeParseGameProfile({ ...p, machine: { ...p.machine, video: "SECAM" } }).success).toBe(false);
  });
  it("rejects bad sha256", () => {
    const p = sampleProfile();
    expect(safeParseGameProfile({ ...p, media: [{ ...p.media[0], sha256: "xyz" }] }).success).toBe(false);
  });
  it("rejects unknown top-level fields", () => {
    expect(safeParseGameProfile({ ...sampleProfile(), extra: 1 }).success).toBe(false);
  });
  it("requires bootMediaId to reference media", () => {
    expect(safeParseGameProfile(sampleProfile({ launch: { bootMediaId: "nope" } })).success).toBe(false);
  });
  it("requires at least one media entry", () => {
    expect(safeParseGameProfile(sampleProfile({ media: [] })).success).toBe(false);
  });
});
