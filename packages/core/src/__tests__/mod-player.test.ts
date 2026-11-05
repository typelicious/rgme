import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  ModError, ModPlayer, ModReplayer, PAL_CLOCK, PERIOD_TABLE, noteName, parseMod, periodToHz,
  type AudioContextLike
} from "../index.js";

const fixturePath = fileURLToPath(new URL("../../../../concept/fixtures/rgme-demo.mod", import.meta.url));

interface Cell { sample?: number; period?: number; fx?: number; param?: number }
interface BuildOpts {
  sig?: string;
  songLength?: number;
  orders?: number[];
  samples?: Array<{ data: number[]; volume?: number; loop?: [number, number]; finetune?: number }>;
  rows?: Record<string, Cell>; // "pattern:row:ch" -> cell
  patterns?: number;
}

/** Builds a synthetic M.K. module. */
function build(o: BuildOpts = {}): Uint8Array {
  const orders = o.orders ?? [0];
  const patterns = o.patterns ?? Math.max(...orders) + 1;
  const samples = o.samples ?? [{ data: Array.from({ length: 64 }, (_, i) => (i < 32 ? 100 : -100)), volume: 64, loop: [0, 32] }];
  const parts: number[] = [];
  const title = "TEST";
  for (let i = 0; i < 20; i++) parts.push(i < title.length ? title.charCodeAt(i) : 0);
  for (let i = 0; i < 31; i++) {
    const s = samples[i];
    for (let k = 0; k < 22; k++) parts.push(0);
    const len = s ? s.data.length / 2 : 0;
    parts.push(len >> 8, len & 255, s ? (s.finetune ?? 0) & 15 : 0, s ? (s.volume ?? 64) : 0);
    const [ls, ll] = s?.loop ?? [0, 1];
    parts.push(ls >> 8, ls & 255, ll >> 8, ll & 255);
  }
  parts.push(o.songLength ?? orders.length, 127);
  for (let i = 0; i < 128; i++) parts.push(orders[i] ?? 0);
  for (const c of (o.sig ?? "M.K.")) parts.push(c.charCodeAt(0));
  for (let p = 0; p < patterns; p++)
    for (let r = 0; r < 64; r++)
      for (let c = 0; c < 4; c++) {
        const cell = o.rows?.[`${p}:${r}:${c}`] ?? {};
        const per = cell.period ?? 0, smp = cell.sample ?? 0, fx = cell.fx ?? 0, prm = cell.param ?? 0;
        parts.push((smp & 0xf0) | (per >> 8), per & 255, ((smp & 15) << 4) | fx, prm);
      }
  for (const s of samples) for (const v of s.data) parts.push(v & 255);
  return Uint8Array.from(parts);
}

describe("ModParser", () => {
  it("parses the generated demo fixture", () => {
    const bytes = readFileSync(fixturePath);
    const m = parseMod(bytes);
    expect(m.title).toBe("RGME DEMO TUNE");
    expect(m.signature).toBe("M.K.");
    expect(m.songLength).toBe(6);
    expect(m.orders.slice(0, 6)).toEqual([0, 0, 1, 0, 1, 1]);
    expect(m.patterns).toHaveLength(2);
    expect(m.samples[0]!.name).toBe("rgme square");
    expect(m.samples[0]!.length).toBe(32);
    expect(m.samples[0]!.repeatLength).toBe(32);
    expect(m.samples[3]!.repeatLength).toBe(2); // 1 word = no loop
    expect(m.samples[30]!.length).toBe(0);
    expect(m.truncated).toBe(false);
    // pattern 0 row 0: ch0 A-2 + sample 1 + arpeggio 0x37, ch3 kick + F06
    const row0 = m.patterns[0]![0]!;
    expect(row0[0]).toEqual({ sample: 1, period: 254, effect: 0, param: 0x37 });
    expect(row0[3]).toEqual({ sample: 4, period: 428, effect: 0xf, param: 6 });
  });

  it("fixture hash matches audio-fixtures.json", () => {
    const entry = JSON.parse(readFileSync(fileURLToPath(new URL("../../../../concept/fixtures/audio-fixtures.json", import.meta.url)), "utf8"))[0];
    expect(createHash("sha256").update(readFileSync(fixturePath)).digest("hex")).toBe(entry.sha256);
    expect(entry.rights.license).toBe("CC0-1.0");
  });

  it("decodes note cells and signed sample data from a synthetic module", () => {
    const m = parseMod(build({ rows: { "0:3:2": { sample: 17, period: 0x1ab, fx: 0xc, param: 0x20 } }, samples: [{ data: [127, -128, 1, -1], finetune: -2 }] }));
    expect(m.patterns[0]![3]![2]).toEqual({ sample: 17, period: 0x1ab, effect: 0xc, param: 0x20 });
    expect(Array.from(m.samples[0]!.data)).toEqual([127, -128, 1, -1]);
    expect(m.samples[0]!.finetune).toBe(-2);
  });

  it("accepts 4CHN and M!K!, rejects other signatures with clear errors", () => {
    expect(parseMod(build({ sig: "4CHN" })).signature).toBe("4CHN");
    expect(parseMod(build({ sig: "M!K!" })).signature).toBe("M!K!");
    expect(() => parseMod(build({ sig: "FLT4" }))).toThrow(/Startrekker/);
    expect(() => parseMod(build({ sig: "6CHN" }))).toThrow(/only 4-channel/);
    expect(() => parseMod(build({ sig: "ABCD" }))).toThrow(ModError);
  });

  it("rejects legacy 15-sample / tiny files and truncated pattern data", () => {
    expect(() => parseMod(new Uint8Array(700))).toThrow(/Legacy 15-sample/);
    expect(() => parseMod(new Uint8Array(10))).toThrow(/too small/);
    const ok = build({ orders: [0, 1] });
    expect(() => parseMod(ok.subarray(0, 1084 + 1024))).toThrow(/truncated/);
    expect(() => parseMod(build({ songLength: 0 }))).toThrow(/song length/);
  });

  it("pads truncated sample data and flags it", () => {
    const b = build({ samples: [{ data: Array(64).fill(50) }] });
    const m = parseMod(b.subarray(0, b.length - 20));
    expect(m.truncated).toBe(true);
    expect(m.samples[0]!.data).toHaveLength(64);
  });
});

describe("periods and note names", () => {
  it("period table: 16 finetunes x 36 notes, strictly descending, finetune 0 anchors", () => {
    expect(PERIOD_TABLE).toHaveLength(16);
    for (const row of PERIOD_TABLE) {
      expect(row).toHaveLength(36);
      for (let i = 1; i < 36; i++) expect(row[i]!).toBeLessThan(row[i - 1]!);
    }
    expect(PERIOD_TABLE[0]![0]).toBe(856);
    expect(PERIOD_TABLE[0]![12]).toBe(428);
    expect(PERIOD_TABLE[0]![35]).toBe(113);
    // finetune +7 is nearly one semitone flat of the next-lower... i.e. lower periods than ft0; -8 higher
    expect(PERIOD_TABLE[7]![0]).toBeLessThan(856);
    expect(PERIOD_TABLE[8]![0]).toBeGreaterThan(856);
    expect(PERIOD_TABLE[8]![1]).toBe(856); // finetune -8 is exactly one semitone down
  });
  it("C-2 (period 428) plays at 8287 Hz on PAL Paula", () => {
    expect(PAL_CLOCK).toBe(3546895);
    expect(periodToHz(428)).toBeCloseTo(PAL_CLOCK / 428, 6);
    expect(Math.round(periodToHz(428))).toBe(8287);
    expect(periodToHz(0)).toBe(0);
  });
  it("note names", () => {
    expect(noteName(856)).toBe("C-1");
    expect(noteName(428)).toBe("C-2");
    expect(noteName(254)).toBe("A-2");
    expect(noteName(113)).toBe("B-3");
    expect(noteName(0)).toBe("---");
  });
});

const note = (period: number, extra: Cell = {}): Cell => ({ sample: 1, period, ...extra });

describe("ModReplayer effects and flow", () => {
  it("tick timing: 2.5/tempo seconds, speed ticks per row", () => {
    const r = new ModReplayer(parseMod(build()));
    expect(r.tickSeconds).toBeCloseTo(0.02, 10);
    r.tempo = 150;
    expect(r.tickSeconds).toBeCloseTo(2.5 / 150, 10);
    r.tempo = 125;
    for (let i = 0; i < 6; i++) r.step();
    expect(r.positionInfo()).toMatchObject({ row: 1, tick: 0 });
    // one row at speed 6 / 125 BPM = 0.12 s => 5292 frames at 44.1k
    const r2 = new ModReplayer(parseMod(build({ rows: { "0:0:0": note(428) } })));
    // steps happen at frames 0, 882, ... so 6 steps (one full row) are done after 5291 frames;
    // positionInfo() points at the NEXT tick to process.
    r2.render(5291, 44100);
    expect(r2.positionInfo()).toMatchObject({ row: 1, tick: 0 });
    r2.render(2, 44100); // 7th step at frame 5292 = row 1 tick 0
    expect(r2.positionInfo()).toMatchObject({ row: 1, tick: 1 });
  });

  it("C sets volume, sample volume applies on note", () => {
    const r = new ModReplayer(parseMod(build({ samples: [{ data: Array(64).fill(10), volume: 48, loop: [0, 32] }], rows: { "0:0:0": note(428), "0:1:0": { fx: 0xc, param: 0x20 } } })));
    r.step();
    expect(r.channels[0]!.volume).toBe(48);
    for (let i = 0; i < 5; i++) r.step();
    r.step(); // row 1 tick 0
    expect(r.channels[0]!.volume).toBe(32);
  });

  it("F sets speed (<=32) or tempo (>32)", () => {
    const r = new ModReplayer(parseMod(build({ rows: { "0:0:0": note(428, { fx: 0xf, param: 3 }), "0:1:1": { fx: 0xf, param: 140 } } })));
    r.step();
    expect(r.speed).toBe(3);
    r.step(); r.step();
    expect(r.positionInfo().row).toBe(1);
    r.step();
    expect(r.tempo).toBe(140);
    expect(r.speed).toBe(3);
  });

  it("1/2 portamento slide the period each tick (clamped 113..856)", () => {
    const r = new ModReplayer(parseMod(build({ rows: { "0:0:0": note(428, { fx: 1, param: 4 }), "0:1:0": { fx: 2, param: 8 } } })));
    r.step(); // tick 0: no slide
    expect(r.channels[0]!.period).toBe(428);
    r.step(); r.step();
    expect(r.channels[0]!.period).toBe(420);
    for (let i = 0; i < 3; i++) r.step();
    expect(r.channels[0]!.period).toBe(408); // slide ticks 1..5 of the row: 5 x 4 = 20
    r.step(); // row 1 tick 0: portamento down starts next tick
    r.step();
    expect(r.channels[0]!.period).toBe(416); // +8
    const up = new ModReplayer(parseMod(build({ rows: { "0:0:0": note(113, { fx: 1, param: 40 }) } })));
    up.step(); up.step();
    expect(up.channels[0]!.period).toBe(113);
    const down = new ModReplayer(parseMod(build({ rows: { "0:0:0": note(850, { fx: 2, param: 40 }) } })));
    down.step(); down.step();
    expect(down.channels[0]!.period).toBe(856);
  });

  it("0 arpeggio cycles base, +x, +y semitones", () => {
    const r = new ModReplayer(parseMod(build({ rows: { "0:0:0": note(428, { fx: 0, param: 0x47 }) } })));
    r.step(); // tick 0 base
    expect(r.channels[0]!.period).toBe(428);
    r.step(); // tick 1: +4 semitones (C-2 -> E-2 = 339)
    expect(r.channels[0]!.period).toBe(339);
    r.step(); // tick 2: +7 (G-2 = 285)
    expect(r.channels[0]!.period).toBe(285);
    r.step(); // tick 3 => 3%3 = 0 base
    expect(r.channels[0]!.period).toBe(428);
  });

  it("D breaks to the next order at a decimal row; B jumps to an order", () => {
    const rows = { "0:2:0": { fx: 0xd, param: 0x12 } as Cell }; // row 12 (decimal)
    const r = new ModReplayer(parseMod(build({ orders: [0, 1], rows })));
    for (let i = 0; i < 18; i++) r.step(); // rows 0,1,2 (3 rows = 18 ticks)
    expect(r.positionInfo()).toMatchObject({ order: 1, pattern: 1, row: 12, tick: 0 });
    const j = new ModReplayer(parseMod(build({ orders: [0, 1, 0], rows: { "0:0:1": { fx: 0xb, param: 2 } } })));
    for (let i = 0; i < 6; i++) j.step();
    expect(j.positionInfo()).toMatchObject({ order: 2, row: 0 });
  });

  it("song end: loops by default, stops and goes silent when loop=false", () => {
    const m = parseMod(build({ rows: { "0:0:0": { ...note(428), fx: 0xd, param: 0 } } })); // break at row 0 => single row song
    const looping = new ModReplayer(m);
    for (let i = 0; i < 12; i++) looping.step();
    expect(looping.ended).toBe(false);
    expect(looping.loopCount).toBeGreaterThan(0);
    const once = new ModReplayer(m, { loop: false });
    for (let i = 0; i < 6; i++) once.step();
    expect(once.ended).toBe(true);
    const out = once.render(100, 44100);
    expect(Math.max(...out.left, ...out.right)).toBe(0);
  });
});

describe("mixing", () => {
  const loud = { data: Array.from({ length: 64 }, (_, i) => (i < 32 ? 100 : -100)), volume: 64, loop: [0, 32] as [number, number] };
  const peak = (a: Float32Array) => a.reduce((m, v) => Math.max(m, Math.abs(v)), 0);

  it("Paula hard panning: ch0/ch3 left only, ch1/ch2 right only", () => {
    for (const [ch, side] of [[0, "left"], [3, "left"], [1, "right"], [2, "right"]] as const) {
      const r = new ModReplayer(parseMod(build({ samples: [loud], rows: { [`0:0:${ch}`]: note(428) } })));
      const { left, right } = r.render(2000, 44100);
      expect(peak(side === "left" ? left : right), `ch${ch}`).toBeGreaterThan(0.1);
      expect(peak(side === "left" ? right : left), `ch${ch} other side`).toBe(0);
    }
  });

  it("volume scales amplitude and muting a channel silences it", () => {
    const mk = (vol: number) => new ModReplayer(parseMod(build({ samples: [{ ...loud, volume: vol }], rows: { "0:0:0": note(428) } })));
    const full = peak(mk(64).render(1000, 44100).left);
    const half = peak(mk(32).render(1000, 44100).left);
    expect(half / full).toBeCloseTo(0.5, 1);
    const m = mk(64);
    m.setChannelMuted(0, true);
    expect(peak(m.render(1000, 44100).left)).toBe(0);
  });

  it("non-looping samples end; looping samples keep playing; 1-word repeat is not a loop", () => {
    const oneShot = new ModReplayer(parseMod(build({ samples: [{ data: Array(8).fill(100), volume: 64, loop: [0, 1] }], rows: { "0:0:0": note(428) } })));
    oneShot.render(44100, 44100);
    expect(oneShot.channels[0]!.playing).toBe(false);
    const looped = new ModReplayer(parseMod(build({ samples: [loud], rows: { "0:0:0": note(428) } })));
    looped.render(44100, 44100);
    expect(looped.channels[0]!.playing).toBe(true);
  });

  it("playback rate follows the period (period 428 => 8287 samples/s)", () => {
    const r = new ModReplayer(parseMod(build({ samples: [loud], rows: { "0:0:0": note(428) } })));
    r.render(44100, 44100);
    // after 1 s the position advanced ~8287 bytes (wrapped within the 64-byte sample: just check the wrap math ran)
    const full = parseMod(build({ samples: [{ data: Array(20000).fill(5), volume: 64 }], rows: { "0:0:0": note(428) } }));
    const r2 = new ModReplayer(full);
    r2.render(44100, 44100);
    expect(r2.channels[0]!.pos).toBeGreaterThan(8280);
    expect(r2.channels[0]!.pos).toBeLessThan(8295);
  });

  it("linear resampling interpolates between samples", () => {
    const ramp = { data: [0, 100, 0, 100], volume: 64, loop: [0, 2] as [number, number] };
    const mk = (res: "nearest" | "linear") => new ModReplayer(parseMod(build({ samples: [ramp], rows: { "0:0:0": note(428) } })), { resampling: res });
    const n = mk("nearest").render(200, 44100).left;
    const l = mk("linear").render(200, 44100).left;
    const distinct = (a: Float32Array) => new Set(Array.from(a).map((v) => v.toFixed(4))).size;
    expect(distinct(l)).toBeGreaterThan(distinct(n));
  });

  it("renders the generated demo with energy on both sides, deterministically", () => {
    const m = parseMod(readFileSync(fixturePath));
    const a = new ModReplayer(m).render(44100, 44100);
    const b = new ModReplayer(m).render(44100, 44100);
    expect(peak(a.left)).toBeGreaterThan(0.05);
    expect(peak(a.right)).toBeGreaterThan(0.05);
    expect(Array.from(a.left.slice(1000, 1010))).toEqual(Array.from(b.left.slice(1000, 1010)));
    expect(peak(a.left)).toBeLessThanOrEqual(1);
  });
});

function fakeAudio() {
  const sources: Array<{ at: number; buf: { ch: Float32Array[] } }> = [];
  let closed = false, suspended = 0, resumed = 0, now = 0;
  const gain = { value: 1 };
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const ctx: AudioContextLike & { advance(t: number): void } = {
    get currentTime() { return now; },
    sampleRate: 44100,
    destination: {},
    createOscillator: () => ({ connect() {}, type: "", frequency: param(), start() {}, stop() {} }),
    createGain: () => ({ connect() {}, gain: gain as unknown as ReturnType<typeof param> }),
    createBuffer: (_c, len) => ({ ch: [new Float32Array(len), new Float32Array(len)], getChannelData(i: number) { return this.ch[i]!; } }) as never,
    createBufferSource: () => {
      const s: { buffer: unknown; connect(): void; start(t: number): void; stop(): void } = {
        buffer: null, connect() {}, stop() {}, start(t) { sources.push({ at: t, buf: s.buffer as { ch: Float32Array[] } }); }
      };
      return s as never;
    },
    resume: async () => void resumed++,
    suspend: async () => void suspended++,
    close: async () => void (closed = true),
    advance: (t) => void (now = t)
  };
  return { ctx, sources, gain, isClosed: () => closed, suspended: () => suspended, resumed: () => resumed };
}

describe("ModPlayer (Web Audio streaming)", () => {
  it("loads, creates the context lazily, schedules stereo chunks ahead, pauses and stops", () => {
    vi.useFakeTimers();
    const f = fakeAudio();
    let created = 0;
    const p = new ModPlayer(() => { created++; return f.ctx; });
    p.load(readFileSync(fixturePath));
    expect(p.title).toBe("RGME DEMO TUNE");
    expect(created).toBe(0);
    p.start();
    expect(created).toBe(1);
    expect(p.state).toBe("playing");
    expect(f.sources.length).toBeGreaterThan(5); // 0.4 s lookahead worth of chunks
    const times = f.sources.map((s) => s.at);
    expect(times[1]! - times[0]!).toBeCloseTo(2048 / 44100, 6);
    expect(Math.max(...f.sources[3]!.buf.ch[0]!)).toBeGreaterThan(0);
    f.ctx.advance(1);
    vi.advanceTimersByTime(60);
    expect(f.sources.length).toBeGreaterThan(20);
    expect(p.positionInfo()).not.toBeNull();
    p.pause();
    expect(p.state).toBe("paused");
    expect(f.suspended()).toBe(1);
    p.setVolume(0.25);
    expect(f.gain.value).toBe(0.25);
    p.setMuted(true);
    expect(f.gain.value).toBe(0);
    p.setMuted(false);
    expect(f.gain.value).toBe(0.25);
    p.stop();
    expect(p.state).toBe("idle");
    expect(f.isClosed()).toBe(true);
    vi.useRealTimers();
  });

  it("is a no-op without Web Audio; rejects start without a module and bad files", () => {
    const p = new ModPlayer(() => undefined);
    expect(() => p.start()).toThrow(/No module/);
    expect(() => p.load(new Uint8Array(5))).toThrow(ModError);
    p.load(readFileSync(fixturePath));
    expect(() => { p.start(); p.pause(); p.stop(); p.setMuted(true); p.setVolume(0.5); }).not.toThrow();
  });
});
