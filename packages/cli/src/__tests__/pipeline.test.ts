import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "yaml";
import { MockRuntimeAdapter, parseGameProfile, RightsPolicyEngine, unknownRightsRecord } from "@rgme/core";
import { scanDirectory, writeProfiles } from "../scan.js";

/** INTEG-001 pipeline: ADF on disk -> scan -> YAML profile -> core validation -> runtime -> rights policy. */
describe("INTEG-001 pipeline", () => {
  it("scans, profiles, plays on the mock runtime and keeps unknown rights local-only", async () => {
    const dir = mkdtempSync(join(tmpdir(), "rgme-int-"));
    const adf = join(dir, "Mystery Game.adf");
    writeFileSync(adf, "RGME-FIXTURE:not in any registry");
    const before = readFileSync(adf);

    const results = await scanDirectory(dir);
    expect(results).toHaveLength(1);
    const out = join(dir, "profiles");
    await writeProfiles(results, out, true);
    const files = readdirSync(out).filter((f) => f.endsWith(".yaml"));
    expect(files).toHaveLength(1);

    const profile = parseGameProfile(parse(readFileSync(join(out, files[0]!), "utf8")));
    const adapter = new MockRuntimeAdapter();
    await adapter.loadGame(profile);
    adapter.start();
    adapter.tick();
    expect(adapter.state).toBe("RUNNING");
    adapter.stop();

    const engine = new RightsPolicyEngine();
    const rec = unknownRightsRecord(profile.id);
    expect(engine.evaluateAction(rec, { action: "private_execution" }).decision).toBe("local_only");
    expect(engine.evaluateAction(rec, { action: "binary_redistribution" }).decision).toBe("deny");
    expect(readFileSync(adf).equals(before)).toBe(true); // original immutable
  });
});
