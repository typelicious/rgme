import { describe, it, expect } from "vitest";
import { RightsPolicyEngine, RightsRecordSchema, unknownRightsRecord, type RightsRecord, type RightsAssertion } from "../rights.js";
import { MasterMatrixIndex, matrixRecordToRights, normalizeTitle } from "../matrix.js";

const engine = new RightsPolicyEngine();
const rec = (assertions: RightsAssertion[]): RightsRecord => ({ ...unknownRightsRecord("g"), assertions });
const a = (action: RightsAssertion["action"], status: RightsAssertion["status"], evidenceIds = ["e1"]): RightsAssertion => ({
  action, component: "game_binary", status, evidenceIds, confidence: "high"
});

describe("RightsPolicyEngine", () => {
  it("unknown record: local play only, never distribution", () => {
    const r = unknownRightsRecord("g");
    expect(engine.evaluateAction(r, { action: "private_execution" }).decision).toBe("local_only");
    for (const action of ["binary_redistribution", "browser_hosting", "patch_distribution", "derivative_distribution", "commercial_use"] as const) {
      expect(engine.evaluateAction(r, { action }).decision).toBe("deny");
    }
  });
  it("missing record behaves like unknown", () => {
    expect(engine.evaluateAction(undefined, { action: "private_execution" }).decision).toBe("local_only");
    expect(engine.evaluateAction(undefined, { action: "binary_redistribution" }).decision).toBe("deny");
  });
  it("explicit unknown assertion is not permission", () => {
    expect(engine.evaluateAction(rec([a("binary_redistribution", "unknown")]), { action: "binary_redistribution" }).decision).toBe("deny");
  });
  it("permitted with evidence allows", () => {
    const d = engine.evaluateAction(rec([a("binary_redistribution", "permitted")]), { action: "binary_redistribution" });
    expect(d.decision).toBe("allow");
    expect(d.evidenceIds).toEqual(["e1"]);
  });
  it("permitted without evidence is NOT permission", () => {
    expect(engine.evaluateAction(rec([a("binary_redistribution", "permitted", [])]), { action: "binary_redistribution" }).decision).toBe("deny");
  });
  it("prohibited denies, even local execution", () => {
    expect(engine.evaluateAction(rec([a("private_execution", "prohibited")]), { action: "private_execution" }).decision).toBe("deny");
  });
  it("restricted needs review", () => {
    expect(engine.evaluateAction(rec([a("modification", "restricted")]), { action: "modification" }).decision).toBe("review");
  });
  it("conflicting evidence needs review", () => {
    const r = rec([a("browser_hosting", "permitted"), a("browser_hosting", "prohibited")]);
    expect(engine.evaluateAction(r, { action: "browser_hosting" }).decision).toBe("review");
  });
  it("multi-component request takes the most restrictive outcome", () => {
    const r = rec([a("binary_redistribution", "permitted"), { ...a("binary_redistribution", "prohibited"), component: "music_audio" }]);
    expect(engine.evaluateAction(r, { action: "binary_redistribution", components: ["game_binary", "music_audio"] }).decision).toBe("deny");
  });
  it("record schema validates", () => {
    expect(RightsRecordSchema.safeParse(unknownRightsRecord("g")).success).toBe(true);
    expect(RightsRecordSchema.safeParse({ ...unknownRightsRecord("g"), classification: "Z" }).success).toBe(false);
  });
});

describe("master matrix mapping", () => {
  const m = {
    canonical_key: "688 attack sub", canonical_title: "688 Attack Sub", rights_class: "E/D", opportunity: "YELLOW/ORANGE",
    current_rights_assessment: "Historical EA publishing relationship", source_batches: ["007"],
    actions: { private_execution: "allow_local_byog", binary_redistribution: "deny_without_license", modification: "review" }
  };
  it("normalizes titles", () => {
    expect(normalizeTitle("688_Attack Sub (Disk 1).adf")).toBe("688 attack sub");
    expect(normalizeTitle("Prince of Persia.adf")).toBe("prince of persia");
  });
  it("maps allow_local_byog to local_only, never allow", () => {
    const { record } = matrixRecordToRights(m);
    expect(RightsRecordSchema.safeParse(record).success).toBe(true);
    expect(engine.evaluateAction(record, { action: "private_execution" }).decision).toBe("local_only");
    expect(engine.evaluateAction(record, { action: "binary_redistribution" }).decision).toBe("deny");
    expect(engine.evaluateAction(record, { action: "modification" }).decision).toBe("review");
  });
  it("indexes and matches by filename", () => {
    const idx = new MasterMatrixIndex({ schema: "x", records: [m] });
    expect(idx.match("688 Attack Sub.lha")?.canonical_key).toBe("688 attack sub");
    expect(idx.match("unknown game.adf")).toBeUndefined();
  });
});
