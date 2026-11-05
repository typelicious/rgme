import { describe, it, expect } from "vitest";
import { copperLine, drawSceneIntro, scrollerGlyph, SCROLLER_TEXT } from "../scene-intro.js";
import { buildSong, midiToHz, ChiptunePlayer, SONG_STEPS, STEP_SECONDS, CHANNEL_PAN, type AudioContextLike } from "../chiptune.js";
import { MockRuntimeAdapter, type CanvasLike } from "../mock-runtime.js";
import { freewareEntryToProfile, type FreewareEntry } from "../freeware.js";
import { sampleProfile } from "./fixtures.js";

function recCtx() {
  const log: string[] = [];
  const grads: string[][] = [];
  const ctx = {
    fillStyle: "" as string | CanvasGradient | CanvasPattern,
    font: "", strokeStyle: "" as string, lineWidth: 0, textAlign: "", textBaseline: "",
    fillRect: () => void log.push("rect"),
    fillText: (t: string) => void log.push(`text:${t}`),
    strokeText: (t: string) => void log.push(`stroke:${t}`),
    createLinearGradient: () => { const stops: string[] = []; grads.push(stops); return { addColorStop: (_o: number, c: string) => void stops.push(c) }; }
  };
  return { ctx, log, grads };
}

describe("scene intro", () => {
  it("copper rasterbars move over time and stay valid colours", () => {
    const seen = new Set<string>();
    for (let y = 0; y < 256; y++) seen.add(copperLine(y, 10));
    expect(seen.size).toBeGreaterThan(40);
    expect(copperLine(100, 0)).not.toBe(copperLine(100, 60));
    expect(copperLine(0, 0)).toMatch(/^rgb\(\d+,\d+,\d+\)$/);
  });
  it("draws raster, chrome+shine RGME logo and scroller", () => {
    const { ctx, log, grads } = recCtx();
    drawSceneIntro(ctx, 30);
    expect(log.filter((l) => l === "rect").length).toBeGreaterThanOrEqual(256);
    expect(log.filter((l) => l === "text:RGME").length).toBeGreaterThanOrEqual(3); // shadow, chrome, shine
    expect(log).toContain("stroke:RGME");
    expect(log.some((l) => l.startsWith("text:") && l.length === 6 && l !== "text:RGME")).toBe(true);
    expect(grads.some((g) => g.includes("#ffffff") && g.length === 5)).toBe(true); // chrome
    expect(grads.some((g) => g.some((c) => c.includes("0.95")))).toBe(true); // shine
  });
  it("scroller glyphs ride a sine wave and wrap", () => {
    const a = scrollerGlyph(5, 0, SCROLLER_TEXT.length);
    const b = scrollerGlyph(5, 40, SCROLLER_TEXT.length);
    expect(a.x).not.toBe(b.x);
    expect(a.y).toBeGreaterThanOrEqual(208);
    expect(a.y).toBeLessThanOrEqual(236);
  });
  it("degrades gracefully on a minimal context", () => {
    const rects: number[] = [];
    drawSceneIntro({ fillStyle: "", fillRect: () => void rects.push(1) }, 3);
    expect(rects).toHaveLength(256);
  });
});

describe("chiptune", () => {
  it("is a 4-channel minor-key composition with drums and loops cleanly", () => {
    const song = buildSong();
    expect(new Set(song.map((e) => e.channel))).toEqual(new Set([0, 1, 2, 3]));
    expect(song.every((e) => e.step >= 0 && e.step < SONG_STEPS)).toBe(true);
    expect(song.some((e) => e.kind === "kick") && song.some((e) => e.kind === "snare") && song.some((e) => e.kind === "hat")).toBe(true);
    const lead = song.filter((e) => e.channel === 0);
    expect(lead).toHaveLength(SONG_STEPS); // 16th arpeggio every step
    // first chord is A minor: pitch classes of the first bar's lead are within {A, C, E}
    const pcs = new Set(lead.slice(0, 16).map((e) => e.midi! % 12));
    for (const pc of pcs) expect([9, 0, 4]).toContain(pc);
    expect(midiToHz(69)).toBeCloseTo(440);
    expect(CHANNEL_PAN).toEqual({ 0: -1, 1: 1, 2: 1, 3: -1 });
  });

  function fakeAudio() {
    const started: Array<{ type: string; at: number }> = [];
    const pans: number[] = [];
    let closed = false, now = 0;
    const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
    const node = () => ({ connect() {}, disconnect() {} });
    const ctx: AudioContextLike & { advance(t: number): void } = {
      get currentTime() { return now; },
      sampleRate: 100,
      destination: {},
      createOscillator: () => { const o = { ...node(), type: "", frequency: param(), start: (t: number) => void started.push({ type: o.type, at: t }), stop() {} }; return o; },
      createGain: () => ({ ...node(), gain: param() }),
      createStereoPanner: () => { pans.push(0); return { ...node(), pan: param() }; },
      createBuffer: (_c, len) => ({ getChannelData: () => new Float32Array(len) }),
      createBufferSource: () => ({ ...node(), buffer: null, start: (t: number) => void started.push({ type: "noise", at: t }), stop() {} }),
      close: async () => void (closed = true),
      advance: (t) => void (now = t)
    };
    return { ctx, started, isClosed: () => closed };
  }

  it("schedules all channels ahead of time at 150 BPM, creates context lazily, stops cleanly", () => {
    const f = fakeAudio();
    let created = 0;
    const p = new ChiptunePlayer(() => { created++; return f.ctx; });
    expect(created).toBe(0);
    p.start();
    expect(created).toBe(1);
    f.ctx.advance(1);
    p.pump();
    const types = new Set(f.started.map((s) => s.type));
    expect(types).toContain("square");
    expect(types).toContain("sawtooth");
    expect(types).toContain("triangle");
    expect(types).toContain("sine");
    expect(types).toContain("noise");
    const lead = f.started.filter((s) => s.type === "square").map((s) => s.at).sort((a, b) => a - b);
    expect(lead[1]! - lead[0]!).toBeCloseTo(STEP_SECONDS, 5);
    p.stop();
    expect(f.isClosed()).toBe(true);
    p.pause(); // harmless after stop
  });
  it("is a no-op where Web Audio is unavailable", () => {
    const p = new ChiptunePlayer(() => undefined);
    expect(() => { p.start(); p.pause(); p.stop(); p.setMuted(true); }).not.toThrow();
  });
});

describe("MockRuntimeAdapter scenes & audio", () => {
  it("renders the intro scene for scene profiles and drives the audio sink", async () => {
    const calls: string[] = [];
    const audio = { start: () => void calls.push("start"), pause: () => void calls.push("pause"), stop: () => void calls.push("stop"), setMuted: (m: boolean) => void calls.push(`mute:${m}`) };
    const { ctx, log } = recCtx();
    const canvas: CanvasLike = { width: 0, height: 0, getContext: () => ctx };
    const a = new MockRuntimeAdapter(canvas, undefined, audio);
    const p = sampleProfile({ runtime: { preferredAdapter: "mock", options: { scene: "intro" } } });
    await a.loadGame(p);
    expect(log).toContain("text:RGME");
    expect(a.identifyCapabilities().audio).toBe(true);
    a.start(); a.pause(); a.start(); a.setMuted(true); a.stop();
    expect(calls).toEqual(["stop", "start", "pause", "start", "mute:true", "stop"]);
  });
  it("keeps the colour-bar pattern for ordinary profiles", async () => {
    const { ctx, log } = recCtx();
    const a = new MockRuntimeAdapter({ width: 0, height: 0, getContext: () => ctx });
    await a.loadGame(sampleProfile());
    expect(log).not.toContain("text:RGME");
  });
  it("freeware scene profile reaches the adapter with the intro option", async () => {
    const e = { id: "rgme-scene-intro", canonical_title: "T", filename: "x.adf", sha256: "a".repeat(64), machine: { model: "A500", chipset: "OCS", video: "PAL", ram_chip_kb: 512, ram_fast_kb: 512 }, rights: { rights_class: "A", status: "verified_public_domain", opportunity: "GREEN", rightsholder: "r", license: "CC0", actions: {} } } satisfies FreewareEntry;
    expect(freewareEntryToProfile(e).runtime.options?.scene).toBe("intro");
  });
});
