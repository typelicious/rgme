import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import {
  C64RuntimeAdapter, C64_PALETTE, C64_PAL_HZ, D64Error, D64Parser, D64_SIZE, D64_SIZE_WITH_ERRORS, FM_SONG_STEPS, FmPlayer, GENESIS_NTSC_HZ,
  GenesisRomError, GenesisRuntimeAdapter, MockRuntimeAdapter, SID_SONG_STEPS, SidPlayer, buildFmTune, buildSidTune, c64DirectoryListing,
  createPlatformAdapter, createPlatformAudio, drawText, glyphRows, parseGenesisRom, parseRegions, prgLoadAddress, sectorOffset, sectorsInTrack,
  type AudioContextLike, type CanvasLike, type GameProfile
} from "../index.js";

const dir = fileURLToPath(new URL("../../../../concept/fixtures/", import.meta.url));
const d64Bytes = () => new Uint8Array(readFileSync(dir + "rgme-c64-demo.d64"));
const mdBytes = () => new Uint8Array(readFileSync(dir + "rgme-md-demo.md"));
const registry = JSON.parse(readFileSync(dir + "multiplatform-games.json", "utf8")) as Array<{ id: string; sha256: string; platform: string; filename: string }>;
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

function profile(platform: "c64" | "megadrive", kind: "d64" | "md", file: string): GameProfile {
  return {
    schema: "rgme.game/v0.2", id: `demo-${platform}`, title: `Demo ${platform}`, platform,
    machine: { model: platform === "c64" ? "C64C" : "Mega Drive", video: platform === "c64" ? "PAL" : "NTSC" },
    media: [{ id: "df0", kind, filename: file, sha256: "a".repeat(64) }],
    runtime: { preferredAdapter: `${platform}-reference` }, launch: { bootMediaId: "df0" },
    input: { id: "k", keyboard: { Space: "fire" }, gamepad: {} },
    display: { id: "d", aspect: "4:3", scaling: "integer", crt: false, aspectAltered: false },
    rights: { recordId: "r" }
  } as GameProfile;
}

function recCtx() {
  const rects: Array<{ fill: string; x: number; y: number; w: number; h: number }> = [];
  const ctx = {
    fillStyle: "" as string | CanvasGradient | CanvasPattern,
    fillRect(x: number, y: number, w: number, h: number) { rects.push({ fill: String(this.fillStyle), x, y, w, h }); }
  };
  const canvas: CanvasLike = { width: 0, height: 0, getContext: () => ctx };
  return { canvas, rects };
}

describe("fixtures", () => {
  it("registry hashes match the generated files", () => {
    expect(registry.find((g) => g.id === "rgme-c64-demo")!.sha256).toBe(sha(d64Bytes()));
    expect(registry.find((g) => g.id === "rgme-md-demo")!.sha256).toBe(sha(mdBytes()));
    expect(registry.map((g) => g.platform)).toEqual(["c64", "megadrive"]);
  });
});

describe("D64Parser", () => {
  it("track/sector geometry", () => {
    expect([1, 17, 18, 24, 25, 30, 31, 35].map(sectorsInTrack)).toEqual([21, 21, 19, 19, 18, 18, 17, 17]);
    expect(sectorOffset(1, 0)).toBe(0);
    expect(sectorOffset(18, 0)).toBe(357 * 256);
    expect(sectorOffset(35, 16) + 256).toBe(D64_SIZE);
    expect(() => sectorsInTrack(36)).toThrow(D64Error);
    expect(() => sectorOffset(1, 21)).toThrow(D64Error);
  });
  it("parses the demo disk: label, id, BAM, directory, free blocks", () => {
    const p = new D64Parser(d64Bytes());
    const d = p.parse();
    expect(d.name).toBe("RGME C64 DEMO");
    expect(d.id).toBe("RG");
    expect(d.bamConsistent).toBe(true);
    expect(d.hasErrorBytes).toBe(false);
    expect(d.entries.map((e) => [e.name, e.type, e.closed])).toEqual([["HELLO", "PRG", true], ["BORDER", "PRG", true]]);
    expect(d.freeBlocks).toBe(664 - d.entries.reduce((n, e) => n + e.blocks, 0));
    const hello = p.readFile(p.findFile(d, "hello")!);
    expect(prgLoadAddress(hello)).toBe(0x0801);
    const border = p.readFile(d.entries[1]!);
    expect(prgLoadAddress(border)).toBe(0xc000);
    expect([...border.subarray(2, 8)]).toEqual([0xee, 0x20, 0xd0, 0x4c, 0x00, 0xc0]);
    expect(d.entries[1]!.blocks).toBeGreaterThan(1); // exercises multi-sector chains
    expect(border.length).toBe(2 + 6 + 256 + "RGME-C64-DEMO CC0".length);
  });
  it("directory listing resembles LOAD\"$\",8 / LIST", () => {
    const lines = c64DirectoryListing(new D64Parser(d64Bytes()).parse());
    expect(lines[0]).toBe('0 "RGME C64 DEMO   " RG 2A');
    expect(lines[1]).toMatch(/^1\s+"HELLO"\s+PRG$/);
    expect(lines.at(-1)).toMatch(/^\d+ BLOCKS FREE\.$/);
  });
  it("accepts error bytes, rejects bad sizes", () => {
    const withErr = new Uint8Array(D64_SIZE_WITH_ERRORS);
    withErr.set(d64Bytes());
    const d = new D64Parser(withErr).parse();
    expect(d.hasErrorBytes).toBe(true);
    expect(d.name).toBe("RGME C64 DEMO");
    expect(() => new D64Parser(new Uint8Array(1000))).toThrow(/Unsupported D64 size/);
  });
  it("guards against file and directory chain loops", () => {
    const img = d64Bytes();
    const p0 = new D64Parser(img);
    const e = p0.parse().entries[1]!;
    const o = sectorOffset(e.track, e.sector);
    img[o] = e.track;
    img[o + 1] = e.sector; // first sector links to itself
    expect(() => new D64Parser(img).readFile(e)).toThrow(/loop/);
    const dirImg = d64Bytes();
    const d = sectorOffset(18, 1);
    dirImg[d] = 18;
    dirImg[d + 1] = 1;
    expect(() => new D64Parser(dirImg).parse()).toThrow(/Directory chain loop/);
  });
  it("detects inconsistent BAM counts", () => {
    const img = d64Bytes();
    img[sectorOffset(18, 0) + 4 * 1] = 3;
    expect(new D64Parser(img).parse().bamConsistent).toBe(false);
  });
});

describe("GenesisRomParser", () => {
  it("parses the demo ROM header with a valid checksum", () => {
    const r = parseGenesisRom(mdBytes());
    expect(r.format).toBe("bin");
    expect(r.headerValid).toBe(true);
    expect(r.consoleName).toBe("SEGA MEGA DRIVE");
    expect(r.copyright).toBe("(C)RGME 2026.NOV");
    expect(r.domesticTitle).toBe("RGME HOMEBREW DEMO");
    expect(r.serial).toBe("00000000-00");
    expect(r.romEnd).toBe(0x1ffff);
    expect(r.romSizeDeclared).toBe(0x20000);
    expect(r.actualSize).toBe(0x20000);
    expect(r.checksumValid).toBe(true);
    expect(r.checksumComputed).toBe(r.checksumField);
    expect(r.regions).toEqual(["Japan", "Americas", "Europe"]);
    expect(r.initialSp).toBe(0x00ff0000);
    expect(r.initialPc).toBe(0x200);
    expect(r.ramStart).toBe(0xff0000);
  });
  it("flags a wrong checksum", () => {
    const rom = mdBytes();
    rom[0x300] ^= 0xff;
    const r = parseGenesisRom(rom);
    expect(r.checksumValid).toBe(false);
    expect(r.checksumComputed).not.toBe(r.checksumField);
  });
  it("reports SMD-interleaved dumps as unsupported", () => {
    const smd = new Uint8Array(0x4000 + 0x200);
    smd[8] = 0xaa;
    smd[9] = 0xbb;
    const r = parseGenesisRom(smd);
    expect(r.format).toBe("smd-interleaved");
    expect(r.supported).toBe(false);
  });
  it("rejects tiny files and decodes region codes", () => {
    expect(() => parseGenesisRom(new Uint8Array(100))).toThrow(GenesisRomError);
    expect(parseRegions("U")).toEqual(["Americas"]);
    expect(parseRegions("5")).toEqual(["Japan", "Americas"]);
    expect(parseRegions("8")).toEqual(["Europe"]);
    expect(parseRegions("???")).toEqual([]);
  });
  it("non-SEGA header is flagged", () => {
    const rom = mdBytes();
    rom.fill(0x20, 0x100, 0x110);
    expect(parseGenesisRom(rom).headerValid).toBe(false);
  });
});

describe("font", () => {
  it("has 7-row glyphs, folds lower case, falls back to a box", () => {
    expect(glyphRows("A")).toHaveLength(7);
    expect(glyphRows("a")).toEqual(glyphRows("A"));
    expect(glyphRows("☃")).toEqual(glyphRows("\u0001"));
    const { canvas, rects } = recCtx();
    const w = drawText(canvas.getContext("2d")!, "HI", 10, 20, "#fff", 2);
    expect(w).toBe(24);
    expect(rects.length).toBeGreaterThan(5);
    expect(rects.every((r) => r.fill === "#fff" && r.x >= 10)).toBe(true);
  });
});

describe("C64RuntimeAdapter", () => {
  it("PAL 384x272, real palette, capabilities say reference", async () => {
    const { canvas, rects } = recCtx();
    const a = new C64RuntimeAdapter(canvas);
    expect([canvas.width, canvas.height]).toEqual([384, 272]);
    expect(C64_PALETTE).toHaveLength(16);
    expect(C64_PALETTE[6]).toBe("#352879");
    const c = a.identifyCapabilities();
    expect(c).toMatchObject({ platform: "c64", emulation: "reference", frameRateHz: C64_PAL_HZ, videoStandards: ["PAL"], audio: false });
    a.setMediaData("df0", d64Bytes());
    await a.loadGame(profile("c64", "d64", "rgme-c64-demo.d64"));
    expect(a.disk?.name).toBe("RGME C64 DEMO");
    const fills = new Set(rects.map((r) => r.fill));
    expect(fills.has("#6c5eb5")).toBe(true); // border / text light blue
    expect(fills.has("#352879")).toBe(true); // background blue
    const lines = a.screenLines();
    expect(lines.some((l) => l.includes('"HELLO"'))).toBe(true);
    expect(lines.some((l) => l.includes("BLOCKS FREE."))).toBe(true);
    expect(lines.every((l) => l.length <= 40)).toBe(true);
    expect(lines.length).toBeLessThanOrEqual(25);
  });
  it("shows an error for broken media and for missing media", async () => {
    const a = new C64RuntimeAdapter();
    await a.loadGame(profile("c64", "d64", "x.d64"));
    expect(a.screenLines().join("\n")).toContain("DEVICE NOT PRESENT");
    a.setMediaData("df0", new Uint8Array(10));
    expect(a.mediaError).toMatch(/Unsupported D64 size/);
    expect(a.screenLines().join("\n")).toContain("FILE DATA ERROR");
  });
  it("lifecycle, loading stripes, save/load, snapshot, disk swap", async () => {
    const { canvas, rects } = recCtx();
    let t = 1000;
    const a = new C64RuntimeAdapter(canvas, () => t);
    expect(() => a.start()).toThrow();
    expect(() => a.reset()).toThrow();
    await a.loadGame(profile("c64", "d64", "d.d64"));
    expect(a.state).toBe("LOADED");
    a.start();
    const before = rects.length;
    a.tick();
    expect(a.currentFrame).toBe(1);
    expect(rects.length).toBeGreaterThan(before + 20); // border loading stripes
    a.pause();
    expect(a.state).toBe("PAUSED");
    a.tick();
    expect(a.currentFrame).toBe(1);
    a.start();
    a.tick(); a.tick();
    const meta = a.saveState(2);
    expect(meta).toMatchObject({ slot: 2, frame: 3, profileId: "demo-c64", savedAt: 1000 });
    a.tick();
    expect(a.loadState(2).frame).toBe(3);
    expect(() => a.saveState(10)).toThrow(RangeError);
    expect(() => a.loadState(5)).toThrow(/empty/);
    a.pressInput("fire", true);
    const snap = a.exportSnapshot();
    expect(snap).toMatchObject({ adapterId: "c64-reference", profileId: "demo-c64", inputs: ["fire"], frame: 3 });
    a.pressInput("fire", false);
    a.tick();
    a.importSnapshot(snap);
    expect(a.currentFrame).toBe(3);
    expect(a.activeInputs).toEqual(["fire"]);
    expect(() => a.importSnapshot({ ...snap, adapterId: "mock" })).toThrow(/adapter/);
    expect(() => a.importSnapshot({ ...snap, profileId: "other" })).toThrow(/other/);
    a.setMediaData("df0", d64Bytes());
    a.insertMedia({ id: "df1", kind: "d64", filename: "b.d64", sha256: "b".repeat(64) });
    expect(a.currentMedia).toHaveLength(2);
    a.stop();
    expect(a.state).toBe("STOPPED");
    expect(() => a.saveState(0)).toThrow();
    expect(() => a.insertMedia({ id: "x", kind: "d64", filename: "x", sha256: "c".repeat(64) })).toThrow();
  });
  it("drives the audio sink with the lifecycle", async () => {
    const calls: string[] = [];
    const audio = { start: () => void calls.push("start"), pause: () => void calls.push("pause"), stop: () => void calls.push("stop"), setMuted: (m: boolean) => void calls.push(`mute:${m}`) };
    const a = new C64RuntimeAdapter(undefined, undefined, audio);
    await a.loadGame(profile("c64", "d64", "d.d64"));
    a.start(); a.pause(); a.start(); a.setMuted(true); a.stop();
    expect(calls).toEqual(["stop", "start", "pause", "start", "mute:true", "stop"]);
    expect(a.identifyCapabilities().audio).toBe(true);
  });
});

describe("GenesisRuntimeAdapter", () => {
  it("NTSC 320x224 with ROM facts and checksum verdict", async () => {
    const { canvas, rects } = recCtx();
    const a = new GenesisRuntimeAdapter(canvas);
    expect([canvas.width, canvas.height]).toEqual([320, 224]);
    expect(a.identifyCapabilities()).toMatchObject({ platform: "megadrive", emulation: "reference", frameRateHz: GENESIS_NTSC_HZ, videoStandards: ["NTSC"] });
    a.setMediaData("df0", mdBytes());
    await a.loadGame(profile("megadrive", "md", "rgme-md-demo.md"));
    const lines = a.infoLines();
    expect(lines[0]).toBe("RGME HOMEBREW DEMO");
    expect(lines.join("\n")).toContain("CHECKSUM");
    expect(lines.join("\n")).toMatch(/CHECKSUM [0-9A-F]{4} OK/);
    expect(lines.join("\n")).toContain("NO 68000/Z80");
    expect(rects.length).toBeGreaterThan(200);
    const before = rects.length;
    a.start();
    a.tick();
    expect(rects.length).toBeGreaterThan(before + 30);
    a.stop();
  });
  it("reports a bad checksum and unsupported SMD dumps", async () => {
    const bad = mdBytes();
    bad[0x400] ^= 1;
    const a = new GenesisRuntimeAdapter();
    a.setMediaData("df0", bad);
    await a.loadGame(profile("megadrive", "md", "x.md"));
    expect(a.infoLines().join("\n")).toMatch(/CHECKSUM [0-9A-F]{4} BAD/);
    const smd = new Uint8Array(0x4000 + 0x200);
    smd[8] = 0xaa; smd[9] = 0xbb;
    a.setMediaData("df0", smd);
    expect(a.infoLines().join("\n")).toContain("SMD-interleaved");
  });
  it("snapshot round-trip and lifecycle errors", async () => {
    const a = new GenesisRuntimeAdapter();
    expect(() => a.exportSnapshot()).toThrow();
    await a.loadGame(profile("megadrive", "md", "x.md"));
    a.start(); a.tick(); a.tick();
    const s = a.exportSnapshot();
    a.tick();
    a.importSnapshot(s);
    expect(a.currentFrame).toBe(2);
    expect(s.adapterId).toBe("megadrive-reference");
    a.stop();
  });
});

describe("synths", () => {
  function fakeAudio() {
    const osc: Array<{ type: string; freq: number; at: number }> = [];
    const noise: number[] = [];
    let modulated = 0, filters = 0, closed = false, now = 0;
    const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
    const node = () => ({ connect(dest: unknown) { if (dest && typeof dest === "object" && "setValueAtTime" in (dest as object)) modulated++; }, disconnect() {} });
    const ctx = {
      get currentTime() { return now; }, sampleRate: 100, destination: {},
      createOscillator: () => { const o = { ...node(), type: "", frequency: param(), start: (t: number) => void osc.push({ type: o.type, freq: o.frequency.value, at: t }), stop() {} }; return o; },
      createGain: () => ({ ...node(), gain: param() }),
      createBuffer: (_c: number, len: number) => ({ getChannelData: () => new Float32Array(len) }),
      createBufferSource: () => ({ ...node(), buffer: null, start: (t: number) => void noise.push(t), stop() {} }),
      createBiquadFilter: () => { filters++; return { ...node(), type: "", frequency: param() }; },
      close: async () => void (closed = true),
      advance: (t: number) => void (now = t)
    };
    return { ctx: ctx as unknown as AudioContextLike & { advance(t: number): void }, osc, noise, stats: () => ({ modulated, filters, closed }) };
  }

  it("SID tune: 3 voices (pulse/saw/triangle) + noise on voice 3, loops", () => {
    const song = buildSidTune();
    expect(new Set(song.map((e) => e.ch))).toEqual(new Set([0, 1, 2]));
    expect(new Set(song.map((e) => e.kind))).toEqual(new Set(["pulse", "saw", "tri", "noise"]));
    expect(song.every((e) => e.step >= 0 && e.step < SID_SONG_STEPS)).toBe(true);
    expect(song.filter((e) => e.ch === 1)).toHaveLength(SID_SONG_STEPS);
    // no step plays two events on the same voice (SID has 3 voices)
    const seen = new Set<string>();
    for (const e of song) { const k = `${e.step}:${e.ch}`; expect(seen.has(k)).toBe(false); seen.add(k); }
  });
  it("SID player schedules ahead through a low-pass filter, lazily, and closes", () => {
    const f = fakeAudio();
    let created = 0;
    const p = new SidPlayer(() => { created++; return f.ctx; });
    expect(created).toBe(0);
    p.start();
    f.ctx.advance(1);
    p.pump();
    expect(new Set(f.osc.map((o) => o.type))).toEqual(new Set(["square", "sawtooth", "triangle"]));
    expect(f.noise.length).toBeGreaterThan(0);
    expect(f.stats().filters).toBe(1);
    expect(p.scheduledEvents).toBeGreaterThan(10);
    p.stop();
    expect(f.stats().closed).toBe(true);
  });
  it("FM tune: bass, bell, PSG square and noise; player wires modulator -> carrier frequency", () => {
    const song = buildFmTune();
    expect(new Set(song.map((e) => e.kind))).toEqual(new Set(["fm-bass", "fm-bell", "psg-square", "psg-noise"]));
    expect(song.every((e) => e.step < FM_SONG_STEPS)).toBe(true);
    const f = fakeAudio();
    const p = new FmPlayer(() => f.ctx);
    p.start();
    f.ctx.advance(2);
    p.pump();
    expect(f.stats().modulated).toBeGreaterThan(5); // modulator gain connected to a carrier AudioParam
    expect(f.osc.filter((o) => o.type === "sine").length).toBeGreaterThan(10); // carriers + modulators
    expect(f.osc.some((o) => o.type === "square")).toBe(true);
    expect(f.noise.length).toBeGreaterThan(0);
    p.setMuted(true);
    p.pause();
    p.stop();
  });
  it("players are no-ops without Web Audio", () => {
    for (const p of [new SidPlayer(() => undefined), new FmPlayer(() => undefined)]) {
      expect(() => { p.start(); p.pause(); p.stop(); p.setMuted(true); p.pump(); }).not.toThrow();
    }
  });
});

describe("createPlatformAdapter / createPlatformAudio", () => {
  it("returns the right adapter per platform", () => {
    expect(createPlatformAdapter("amiga")).toBeInstanceOf(MockRuntimeAdapter);
    expect(createPlatformAdapter("c64")).toBeInstanceOf(C64RuntimeAdapter);
    expect(createPlatformAdapter("megadrive")).toBeInstanceOf(GenesisRuntimeAdapter);
    expect(() => createPlatformAdapter("snes")).toThrow(/No runtime adapter/);
  });
  it("returns the platform's soundtrack", () => {
    expect(createPlatformAudio("c64", () => undefined)).toBeInstanceOf(SidPlayer);
    expect(createPlatformAudio("megadrive", () => undefined)).toBeInstanceOf(FmPlayer);
    expect(createPlatformAudio("amiga", () => undefined)).toBeDefined();
    expect(createPlatformAudio("nes", () => undefined)).toBeUndefined();
    const a = createPlatformAdapter("c64", undefined, createPlatformAudio("c64", () => undefined));
    expect((a as C64RuntimeAdapter).identifyCapabilities().audio).toBe(true);
  });
});
