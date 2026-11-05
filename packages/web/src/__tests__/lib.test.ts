import { describe, it, expect } from "vitest";
import { sha256Hex, hashFile } from "../lib/hash";
import { computeIntegerScale } from "../lib/scale";
import { buildProfileFromFile } from "../lib/profile";

const ABC = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

describe("hash", () => {
  it("sha256 of 'abc'", async () => {
    expect(await sha256Hex(new TextEncoder().encode("abc"))).toBe(ABC);
  });
  it("hashes a File", async () => {
    expect(await hashFile(new File(["abc"], "x.adf"))).toBe(ABC);
  });
});

describe("scale", () => {
  it("uses integer multipliers keeping 4:3", () => {
    expect(computeIntegerScale(960, 720)).toEqual({ scale: 3, width: 960, height: 720 });
    expect(computeIntegerScale(1000, 720)).toMatchObject({ scale: 3 });
    expect(computeIntegerScale(960, 500)).toMatchObject({ scale: 2, width: 640, height: 480 });
  });
  it("never goes below 1x", () => {
    expect(computeIntegerScale(100, 50).scale).toBe(1);
    expect(computeIntegerScale(NaN, NaN).scale).toBe(1);
  });
});

describe("profile builder", () => {
  it("builds a valid A500/OCS/PAL profile", () => {
    const p = buildProfileFromFile("Game.adf", "c".repeat(64));
    expect(p.title).toBe("Game");
    expect(p.machine).toMatchObject({ model: "A500", chipset: "OCS", video: "PAL" });
  });
});
