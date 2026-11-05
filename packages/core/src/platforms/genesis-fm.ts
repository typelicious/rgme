import { midiToHz, type AudioContextLike } from "../chiptune.js";
import { StepSequencer, type SeqEvent } from "./sequencer.js";

/**
 * FM-STYLE synthesis in the spirit of the YM2612 (2-operator phase modulation: carrier + modulator with a decaying
 * modulation index) plus PSG-style square/noise voices. NOT a register-level YM2612/SN76489 emulation.
 * Original composition, E minor, 120 BPM.
 */
export const FM_STEP_SECONDS = 60 / 120 / 4;
export const FM_SONG_STEPS = 64;

const ROOTS = [52, 48, 50, 47]; // Em, C, D, B
const QUALITY = [[0, 3, 7], [0, 4, 7], [0, 4, 7], [0, 4, 7]];

/** ch0 FM bass (slap), ch1 FM bell lead, ch2 PSG square arpeggio, ch3 PSG noise percussion. */
export function buildFmTune(): SeqEvent[] {
  const ev: SeqEvent[] = [];
  ROOTS.forEach((root, bar) => {
    const tones = QUALITY[bar]!.map((i) => root + i);
    for (let s = 0; s < 16; s++) {
      const step = bar * 16 + s;
      if (s % 2 === 0) ev.push({ step, ch: 0, kind: "fm-bass", midi: root - 12, steps: 2, gain: 0.6 });
      if ([0, 3, 6, 8, 11, 14].includes(s)) ev.push({ step, ch: 1, kind: "fm-bell", midi: tones[[2, 1, 0, 2, 1, 0][[0, 3, 6, 8, 11, 14].indexOf(s)]!]! + 24, steps: 2, gain: 0.35 });
      ev.push({ step, ch: 2, kind: "psg-square", midi: tones[[0, 1, 2, 1][s % 4]!]! + 24, steps: 1, gain: 0.1 });
      if (s % 2 === 0) ev.push({ step, ch: 3, kind: "psg-noise", steps: s % 8 === 4 ? 2 : 1, gain: s % 8 === 4 ? 0.2 : 0.08 });
    }
  });
  return ev;
}

const FM_PRESETS: Record<string, { ratio: number; index: number; decay: number }> = {
  "fm-bass": { ratio: 1, index: 3.2, decay: 0.12 },
  "fm-bell": { ratio: 3.5, index: 2.2, decay: 0.5 }
};

export class FmPlayer extends StepSequencer {
  constructor(createContext: () => AudioContextLike | undefined) {
    super(createContext, {
      events: buildFmTune(),
      songSteps: FM_SONG_STEPS,
      stepSeconds: FM_STEP_SECONDS,
      masterGain: 0.35,
      play: ({ ctx, bus, noise }, e, t) => {
        const dur = e.steps * FM_STEP_SECONDS;
        const g = ctx.createGain();
        g.connect(bus);
        if (e.kind === "psg-noise") {
          const n = ctx.createBufferSource();
          n.buffer = noise;
          g.gain.setValueAtTime(e.gain, t);
          g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
          n.connect(g);
          n.start(t);
          n.stop(t + dur);
          return;
        }
        const f = midiToHz(e.midi!);
        if (e.kind === "psg-square") {
          const o = ctx.createOscillator();
          o.type = "square";
          o.frequency.value = f;
          g.gain.setValueAtTime(e.gain, t);
          g.gain.linearRampToValueAtTime(0.0001, t + dur * 0.9);
          o.connect(g);
          o.start(t);
          o.stop(t + dur);
          return;
        }
        const p = FM_PRESETS[e.kind]!;
        const carrier = ctx.createOscillator();
        const mod = ctx.createOscillator();
        const modGain = ctx.createGain();
        carrier.type = "sine";
        mod.type = "sine";
        carrier.frequency.value = f;
        mod.frequency.value = f * p.ratio;
        modGain.gain.setValueAtTime(f * p.index, t);
        modGain.gain.exponentialRampToValueAtTime(Math.max(0.01, f * 0.05), t + p.decay + dur * 0.5);
        mod.connect(modGain);
        modGain.connect(carrier.frequency); // modulation index drives the carrier frequency
        g.gain.setValueAtTime(e.gain, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur + p.decay);
        carrier.connect(g);
        carrier.start(t);
        mod.start(t);
        carrier.stop(t + dur + p.decay);
        mod.stop(t + dur + p.decay);
      }
    });
  }
}
