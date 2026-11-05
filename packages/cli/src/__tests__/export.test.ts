import { describe, it, expect } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync, readdirSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { stringify } from "yaml";
import { freewareEntryToProfile, type FreewareEntry } from "@rgme/core";
import freeware from "../data/freeware-games.json" with { type: "json" };
import { runExport, resolveRightsForProfile, loadProfile } from "../export.js";

const scene = (freeware as unknown as FreewareEntry[]).find((e) => e.id === "rgme-scene-intro")!;
const adfPath = resolve(process.cwd(), "../../concept/fixtures/rgme-scene-intro.adf");

function writeProfile(dir: string, profile: unknown, name = "p.yaml") {
  const p = join(dir, name);
  writeFileSync(p, stringify(profile));
  return p;
}

describe("rgme export", () => {
  it("scene intro (Class A, hash-identified) => single-file player embedding the unmodified ADF", async () => {
    const dir = mkdtempSync(join(tmpdir(), "rgme-exp-"));
    const profile = writeProfile(dir, freewareEntryToProfile(scene));
    const before = readFileSync(adfPath);
    const run = await runExport(profile, { media: adfPath, out: join(dir, "out") });
    expect(run.result.mode).toBe("player");
    expect(run.source).toMatch(/hash match/);
    expect(readdirSync(join(dir, "out"))).toEqual(["rgme-scene-intro.html"]);
    const html = readFileSync(run.written[0]!, "utf8");
    expect(html).toContain(before.toString("base64"));
    expect(readFileSync(adfPath).equals(before)).toBe(true);
    // headless parse of the embedded manifest + media
    const man = JSON.parse(html.match(/id="rgme-manifest">([^<]*)</)![1]!);
    expect(man.media.sha256).toBe(scene.sha256);
    expect(Buffer.from(html.match(/id="rgme-media">([^<]*)</)![1]!, "base64").equals(before)).toBe(true);
  });

  it("finds media next to the profile", async () => {
    const dir = mkdtempSync(join(tmpdir(), "rgme-exp2-"));
    copyFileSync(adfPath, join(dir, scene.filename));
    const run = await runExport(writeProfile(dir, freewareEntryToProfile(scene)), { out: join(dir, "o") });
    expect(run.result.mode).toBe("player");
  });

  it("class D matrix title => BYOG package, media is not needed and never written", async () => {
    const dir = mkdtempSync(join(tmpdir(), "rgme-exp3-"));
    const p = freewareEntryToProfile({ ...scene, id: "688-attack-sub", canonical_title: "688 Attack Sub", filename: "688 Attack Sub.adf", sha256: "d".repeat(64) });
    const run = await runExport(writeProfile(dir, p), { out: join(dir, "o") });
    expect(run.source).toMatch(/master matrix/);
    expect(run.result.mode).toBe("byog");
    const names = run.written.map((w) => w.slice(join(dir, "o").length + 1));
    expect(names).toContain("688-attack-sub.byog/README.txt");
    expect(names).toContain("688-attack-sub.byog/688-attack-sub-byog-player.html");
    const adfB64 = readFileSync(adfPath).toString("base64").slice(0, 300);
    for (const w of run.written) expect(readFileSync(w, "utf8")).not.toContain(adfB64);
  });

  it("unknown hash => BYOG; an impostor with the scene's name stays restricted", async () => {
    const dir = mkdtempSync(join(tmpdir(), "rgme-exp4-"));
    const p = freewareEntryToProfile({ ...scene, sha256: "e".repeat(64) });
    const resolved = await resolveRightsForProfile(p);
    expect(resolved.rights.status).toBe("unknown");
    expect((await runExport(writeProfile(dir, p), { out: join(dir, "o") })).result.mode).toBe("byog");
  });

  it("--rights must match the media hash and cannot clear a different file", async () => {
    const p = freewareEntryToProfile({ ...scene, sha256: "f".repeat(64) });
    await expect(resolveRightsForProfile(p, "rgme-scene-intro")).rejects.toThrow(/does not match/);
    await expect(resolveRightsForProfile(p, "nope")).rejects.toThrow(/Unknown rights entry/);
  });

  it("errors on missing media for cleared titles and on invalid profiles", async () => {
    const dir = mkdtempSync(join(tmpdir(), "rgme-exp5-"));
    const pf = writeProfile(dir, freewareEntryToProfile(scene));
    await expect(runExport(pf, { out: join(dir, "o"), media: join(dir, "nope.adf") })).rejects.toThrow();
    await expect(loadProfile(writeProfile(dir, { schema: "x" }, "bad.yaml"))).rejects.toThrow();
  });
});
