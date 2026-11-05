/**
 * PAL frame timing model used to size the per-frame CPU cycle budget handed to a core.
 * This is a *budget model*, not an emulation: it tells the core how many CPU cycles a PAL frame
 * contains; whether the core executes them faithfully is up to the core.
 *
 *   1 colour clock = 2 CPU cycles (68000 @ 7.09379 MHz, PAL)
 *   312 lines x 227 colour clocks x 2 = 141,648 CPU cycles per (short) frame
 */
export const PAL_LINES = 312;
export const PAL_COLOR_CLOCKS_PER_LINE = 227;
export const CPU_CYCLES_PER_COLOR_CLOCK = 2;
export const PAL_CPU_HZ = 7_093_790;
export const PAL_CYCLES_PER_FRAME = PAL_LINES * PAL_COLOR_CLOCKS_PER_LINE * CPU_CYCLES_PER_COLOR_CLOCK;
/** Pacing rate of the host loop (the RGME UI contract is a 50 Hz PAL frame clock). */
export const PAL_FRAME_RATE_HZ = 50;
export const PAL_FRAME_MS = 1000 / PAL_FRAME_RATE_HZ;

export interface SchedulerClock {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export const REAL_CLOCK: SchedulerClock = {
  now: () => (typeof performance !== "undefined" ? performance.now() : Date.now()),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>)
};

/**
 * Drift-correcting frame scheduler: frame n is due at start + n*frameMs regardless of timer jitter.
 * If the host falls behind it catches up (at most `maxCatchUp` frames per tick); beyond that it
 * resynchronises instead of spiralling.
 */
export class FrameScheduler {
  private handle: unknown;
  private startedAt = 0;
  private emitted = 0;
  private running = false;

  constructor(
    private readonly onFrame: () => void,
    private readonly clock: SchedulerClock = REAL_CLOCK,
    private readonly frameMs = PAL_FRAME_MS,
    private readonly maxCatchUp = 5
  ) {}

  get isRunning() {
    return this.running;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.startedAt = this.clock.now();
    this.emitted = 0;
    this.arm();
  }

  stop() {
    this.running = false;
    if (this.handle !== undefined) this.clock.clearTimeout(this.handle);
    this.handle = undefined;
  }

  private arm() {
    const due = this.startedAt + (this.emitted + 1) * this.frameMs;
    this.handle = this.clock.setTimeout(() => this.tick(), Math.max(0, due - this.clock.now()));
  }

  private tick() {
    if (!this.running) return;
    const elapsed = this.clock.now() - this.startedAt;
    let behind = Math.floor(elapsed / this.frameMs) - this.emitted;
    if (behind > this.maxCatchUp) {
      // Too far behind (tab was throttled): drop the backlog and resync the timeline.
      this.startedAt = this.clock.now() - this.maxCatchUp * this.frameMs;
      this.emitted = 0;
      behind = this.maxCatchUp;
    }
    for (let i = 0; i < Math.max(1, behind) && this.running; i++) {
      this.emitted++;
      this.onFrame();
    }
    if (this.running) this.arm();
  }
}
