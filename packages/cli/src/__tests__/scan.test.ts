import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, writeFile, readFile, readdir, stat, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "yaml";
import { GameProfileSchema } from "@rgme/core";
import { scanDirectory, hashFile, formatTable, writeProfiles, FIXTURE_REGISTRY } from "../index.js";

let root: string;
const fixture = (t: string) => Buffer.from(`RGME-FIXTURE:${t}`);
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "rgme-scan-"));
  await mkdir(join(root, "nested", "deep"), { recursive: true });
  await writeFile(join(root, "disk1.adf"), fixture("688 Attack Sub")); // hash-identified
  await writeFile(join(root, "nested", "Agony.ADF"), fixture("Agony"));
  await writeFile(join(root, "nested", "deep", "Alien Breed.adf"), Buffer.from("random bytes")); // title match only
  await writeFile(join(root, "nested", "mystery.adf"), Buffer.from("who knows")); // unknown
  await writeFile(join(root, "readme.txt"), "ignore me");
});
afterAll(() => rm(root, { recursive: true, force: true }));

describe("registry", () => {
  it("fixture hashes match the fixture contents", () => {
    expect(FIXTURE_REGISTRY[sha(fixture("688 Attack Sub"))]).toBe("688 Attack Sub");
    expect(FIXTURE_REGISTRY[sha(fixture("Agony"))]).toBe("Agony");
  });
});

describe("scanDirectory", () => {
  it("finds nested .adf files only and hashes via stream", async () => {
    const entries = await scanDirectory(root);
    expect(entries).toHaveLength(4);
    const e = entries.find((x) => x.filename === "disk1.adf")!;
    expect(e.sha256).toBe(sha(fixture("688 Attack Sub")));
    expect(await hashFile(e.path)).toBe(e.sha256);
  });

  it("identifies by hash, by title, and leaves the rest unknown", async () => {
    const by = Object.fromEntries((await scanDirectory(root)).map((e) => [e.filename, e]));
    expect(by["disk1.adf"]).toMatchObject({ title: "688 Attack Sub", matchedBy: "hash", identified: true });
    expect(by["Alien Breed.adf"]).toMatchObject({ title: "Alien Breed", matchedBy: "title", identified: true });
    expect(by["mystery.adf"]).toMatchObject({ matchedBy: "none", identified: false, rightsStatus: "unknown", localPlay: "local_only", redistribution: "deny" });
  });

  it("never upgrades rights to permission", async () => {
    for (const e of await scanDirectory(root)) {
      expect(e.redistribution).not.toBe("allow");
      expect(["local_only", "deny", "review"]).toContain(e.localPlay);
    }
  });

  it("does not modify originals", async () => {
    const files = ["disk1.adf", "nested/mystery.adf"].map((f) => join(root, f));
    const before = await Promise.all(files.map(async (f) => ({ b: await readFile(f), m: (await stat(f)).mtimeMs })));
    await scanDirectory(root);
    const after = await Promise.all(files.map(async (f) => ({ b: await readFile(f), m: (await stat(f)).mtimeMs })));
    expect(after).toEqual(before);
  });
});

describe("output", () => {
  it("formats a table", async () => {
    const table = formatTable(await scanDirectory(root));
    expect(table).toContain("Title");
    expect(table).toContain("Rights Status");
    expect(table).toContain("688 Attack Sub");
    expect(table).toContain("local only / denied");
  });

  it("writes valid profile YAML for identified games only by default", async () => {
    const out = join(root, "out");
    const files = await writeProfiles(await scanDirectory(root), out);
    expect(files).toHaveLength(3);
    const p = GameProfileSchema.parse(parse(await readFile(join(out, "688-attack-sub.game-profile.yaml"), "utf8")));
    expect(p.media[0]!.sha256).toBe(sha(fixture("688 Attack Sub")));
    expect(await readdir(out)).not.toContain("mystery.game-profile.yaml");
  });

  it("writes unknown profiles with --include-unknown", async () => {
    const out = join(root, "out2");
    const files = await writeProfiles(await scanDirectory(root), out, true);
    expect(files).toHaveLength(4);
    GameProfileSchema.parse(parse(await readFile(join(out, "mystery.game-profile.yaml"), "utf8")));
  });
});
