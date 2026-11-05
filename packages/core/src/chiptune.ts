/** Procedural 4-channel "Paula-style" chiptune. Original composition (fast minor arpeggios + driving bass), no sampled or copied material. */

export interface SongEvent {
  step: number;
  channel: 0 | 1 | 2 | 3;
  kind: "tone" | "kick" | "snare" | "hat";
  midi?: number;
  steps: number;
  gain: number;
}

export const BPM = 150;
export const STEP_SECONDS = 60 / BPM / 4; // 16th note
export const SONG_STEPS = 128; // 8 bars x 16
/** Amiga hard panning: channels 0 and 3 left, 1 and 2 right. */
export const CHANNEL_PAN: Record<0 | 1 | 2 | 3, number> = { 0: -1, 1: 1, 2: 1, 3: -1 };

export const midiToHz = (m: number) => 440 * 2 ** ((m - 69) / 12);

interface Chord { root: number; tones: number[] }
const minor = (root: number): Chord => ({ root, tones: [0, 3, 7, 12, 15].map((i) => root + i) });
const major = (root: number): Chord => ({ root, tones: [0, 4, 7, 12, 16].map((i) => root + i) });
// A minor: Am Am F G | Am Am F E
const PROGRESSION: Chord[] = [minor(57), minor(57), major(53), major(55), minor(57), minor(57), major(53), major(52)];
const ARP = [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 4, 3, 2, 1];
const BASS = [0, 0, 12, 0, 0, 12, 0, 7];

export function buildSong(): SongEvent[] {
  const ev: SongEvent[] = [];
  PROGRESSION.forEach((chord, bar) => {
    const base = bar * 16;
    const second = bar >= 4;
    for (let s = 0; s < 16; s++) {
      const step = base + s;
      // ch0 lead: relentless 16th arpeggio (octave up in the second half)
      ev.push({ step, channel: 0, kind: "tone", midi: chord.tones[ARP[s]!]! + (second ? 24 : 12), steps: 1, gain: 0.5 });
      // ch1 bass: eighth-note pump
      if (s % 2 === 0) ev.push({ step, channel: 1, kind: "tone", midi: chord.root - 12 + BASS[(s / 2) % BASS.length]!, steps: 2, gain: 0.7 });
      // ch2 counter-line: held chord colour, melodic in the second half
      if (s % 4 === 0) ev.push({ step, channel: 2, kind: "tone", midi: chord.tones[second ? [2, 4, 3, 4][s / 4]! : [1, 2][(s / 4) % 2]!]! + 12, steps: second ? 4 : 3, gain: 0.35 });
      // ch3 drums
      if (s % 4 === 0) ev.push({ step, channel: 3, kind: "kick", steps: 2, gain: 0.9 });
      if (s % 8 === 4) ev.push({ step, channel: 3, kind: "snare", steps: 2, gain: 0.6 });
      if (second ? true : s % 2 === 0) ev.push({ step, channel: 3, kind: "hat", steps: 1, gain: 0.18 });
    }
  });
  return ev;
}

// ---- minimal structural Web Audio types (satisfied by the real AudioContext) ----
export interface AudioParamLike {
  value: number;
  setValueAtTime(v: number, t: number): unknown;
  linearRampToValueAtTime(v: number, t: number): unknown;
  exponentialRampToValueAtTime(v: number, t: number): unknown;
}
export interface AudioNodeLike { connect(dest: unknown): unknown; disconnect?(): void }
export interface OscillatorLike extends AudioNodeLike {
  type: string;
  frequency: AudioParamLike;
  start(t: number): void;
  stop(t: number): void;
}
export interface GainLike extends AudioNodeLike { gain: AudioParamLike }
export interface PannerLike extends AudioNodeLike { pan: AudioParamLike }
export interface BufferLike { getChannelData(c: number): Float32Array }
export interface BufferSourceLike extends AudioNodeLike { buffer: unknown; start(t: number): void; stop(t: number): void }
export interface AudioContextLike {
  readonly currentTime: number;
  readonly sampleRate: number;
  readonly destination: unknown;
  createOscillator(): OscillatorLike;
  createGain(): GainLike;
  createStereoPanner?(): PannerLike;
  createBuffer(channels: number, length: number, rate: number): BufferLike;
  createBufferSource(): BufferSourceLike;
  resume?(): Promise<void>;
  suspend?(): Promise<void>;
  close?(): Promise<void>;
}

export interface AudioSink {
  start(): void;
  pause(): void;
  stop(): void;
  setMuted(muted: boolean): void;
}

const LOOKAHEAD = 0.25;
const WAVES = ["square", "sawtooth", "triangle"] as const;

export class ChiptunePlayer implements AudioSink {
  private ctx?: AudioContextLike;
  private master?: GainLike;
  private noise?: BufferLike;
  private timer?: ReturnType<typeof setInterval>;
  private song = buildSong();
  private nextStep = 0;
  private nextTime = 0;
  private muted = false;
  private panners = new Map<number, AudioNodeLike>();
  scheduledEvents = 0;

  /** The context is created lazily on start() so it happens inside a user gesture. */
  constructor(private readonly createContext: () => AudioContextLike | undefined) {}

  private ensure(): AudioContextLike | undefined {
    if (this.ctx) return this.ctx;
    const ctx = this.createContext();
    if (!ctx) return undefined;
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(ctx.destination);
    const len = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    let seed = 0x1234abcd;
    for (let i = 0; i < len; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0; // deterministic LCG noise
      d[i] = (seed / 0xffffffff) * 2 - 1;
    }
    for (const ch of [0, 1, 2, 3] as const) {
      const p = ctx.createStereoPanner?.();
      if (p) { p.pan.value = CHANNEL_PAN[ch]; p.connect(this.master); this.panners.set(ch, p); }
      else this.panners.set(ch, this.master);
    }
    return ctx;
  }

  start() {
    const ctx = this.ensure();
    if (!ctx) return;
    void ctx.resume?.();
    if (this.timer !== undefined) return;
    if (this.nextTime === 0) this.nextTime = ctx.currentTime + 0.05;
    this.timer = setInterval(() => this.pump(), 50);
    this.pump();
  }
  pause() {
    this.clear();
    void this.ctx?.suspend?.();
  }
  stop() {
    this.clear();
    this.nextStep = 0;
    this.nextTime = 0;
    void this.ctx?.close?.();
    this.ctx = undefined;
    this.master = undefined;
    this.panners.clear();
  }
  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.5;
  }

  /** Schedule all steps that start before currentTime + lookahead. Public for deterministic tests. */
  pump() {
    const ctx = this.ctx;
    if (!ctx) return;
    while (this.nextTime < ctx.currentTime + LOOKAHEAD) {
      const step = this.nextStep % SONG_STEPS;
      for (const e of this.song) if (e.step === step) this.play(e, this.nextTime);
      this.nextStep++;
      this.nextTime += STEP_SECONDS;
    }
  }

  private clear() {
    if (this.timer !== undefined) clearInterval(this.timer);
    this.timer = undefined;
  }

  private play(e: SongEvent, t: number) {
    const ctx = this.ctx!;
    const out = this.panners.get(e.channel)!;
    const dur = e.steps * STEP_SECONDS;
    const g = ctx.createGain();
    g.connect(out);
    this.scheduledEvents++;
    if (e.kind === "tone") {
      const o = ctx.createOscillator();
      o.type = WAVES[e.channel === 1 ? 1 : e.channel === 2 ? 2 : 0]!;
      o.frequency.value = midiToHz(e.midi!);
      g.gain.setValueAtTime(e.gain * 0.5, t);
      g.gain.linearRampToValueAtTime(0.0001, t + dur * 0.95);
      o.connect(g);
      o.start(t);
      o.stop(t + dur);
    } else if (e.kind === "kick") {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(160, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      g.gain.setValueAtTime(e.gain, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.connect(g);
      o.start(t);
      o.stop(t + 0.2);
    } else {
      const n = ctx.createBufferSource();
      n.buffer = this.noise;
      const len = e.kind === "snare" ? 0.12 : 0.035;
      g.gain.setValueAtTime(e.gain, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      n.connect(g);
      n.start(t);
      n.stop(t + len);
    }
  }
}

/** Browser factory; returns undefined where Web Audio is unavailable (tests/SSR). */
export function createBrowserAudioContext(): AudioContextLike | undefined {
  const g = globalThis as unknown as { AudioContext?: new () => AudioContextLike; webkitAudioContext?: new () => AudioContextLike };
  const Ctor = g.AudioContext ?? g.webkitAudioContext;
  return Ctor ? new Ctor() : undefined;
}
