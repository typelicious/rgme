import type { AudioContextLike, AudioSink, GainLike } from "../chiptune.js";
import { ModError, parseMod, type ModModule } from "./mod-format.js";
import { ModReplayer, type ModPosition } from "./mod-replayer.js";

export type ModPlayerState = "idle" | "playing" | "paused";

const LOOKAHEAD = 0.4; // seconds scheduled ahead
const CHUNK_FRAMES = 2048;

/**
 * Web Audio streaming wrapper around ModReplayer: renders chunks and schedules AudioBufferSources ahead of
 * the clock (same approach as ChiptunePlayer). The AudioContext is created lazily on start() so that it
 * happens inside a user gesture; without Web Audio every method is a safe no-op.
 */
export class ModPlayer implements AudioSink {
  private mod?: ModModule;
  private replayer?: ModReplayer;
  private ctx?: AudioContextLike;
  private master?: GainLike;
  private timer?: ReturnType<typeof setInterval>;
  private nextTime = 0;
  private muted = false;
  private volume = 1;
  private _state: ModPlayerState = "idle";
  scheduledChunks = 0;
  private lastWaveform = new Float32Array(512);

  constructor(private readonly createContext: () => AudioContextLike | undefined) {}

  get title(): string {
    return this.mod?.title ?? "";
  }
  get state(): ModPlayerState {
    return this._state;
  }
  get module(): ModModule | undefined {
    return this.mod;
  }

  /** Returns normalized volume level [0..1] for channels 0..3 for live VU-meters. */
  getChannelLevels(): [number, number, number, number] {
    if (!this.replayer || this._state !== "playing") return [0, 0, 0, 0];
    return this.replayer.channels.map((c) => (c.playing && !c.muted ? (c.volume / 64) * this.volume : 0)) as [
      number,
      number,
      number,
      number
    ];
  }

  /** Returns recent 512-sample mono PCM chunk for oscilloscope visualizers. */
  getWaveformData(): Float32Array {
    return this.lastWaveform;
  }

  /** Parses a module (throws ModError on unsupported/invalid files) and resets playback. */
  load(bytes: Uint8Array) {
    const mod = parseMod(bytes);
    this.stop();
    this.mod = mod;
    this.replayer = new ModReplayer(mod);
  }

  positionInfo(): ModPosition | null {
    return this.replayer ? this.replayer.positionInfo() : null;
  }

  private ensure(): AudioContextLike | undefined {
    if (this.ctx) return this.ctx;
    const ctx = this.createContext();
    if (!ctx) return undefined;
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    this.master.connect(ctx.destination);
    return ctx;
  }

  start() {
    if (!this.replayer) throw new ModError("No module loaded.");
    const ctx = this.ensure();
    if (!ctx) return;
    void ctx.resume?.();
    if (this.timer !== undefined) return;
    if (this.nextTime === 0) this.nextTime = ctx.currentTime + 0.05;
    this._state = "playing";
    this.timer = setInterval(() => this.pump(), 50);
    this.pump();
  }

  pause() {
    if (this._state !== "playing") return;
    this.clear();
    this._state = "paused";
    void this.ctx?.suspend?.();
  }

  stop() {
    this.clear();
    this.replayer?.reset();
    this.nextTime = 0;
    void this.ctx?.close?.();
    this.ctx = undefined;
    this.master = undefined;
    this._state = "idle";
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : this.volume;
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master && !this.muted) this.master.gain.value = this.volume;
  }

  /** Schedule chunks that start before currentTime + lookahead. Public for deterministic tests. */
  pump() {
    const ctx = this.ctx;
    const rep = this.replayer;
    if (!ctx || !rep) return;
    while (this.nextTime < ctx.currentTime + LOOKAHEAD) {
      const { left, right } = rep.render(CHUNK_FRAMES, ctx.sampleRate);
      for (let i = 0; i < 512; i++) {
        this.lastWaveform[i] = ((left[i] ?? 0) + (right[i] ?? 0)) * 0.5;
      }
      const buf = ctx.createBuffer(2, CHUNK_FRAMES, ctx.sampleRate);
      buf.getChannelData(0).set(left);
      buf.getChannelData(1).set(right);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.master!);
      src.start(this.nextTime);
      this.nextTime += CHUNK_FRAMES / ctx.sampleRate;
      this.scheduledChunks++;
      if (rep.ended) {
        // let the queued audio play out, then go idle
        this.clear();
        this._state = "paused";
        break;
      }
    }
  }

  private clear() {
    if (this.timer !== undefined) clearInterval(this.timer);
    this.timer = undefined;
  }
}
