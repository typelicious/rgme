import { describe, it, expect } from "vitest";
import { ModReplayer, ModPlayer, type ModModule } from "../index.js";

function dummyMod(patternRows: Array<[number, number, number, number][]>): ModModule {
  const sample = {
    name: "test-sample",
    length: 1024,
    finetune: 0,
    volume: 64,
    repeatStart: 0,
    repeatLength: 0,
    data: new Int8Array(1024).fill(64)
  };
  const samples = Array.from({ length: 31 }, (_, i) => (i === 0 ? sample : {
    name: "", length: 0, finetune: 0, volume: 0, repeatStart: 0, repeatLength: 0, data: new Int8Array(0)
  }));

  // Build pattern
  const rows = patternRows.map((r) =>
    r.map(([sample, period, effect, param]) => ({ sample, period, effect, param }))
  );
  while (rows.length < 64) {
    rows.push(Array.from({ length: 4 }, () => ({ sample: 0, period: 0, effect: 0, param: 0 })));
  }

  return {
    title: "Extended Effects Test",
    samples,
    songLength: 1,
    restart: 0,
    orders: [0],
    patterns: [rows],
    signature: "M.K."
  };
}

describe("Extended ProTracker Effects (Lane 2 / MOD-EXT-001)", () => {
  it("processes Effect 3 (Tone Portamento) toward target note period", () => {
    // Row 0: Play note at period 428 (C-2)
    // Row 1: Note C-3 (period 214) with effect 3, speed 10
    const mod = dummyMod([
      [[1, 428, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
      [[0, 214, 3, 10], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]
    ]);
    const rep = new ModReplayer(mod);
    rep.speed = 4;

    // Step through row 0 (4 ticks)
    for (let i = 0; i < 4; i++) rep.step();
    expect(rep.channels[0]!.period).toBe(428);

    // Step to row 1 tick 0
    rep.step();
    expect(rep.channels[0]!.portaTarget).toBe(214);
    expect(rep.channels[0]!.portaSpeed).toBe(10);
    expect(rep.channels[0]!.period).toBe(428); // unchanged on tick 0

    // Next tick: period should slide down by 10 (toward 214)
    rep.step();
    expect(rep.channels[0]!.period).toBe(418);
    rep.step();
    expect(rep.channels[0]!.period).toBe(408);
  });

  it("processes Effect 4 (Vibrato) with sine wave modulation", () => {
    // Row 0: Play note at period 428 with effect 4, speed 4, depth 8 (param 0x48)
    const mod = dummyMod([
      [[1, 428, 4, 0x48], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]
    ]);
    const rep = new ModReplayer(mod);
    rep.speed = 4;

    rep.step(); // tick 0
    expect(rep.channels[0]!.period).toBe(428);
    expect(rep.channels[0]!.vibratoSpeed).toBe(4);
    expect(rep.channels[0]!.vibratoDepth).toBe(8);

    rep.step(); // tick 1: vibrato advances pos
    rep.step(); // tick 2: sine table value > 0 modifies period
    // Period oscillates around basePeriod 428
    expect(rep.channels[0]!.period).not.toBe(428);
    expect(rep.channels[0]!.basePeriod).toBe(428);
  });

  it("processes Effect 9 (Sample Offset)", () => {
    // Row 0: Play note with effect 9, offset $02 -> position = 2 * 256 = 512
    const mod = dummyMod([
      [[1, 428, 9, 0x02], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]
    ]);
    const rep = new ModReplayer(mod);
    rep.step(); // tick 0
    expect(rep.channels[0]!.pos).toBe(512);
  });

  it("processes E-effects (Fine Porta, Note Cut, Fine Volslide)", () => {
    // Row 0: Play note, E12 (Fine Porta Up by 2), EAy (Fine Volslide)
    const mod = dummyMod([
      [[1, 428, 0xe, 0x12], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
      [[0, 0, 0xe, 0xc2], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]] // EC2: Note cut at tick 2
    ]);
    const rep = new ModReplayer(mod);
    rep.speed = 4;

    rep.step(); // row 0 tick 0
    expect(rep.channels[0]!.period).toBe(426); // 428 - 2

    // Finish row 0
    rep.step(); rep.step(); rep.step();

    // Row 1 tick 0: volume starts at 64
    rep.step();
    expect(rep.channels[0]!.volume).toBe(64);
    rep.step(); // tick 1
    expect(rep.channels[0]!.volume).toBe(64);
    rep.step(); // tick 2 -> EC2 cuts volume to 0
    expect(rep.channels[0]!.volume).toBe(0);
  });

  it("exposes live channel levels and waveform buffer in ModPlayer", () => {
    let playedData: Float32Array | null = null;
    const fakeCtx = {
      currentTime: 0,
      sampleRate: 44100,
      destination: {},
      createGain: () => ({ gain: { value: 1 }, connect: () => {} }),
      createBuffer: (_ch: number, frames: number) => ({
        getChannelData: () => new Float32Array(frames)
      }),
      createBufferSource: () => ({
        buffer: null,
        connect: () => {},
        start: () => {}
      })
    };

    const player = new ModPlayer(() => fakeCtx as any);
    const mod = dummyMod([
      [[1, 428, 0xc, 48], [1, 428, 0xc, 32], [0, 0, 0, 0], [1, 428, 0xc, 64]]
    ]);
    (player as any).mod = mod;
    (player as any).replayer = new ModReplayer(mod);
    (player as any)._state = "playing";

    // Step first row so volumes are set
    (player as any).replayer.step();

    const levels = player.getChannelLevels();
    expect(levels[0]).toBeCloseTo(48 / 64, 2);
    expect(levels[1]).toBeCloseTo(32 / 64, 2);
    expect(levels[2]).toBe(0); // channel 2 not playing
    expect(levels[3]).toBeCloseTo(64 / 64, 2);

    const wave = player.getWaveformData();
    expect(wave.length).toBe(512);
  });
});
