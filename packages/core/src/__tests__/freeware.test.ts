import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { RightsPolicyEngine, RightsRecordSchema, EMPTY_SHA256, findFreewareByHash, freewareEntryToProfile, freewareEntryToRights, type FreewareEntry } from "../index.js";

const entries = JSON.parse(readFileSync(fileURLToPath(new URL("../../../../concept/fixtures/freeware-games.json", import.meta.url)), "utf8")) as FreewareEntry[];
const engine = new RightsPolicyEngine();
const scene = entries.find((e) => e.id === "rgme-scene-intro")!;

describe("freeware fixtures", () => {
  it("identifies the scene intro by hash as Class A public domain, redistributable", () => {
    const e = findFreewareByHash(entries, scene.sha256.toUpperCase())!;
    const { record } = freewareEntryToRights(e);
    expect(RightsRecordSchema.safeParse(record).success).toBe(true);
    expect(record.classification).toBe("A");
    expect(record.status).toBe("public_domain");
    expect(engine.evaluateAction(record, { action: "private_execution" }).decision).toBe("allow");
    expect(engine.evaluateAction(record, { action: "binary_redistribution" }).decision).toBe("allow");
  });
  it("freeware titles: redistribution allowed, modification denied, reverse engineering needs review", () => {
    const e = entries.find((x) => x.id === "beneath-a-steel-sky")!;
    const { record } = freewareEntryToRights(e);
    expect(record.status).toBe("freeware");
    expect(engine.evaluateAction(record, { action: "modification" }).decision).toBe("deny");
    expect(engine.evaluateAction(record, { action: "reverse_engineering" }).decision).toBe("review");
    expect(engine.evaluateAction(record, { action: "commercial_use" }).decision).toBe("deny");
  });
  it("never identifies anything by the empty-input hash", () => {
    expect(findFreewareByHash(entries, EMPTY_SHA256)).toBeUndefined();
    expect(findFreewareByHash(entries, "f".repeat(64))).toBeUndefined();
  });
  it("builds valid profiles; the scene intro selects the intro scene", () => {
    for (const e of entries) expect(freewareEntryToProfile(e).media[0]!.sha256).toBe(e.sha256);
    expect(freewareEntryToProfile(scene).runtime.options).toEqual({ scene: "intro" });
  });
});
