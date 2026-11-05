import type { AudioContextLike, AudioNodeLike, AudioSink, BufferLike, GainLike } from "../chiptune.js";

export interface SeqEvent {
  step: number;
  ch: number;
  kind: string;
  midi?: number;
  steps: number;
  gain: number;
}

export interface PlayHelpers {
  ctx: AudioContextLike;
  /** Node voices connect to (master, or a filter in front of it). */
  bus: AudioNodeLike;
  noise: BufferLike;
}

export interface SequencerConfig {
  events: SeqEvent[];
  songSteps: number;
  stepSeconds: number;
  masterGain?: number;
  /** Optional processing stage between voices and master (e.g. a SID-style low-pass). */
  buildBus?: (ctx: AudioContextLike, master: GainLike) => AudioNodeLike;
  play: (h: PlayHelpers, e: SeqEvent, t: number) => void;
}

const LOOKAHEAD = 0.25;

/** Lazy, looping, look-ahead step sequencer over structural Web Audio types. No-op where Web Audio is unavailable. */
export class StepSequencer implements AudioSink {
  private ctx?: AudioContextLike;
  private master?: GainLike;
  private helpers?: PlayHelpers;
  private timer?: ReturnType<typeof setInterval>;
  private nextStep = 0;
  private nextTime = 0;
  private muted = false;
  scheduledEvents = 0;

  constructor(
    private readonly createContext: () => AudioContextLike | undefined,
    private readonly cfg: SequencerConfig
  ) {}

  private ensure(): AudioContextLike | undefined {
    if (this.ctx) return this.ctx;
    const ctx = this.createContext();
    if (!ctx) return undefined;
    this.ctx = ctx;
    this.master = ctx.createGain();
    const level = this.cfg.masterGain ?? 0.4;
    this.master.gain.value = this.muted ? 0 : level;
    this.master.connect(ctx.destination);
    const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0);
    let seed = 0x2468ace1;
    for (let i = 0; i < d.length; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      d[i] = (seed / 0xffffffff) * 2 - 1;
    }
    this.helpers = { ctx, bus: this.cfg.buildBus ? this.cfg.buildBus(ctx, this.master) : this.master, noise };
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
    this.helpers = undefined;
  }
  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : (this.cfg.masterGain ?? 0.4);
  }

  /** Schedules every step that starts before currentTime + look-ahead. Public for deterministic tests. */
  pump() {
    const ctx = this.ctx;
    const h = this.helpers;
    if (!ctx || !h) return;
    while (this.nextTime < ctx.currentTime + LOOKAHEAD) {
      const step = this.nextStep % this.cfg.songSteps;
      for (const e of this.cfg.events) {
        if (e.step === step) {
          this.cfg.play(h, e, this.nextTime);
          this.scheduledEvents++;
        }
      }
      this.nextStep++;
      this.nextTime += this.cfg.stepSeconds;
    }
  }

  private clear() {
    if (this.timer !== undefined) clearInterval(this.timer);
    this.timer = undefined;
  }
}
