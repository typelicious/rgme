import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildPlayerSource } from "../../scripts/build-player.mjs";
import { PLAYER_JS } from "../export/player-bundle.generated.js";
import { buildExport, bytesToBase64, evaluateExportGate, sha256Hex, toYaml, freewareEntryToProfile, freewareEntryToRights, matrixRecordToRights, unknownRightsRecord, type FreewareEntry } from "../index.js";

const entries = JSON.parse(readFileSync(resolve(process.cwd(), "../../concept/fixtures/freeware-games.json"), "utf8")) as FreewareEntry[];
const sceneEntry = entries.find((e) => e.id === "rgme-scene-intro")!;
const adf = new Uint8Array(readFileSync(resolve(process.cwd(), "../../concept/fixtures/rgme-scene-intro.adf")));

function restricted(id: string, title: string) {
  const profile = freewareEntryToProfile({ ...sceneEntry, id, canonical_title: title, filename: `${id}.adf`, sha256: "c".repeat(64) });
  const rights = matrixRecordToRights({ canonical_key: id, canonical_title: title, rights_class: "D", opportunity: "RED", actions: { private_execution: "allow_local_byog", binary_redistribution: "deny_without_license", browser_hosting: "deny_without_license" } }).record;
  return { profile, rights };
}

describe("player bundle", () => {
  it("generated bundle is up to date with player-entry.ts", async () => {
    const src = await buildPlayerSource();
    expect(src).toContain(JSON.stringify(PLAYER_JS));
    expect(PLAYER_JS).not.toMatch(/zod/i);
  });
});

describe("export rights gate", () => {
  it("class A public-domain scene intro => single-file player with embedded, unmodified media", async () => {
    const profile = freewareEntryToProfile(sceneEntry);
    const rights = freewareEntryToRights(sceneEntry).record;
    const gate = evaluateExportGate(rights);
    expect(gate.mode).toBe("player");
    const r = await buildExport({ profile, rights, media: adf });
    expect(r.mode).toBe("player");
    expect(r.files).toHaveLength(1);
    const html = r.files[0]!.data as string;
    expect(r.files[0]!.path).toBe("rgme-scene-intro.html");
    expect(html).toContain(bytesToBase64(adf));
    expect(html).toContain(sceneEntry.sha256);
    expect(html).toContain("CC0");
    expect(html).toContain("RGME");
    // media embedded bit-exact
    const m = html.match(/id="rgme-media">([^<]*)</)![1]!;
    expect(await sha256Hex(new Uint8Array(Buffer.from(m, "base64")))).toBe(sceneEntry.sha256);
    // manifest parseable, no raw '<' inside
    const man = JSON.parse(html.match(/id="rgme-manifest">([^<]*)</)![1]!);
    expect(man.profile.runtime.options.scene).toBe("intro");
  });

  it("refuses to embed media whose hash differs from the profile", async () => {
    const profile = freewareEntryToProfile(sceneEntry);
    await expect(buildExport({ profile, rights: freewareEntryToRights(sceneEntry).record, media: new Uint8Array([1, 2, 3]) })).rejects.toThrow(/mismatch/i);
    await expect(buildExport({ profile, rights: freewareEntryToRights(sceneEntry).record })).rejects.toThrow(/media/i);
  });

  it("class C freeware with modification denied still qualifies (redistribution + hosting allowed)", () => {
    const e = entries.find((x) => x.id === "beneath-a-steel-sky")!;
    expect(evaluateExportGate(freewareEntryToRights(e).record).mode).toBe("player");
  });

  it("class D/E matrix titles and unknown records get BYOG packages with NO media bytes or base64", async () => {
    for (const { profile, rights } of [restricted("lemmings", "Lemmings"), { profile: freewareEntryToProfile(sceneEntry), rights: unknownRightsRecord("x") }]) {
      const secret = adf; // would be embedded in player mode
      const r = await buildExport({ profile, rights, media: secret });
      expect(r.mode).toBe("byog");
      expect(r.files.map((f) => f.path)).toEqual([
        `${r.slug}.byog/README.txt`, `${r.slug}.byog/game-profile.yaml`, `${r.slug}.byog/rights.json`, `${r.slug}.byog/manifest.json`, `${r.slug}.byog/${r.slug}-byog-player.html`
      ]);
      const b64 = bytesToBase64(secret);
      for (const f of r.files) {
        const text = typeof f.data === "string" ? f.data : Buffer.from(f.data).toString("latin1");
        expect(text).not.toContain(b64.slice(0, 400));
        expect(text).not.toContain(b64.slice(-400));
        expect(text).not.toContain('id="rgme-media"');
      }
      const player = r.files.find((f) => f.path.endsWith(".html"))!.data as string;
      expect(player).toContain('id="drop"');
      expect(r.reason).toMatch(/BYOG/);
    }
  });

  it("emits valid-looking YAML for profiles", () => {
    const y = toYaml(freewareEntryToProfile(sceneEntry));
    expect(y).toContain("schema: \"rgme.game/v0.2\"");
    expect(y).toContain("media:\n  -\n");
    expect(toYaml({ a: [], b: {} })).toBe("a: []\nb: {}");
  });
});
