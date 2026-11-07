import { describe, it, expect } from "vitest";
import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "yaml";
import { GameProfileSchema } from "@rgme/core";
import { scanDirectory, formatTable, writeProfiles } from "../scan.js";

const fixtures = fileURLToPath(new URL("../../../../concept/fixtures/", import.meta.url));

describe("concept/fixtures", () => {
  it("bundled registry equals the concept fixture registry (no drift)", () => {
    const a = readFileSync(join(fixtures, "freeware-games.json"), "utf8");
    const b = readFileSync(fileURLToPath(new URL("../data/freeware-games.json", import.meta.url)), "utf8");
    expect(b).toBe(a);
  });

  it("rgme scan concept/fixtures finds the scene intro and identifies it as Class A public domain", async () => {
    const adf = join(fixtures, "rgme-scene-intro.adf");
    const before = { size: statSync(adf).size, mtime: statSync(adf).mtimeMs, bytes: readFileSync(adf) };
    const entries = await scanDirectory(fixtures);
    expect(entries).toHaveLength(1);
    const e = entries[0]!;
    expect(e.sha256).toBe("16e02d77f501bd9abd56bc09bc6f53301205b44f82d0805f8aa65db44e360004");
    expect(e.matchedBy).toBe("hash");
    expect(e.identified).toBe(true);
    expect(e.title).toBe("RGME Scene Intro: Turrican Tribute");
    expect(e.rightsClass).toBe("A");
    expect(e.rightsStatus).toBe("public_domain");
    expect(e.localPlay).toBe("allow");
    expect(e.redistribution).toBe("allow");
    expect(before.size).toBe(901120);

    const table = formatTable(entries);
    expect(table).toContain("RGME Scene Intro: Turrican Tribute");
    expect(table).toContain("public_domain");
    expect(table).toContain("allowed / allowed");

    // original immutable
    expect(statSync(adf).mtimeMs).toBe(before.mtime);
    expect(readFileSync(adf).equals(before.bytes)).toBe(true);
  });

  it("writes a valid profile selecting the intro scene", async () => {
    const out = mkdtempSync(join(tmpdir(), "rgme-fx-"));
    const files = await writeProfiles(await scanDirectory(fixtures), out);
    expect(files).toHaveLength(1);
    const p = GameProfileSchema.parse(parse(readFileSync(files[0]!, "utf8")));
    expect(p.id).toBe("rgme-scene-intro");
    expect(p.runtime.options).toEqual({ scene: "intro" });
  });

  it("a renamed copy is still identified by hash, a different file with the same name is not", async () => {
    const dir = mkdtempSync(join(tmpdir(), "rgme-fx2-"));
    const { copyFileSync, writeFileSync } = await import("node:fs");
    copyFileSync(join(fixtures, "rgme-scene-intro.adf"), join(dir, "whatever.adf"));
    writeFileSync(join(dir, "rgme-scene-intro.adf"), "impostor");
    const byName = Object.fromEntries((await scanDirectory(dir)).map((e) => [e.filename, e]));
    expect(byName["whatever.adf"]!.rightsStatus).toBe("public_domain");
    expect(byName["rgme-scene-intro.adf"]!.identified).toBe(false);
    expect(byName["rgme-scene-intro.adf"]!.redistribution).toBe("deny");
  });
});
