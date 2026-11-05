import { MAX_PERIOD, MIN_PERIOD, PERIOD_TABLE, finetuneRow, noteIndex, periodToHz, type ModModule } from "./mod-format.js";

export type Resampling = "nearest" | "linear";

export interface ModPosition {
  order: number;
  pattern: number;
  row: number;
  tick: number;
}

export interface ReplayerOptions {
  /** Loop at the end of the song (default true). When false the replayer sets `ended` and renders silence. */
  loop?: boolean;
  resampling?: Resampling;
  masterGain?: number;
}

interface Channel {
  sample: number; // 1-based, 0 = none
  period: number;
  basePeriod: number;
  volume: number;
  pos: number; // fractional byte position
  playing: boolean;
  muted: boolean;
  // current row effect
  effect: number;
  param: number;
}

/**
 * Deterministic ProTracker-style replayer (no Web Audio dependency).
 *
 * Supported effects: 0 arpeggio, 1/2 portamento up/down, A volume slide, B position jump, C set volume,
 * D pattern break (decimal), F set speed (<= 32) / tempo (> 32). Out of scope (ignored): 3/4/5/6/7/9 and all
 * E-effects (including E6x pattern loop and EEx pattern delay).
 *
 * `step()` processes one tick: on tick 0 it reads the row, otherwise it runs per-tick effects; afterwards the
 * position points at the NEXT tick to be processed.
 */
export class ModReplayer {
  speed = 6;
  tempo = 125;
  ended = false;
  loopCount = 0;
  readonly channels: Channel[];
  private order = 0;
  private row = 0;
  private tick = 0;
  private nextOrder = -1;
  private nextRow = -1;
  private tickRemaining = 0;
  private opts: Required<ReplayerOptions>;

  constructor(readonly mod: ModModule, options: ReplayerOptions = {}) {
    this.opts = { loop: options.loop ?? true, resampling: options.resampling ?? "nearest", masterGain: options.masterGain ?? 1 };
    this.channels = Array.from({ length: 4 }, () => ({ sample: 0, period: 0, basePeriod: 0, volume: 0, pos: 0, playing: false, muted: false, effect: 0, param: 0 }));
  }

  setChannelMuted(ch: number, muted: boolean) {
    this.channels[ch]!.muted = muted;
  }
  setResampling(r: Resampling) {
    this.opts.resampling = r;
  }
  setMasterGain(g: number) {
    this.opts.masterGain = g;
  }
  setLoop(loop: boolean) {
    this.opts.loop = loop;
  }

  reset() {
    this.speed = 6;
    this.tempo = 125;
    this.ended = false;
    this.loopCount = 0;
    this.order = this.row = this.tick = 0;
    this.nextOrder = this.nextRow = -1;
    this.tickRemaining = 0;
    for (const c of this.channels) Object.assign(c, { sample: 0, period: 0, basePeriod: 0, volume: 0, pos: 0, playing: false, effect: 0, param: 0 });
  }

  positionInfo(): ModPosition {
    return { order: this.order, pattern: this.mod.orders[this.order] ?? 0, row: this.row, tick: this.tick };
  }

  /** Seconds per tick at the current tempo: 2.5 / BPM. */
  get tickSeconds(): number {
    return 2.5 / this.tempo;
  }

  step() {
    if (this.ended) return;
    if (this.tick === 0) this.processRow();
    else this.processTickEffects();
    this.tick++;
    if (this.tick >= this.speed) {
      this.tick = 0;
      this.advanceRow();
    }
  }

  private processRow() {
    const pattern = this.mod.patterns[this.mod.orders[this.order]!]!;
    const notes = pattern[this.row]!;
    for (let ch = 0; ch < 4; ch++) {
      const n = notes[ch]!;
      const c = this.channels[ch]!;
      c.effect = n.effect;
      c.param = n.param;
      if (n.sample > 0 && n.sample <= 31) {
        c.sample = n.sample;
        c.volume = this.mod.samples[n.sample - 1]!.volume;
      }
      if (n.period > 0) {
        const s = c.sample ? this.mod.samples[c.sample - 1] : undefined;
        const idx = noteIndex(n.period);
        const ftRow = s ? finetuneRow(s.finetune & 15) : 0;
        c.period = PERIOD_TABLE[ftRow]![idx] ?? n.period;
        c.basePeriod = c.period;
        c.pos = 0;
        c.playing = Boolean(c.sample && s && s.length > 0);
      }
      // tick-0 effects
      switch (n.effect) {
        case 0xc:
          c.volume = Math.min(64, n.param);
          break;
        case 0xb:
          this.nextOrder = n.param;
          this.nextRow = 0;
          break;
        case 0xd:
          if (this.nextOrder < 0) this.nextOrder = this.order + 1;
          this.nextRow = Math.min(63, (n.param >> 4) * 10 + (n.param & 15));
          break;
        case 0xf:
          if (n.param === 0) break; // F00 stops in ProTracker; treated as no-op here
          if (n.param <= 32) this.speed = n.param;
          else this.tempo = n.param;
          break;
        default:
          break;
      }
    }
  }

  private processTickEffects() {
    for (const c of this.channels) {
      const x = c.param >> 4, y = c.param & 15;
      switch (c.effect) {
        case 0:
          if (c.param !== 0 && c.basePeriod > 0) {
            const s = c.sample ? this.mod.samples[c.sample - 1] : undefined;
            const row = PERIOD_TABLE[s ? finetuneRow(s.finetune & 15) : 0]!;
            const idx = noteIndex(c.basePeriod);
            const t = this.tick % 3;
            const semis = t === 0 ? 0 : t === 1 ? x : y;
            c.period = row[Math.min(35, idx + semis)] ?? c.basePeriod;
          }
          break;
        case 1:
          c.period = Math.max(MIN_PERIOD, c.period - c.param);
          c.basePeriod = c.period;
          break;
        case 2:
          c.period = Math.min(MAX_PERIOD, c.period + c.param);
          c.basePeriod = c.period;
          break;
        case 0xa:
          c.volume = Math.max(0, Math.min(64, c.volume + (x ? x : -y)));
          break;
        default:
          break;
      }
    }
  }

  private advanceRow() {
    let order = this.order;
    let row = this.row + 1;
    if (this.nextRow >= 0 || this.nextOrder >= 0) {
      order = this.nextOrder >= 0 ? this.nextOrder : order;
      row = this.nextRow >= 0 ? this.nextRow : 0;
      this.nextOrder = this.nextRow = -1;
    } else if (row >= 64) {
      row = 0;
      order++;
    }
    if (row >= 64) {
      row = 0;
      order++;
    }
    if (order >= this.mod.songLength) {
      this.loopCount++;
      if (this.opts.loop) {
        order = this.mod.restart < this.mod.songLength ? this.mod.restart : 0;
      } else {
        this.ended = true;
        for (const c of this.channels) c.playing = false;
        return;
      }
    }
    this.order = order;
    this.row = row;
  }

  /**
   * Mixes `frames` stereo samples. Paula hard panning: channels 0 and 3 left, 1 and 2 right.
   * Each channel is scaled by 0.5 so two voices per side cannot clip.
   */
  render(frames: number, sampleRate: number): { left: Float32Array; right: Float32Array } {
    const left = new Float32Array(frames);
    const right = new Float32Array(frames);
    const linear = this.opts.resampling === "linear";
    const gain = this.opts.masterGain * 0.5;
    for (let i = 0; i < frames; i++) {
      if (this.tickRemaining <= 0) {
        this.step();
        this.tickRemaining += this.tickSeconds * sampleRate;
      }
      this.tickRemaining--;
      if (this.ended) continue;
      for (let ch = 0; ch < 4; ch++) {
        const c = this.channels[ch]!;
        if (!c.playing || c.muted || c.sample === 0) continue;
        const s = this.mod.samples[c.sample - 1]!;
        const loops = s.repeatLength > 2;
        const loopStart = s.repeatStart;
        const loopEnd = Math.min(s.length, s.repeatStart + s.repeatLength);
        let p = c.pos;
        if (p >= (loops ? loopEnd : s.length)) {
          if (loops) p = loopStart + ((p - loopEnd) % (loopEnd - loopStart));
          else { c.playing = false; continue; }
          c.pos = p;
        }
        const i0 = Math.floor(p);
        let v = s.data[i0]! / 128;
        if (linear) {
          let i1 = i0 + 1;
          if (loops && i1 >= loopEnd) i1 = loopStart;
          const v1 = i1 < s.length ? s.data[i1]! / 128 : 0;
          v += (v1 - v) * (p - i0);
        }
        const out = v * (c.volume / 64) * gain;
        if (ch === 0 || ch === 3) left[i] = (left[i] ?? 0) + out;
        else right[i] = (right[i] ?? 0) + out;
        c.pos += periodToHz(c.period) / sampleRate;
      }
    }
    return { left, right };
  }
}
