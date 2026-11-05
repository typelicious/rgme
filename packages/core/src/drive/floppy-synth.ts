import type { AudioContextLike, AudioParamLike, AudioNodeLike, BufferLike } from "../chiptune.js";
import type { FloppyController, FloppyEvent } from "./floppy-controller.js";

interface BiquadLike extends AudioNodeLike {
  type: string;
  frequency: AudioParamLike;
  Q: AudioParamLike;
}
export type FloppyAudioContext = AudioContextLike & { createBiquadFilter?(): BiquadLike };

/** Spacing between consecutive step clacks of one seek (rapid mechanical buzz). */
export const STEP_SPACING = 0.004;

/** Synthesizes mechanical Amiga drive sounds (step clack, seek chirp, track-0 click, spin hum) from FloppyController events. */
export class FloppySoundSynth {
  private ctx?: FloppyAudioContext;
  private master?: ReturnType<AudioContextLike["createGain"]>;
  private noise?: BufferLike;
  private muted = false;
  private lastStep = 0;
  private hum = new Map<number, { stop(t: number): void }>();
  /** Number of sound events scheduled (for tests/diagnostics). */
  played = 0;

  /** Context is created lazily on the first sound so it happens inside a user gesture. */
  constructor(private readonly createContext: () => FloppyAudioContext | undefined) {}

  attach(controller: FloppyController): () => void {
    return controller.onEvent((e) => this.handle(e));
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.6;
  }

  private ensure(): FloppyAudioContext | undefined {
    if (this.ctx) return this.ctx;
    const ctx = this.createContext();
    if (!ctx) return undefined;
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.6;
    this.master.connect(ctx.destination);
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    let seed = 0x9e3779b1;
    for (let i = 0; i < d.length; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      d[i] = (seed / 0xffffffff) * 2 - 1;
    }
    return ctx;
  }

  handle(e: FloppyEvent) {
    if (e.type === "step") this.clack(0.5);
    else if (e.type === "track0") this.clack(1, true);
    else if (e.type === "seek" && e.steps > 3) this.chirp(e.steps);
    else if (e.type === "motor") this.spin(e.drive, e.on);
    else if (e.type === "insert" || e.type === "eject") this.clack(0.8, true);
  }

  private connectChain(src: AudioNodeLike, gain: number, t: number, dur: number, filterHz?: number) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let tail: AudioNodeLike = src;
    const f = filterHz ? ctx.createBiquadFilter?.() : undefined;
    if (f) {
      f.type = "bandpass";
      f.frequency.value = filterHz!;
      f.Q.value = 1.2;
      src.connect(f);
      tail = f;
    }
    tail.connect(g);
    g.connect(this.master!);
  }

  /** Short filtered-noise click plus a low thud. */
  private clack(level: number, heavy = false) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = Math.max(ctx.currentTime, this.lastStep + STEP_SPACING);
    this.lastStep = t;
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    this.connectChain(n, 0.5 * level, t, heavy ? 0.04 : 0.02, heavy ? 1800 : 2600);
    n.start(t);
    n.stop(t + 0.05);
    const o = ctx.createOscillator();
    o.type = "square";
    o.frequency.value = heavy ? 70 : 110;
    this.connectChain(o, 0.35 * level, t, heavy ? 0.06 : 0.025);
    o.start(t);
    o.stop(t + 0.07);
    this.played++;
  }

  /** Rapid downward/upward whirr for longer seeks. */
  private chirp(steps: number) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const dur = Math.min(0.08 + steps * STEP_SPACING, 0.4);
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(260, t);
    o.frequency.exponentialRampToValueAtTime(900, t + dur);
    this.connectChain(o, 0.12, t, dur, 1400);
    o.start(t);
    o.stop(t + dur + 0.01);
    this.played++;
  }

  private spin(drive: number, on: boolean) {
    const ctx = this.ensure();
    if (!ctx) return;
    const existing = this.hum.get(drive);
    if (!on) {
      existing?.stop(ctx.currentTime);
      this.hum.delete(drive);
      return;
    }
    if (existing) return;
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = 48 + drive * 2;
    const g = ctx.createGain();
    g.gain.value = 0.04;
    o.connect(g);
    g.connect(this.master!);
    o.start(ctx.currentTime);
    this.hum.set(drive, o);
    this.played++;
  }

  dispose() {
    for (const h of this.hum.values()) h.stop(this.ctx?.currentTime ?? 0);
    this.hum.clear();
    void this.ctx?.close?.();
    this.ctx = undefined;
    this.master = undefined;
  }
}
