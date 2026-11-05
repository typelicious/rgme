import { midiToHz, type AudioContextLike, type AudioNodeLike, type AudioParamLike, type GainLike } from "../chiptune.js";
import { StepSequencer, type SeqEvent } from "./sequencer.js";

/**
 * SID-STYLE synthesis (3 voices: pulse/saw/triangle/noise with ADSR and a low-pass filter) built on Web Audio.
 * It imitates the character of the MOS 6581/8580; it is NOT a register-level SID emulation.
 * Original composition, D minor, 125 BPM.
 */
export const SID_STEP_SECONDS = 60 / 125 / 4;
export const SID_SONG_STEPS = 64;

const ROOTS = [50, 46, 53, 48]; // Dm, Bb, F, C (bass octave 3)
const MINOR = [0, 3, 7];
const MAJOR = [0, 4, 7];
const QUALITY = [MINOR, MAJOR, MAJOR, MAJOR];

/** Voice 0: pulse bass. Voice 1: sawtooth arpeggio. Voice 2: triangle melody + noise snare (the SID only has 3 voices). */
export function buildSidTune(): SeqEvent[] {
  const ev: SeqEvent[] = [];
  ROOTS.forEach((root, bar) => {
    const tones = QUALITY[bar]!.map((i) => root + i);
    for (let s = 0; s < 16; s++) {
      const step = bar * 16 + s;
      if (s % 2 === 0) ev.push({ step, ch: 0, kind: "pulse", midi: root - 12 + (s % 8 === 6 ? 7 : 0), steps: 2, gain: 0.6 });
      ev.push({ step, ch: 1, kind: "saw", midi: tones[[0, 2, 1, 2][s % 4]!]! + 24, steps: 1, gain: 0.28 });
      if (s === 0 || s === 8) ev.push({ step, ch: 2, kind: "tri", midi: tones[s === 0 ? 2 : 1]! + 12, steps: 6, gain: 0.55 });
      if (s === 4 || s === 12) ev.push({ step, ch: 2, kind: "noise", steps: 2, gain: 0.3 });
    }
  });
  return ev;
}

interface BiquadLike extends AudioNodeLike {
  type: string;
  frequency: AudioParamLike;
}
type FilterCtx = AudioContextLike & { createBiquadFilter?(): BiquadLike };

const WAVE: Record<string, string> = { pulse: "square", saw: "sawtooth", tri: "triangle" };
const ADSR: Record<string, readonly [number, number, number, number]> = {
  pulse: [0.005, 0.08, 0.6, 0.05], saw: [0.003, 0.05, 0.5, 0.03], tri: [0.02, 0.1, 0.8, 0.12], noise: [0.001, 0.06, 0.1, 0.04]
};

export class SidPlayer extends StepSequencer {
  constructor(createContext: () => AudioContextLike | undefined) {
    super(createContext, {
      events: buildSidTune(),
      songSteps: SID_SONG_STEPS,
      stepSeconds: SID_STEP_SECONDS,
      masterGain: 0.35,
      buildBus: (ctx, master: GainLike) => {
        const f = (ctx as FilterCtx).createBiquadFilter?.();
        if (!f) return master;
        f.type = "lowpass";
        f.frequency.value = 3600;
        f.connect(master);
        return f;
      },
      play: ({ ctx, bus, noise }, e, t) => {
        const dur = e.steps * SID_STEP_SECONDS;
        const [a, d, s, r] = ADSR[e.kind]!;
        const g = ctx.createGain();
        g.connect(bus);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(e.gain, t + a);
        g.gain.linearRampToValueAtTime(e.gain * s, t + a + d);
        g.gain.linearRampToValueAtTime(0.0001, t + dur + r);
        if (e.kind === "noise") {
          const n = ctx.createBufferSource();
          n.buffer = noise;
          n.connect(g);
          n.start(t);
          n.stop(t + dur + r);
          return;
        }
        const o = ctx.createOscillator();
        o.type = WAVE[e.kind]!;
        o.frequency.value = midiToHz(e.midi!);
        o.connect(g);
        o.start(t);
        o.stop(t + dur + r);
      }
    });
  }
}
