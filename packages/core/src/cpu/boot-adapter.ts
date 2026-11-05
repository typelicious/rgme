import type { DisplayProfile, GameProfile, InputMapping, Media } from "../profile.js";
import type { RuntimeAdapter, RuntimeCapabilities, RuntimeState, RuntimeStatus, SaveStateMeta } from "../runtime.js";
import type { CanvasLike } from "../mock-runtime.js";
import { FrameScheduler, PAL_FRAME_RATE_HZ, REAL_CLOCK, type SchedulerClock } from "../wasm/timing.js";
import { AmigaBootMachine, DISPLAY_FIRST_LINE, type FrameResult, type MachineSnapshot } from "./amiga-boot.js";

export type BootMediaProvider = (media: Media) => Uint8Array | Promise<Uint8Array>;

export interface M68kBootAdapterOptions {
  mediaProvider: BootMediaProvider;
  canvas?: CanvasLike;
  clock?: SchedulerClock;
}

export type BootCapabilities = RuntimeCapabilities & { emulation: "partial-68000" };

const hex12 = (c: number) => {
  const r = ((c >> 8) & 0xf) * 17, g = ((c >> 4) & 0xf) * 17, b = (c & 0xf) * 17;
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
};

/**
 * Runs a disk's BOOTBLOCK on the partial 68000 interpreter (see amiga-boot.ts for the honest scope).
 * It does not boot Kickstart/AmigaOS; programs that call exec/trackdisk stop with an explicit error shown on screen.
 */
export class M68kBootAdapter implements RuntimeAdapter {
  private _state: RuntimeState = "UNLOADED";
  private machine = new AmigaBootMachine();
  private profile?: GameProfile;
  private bootBytes?: Uint8Array;
  private media: Media[] = [];
  private frame = 0;
  private pressed = new Set<string>();
  private mapping?: InputMapping;
  private display?: DisplayProfile;
  private slots = new Map<number, { meta: SaveStateMeta; snap: MachineSnapshot }>();
  private listeners = new Set<(s: RuntimeStatus) => void>();
  private readonly scheduler: FrameScheduler;
  private last?: FrameResult;

  constructor(private readonly opts: M68kBootAdapterOptions) {
    this.scheduler = new FrameScheduler(() => this.stepFrame(), opts.clock ?? REAL_CLOCK);
    if (opts.canvas) {
      opts.canvas.width = 320;
      opts.canvas.height = 256;
    }
  }

  get state() { return this._state; }
  get currentFrame() { return this.frame; }
  get cpuMachine() { return this.machine; }
  get lastFrame() { return this.last; }
  get activeInputs(): string[] { return [...this.pressed].sort(); }
  get currentMedia(): readonly Media[] { return this.media; }
  get currentMapping() { return this.mapping; }
  get currentDisplay() { return this.display; }

  identifyCapabilities(): BootCapabilities {
    return { id: "m68k-boot", name: "RGME 68000 bootblock runner (partial)", videoStandards: ["PAL"], frameRateHz: PAL_FRAME_RATE_HZ, saveStates: true, audio: false, emulation: "partial-68000" };
  }

  async loadGame(profile: GameProfile): Promise<void> {
    if (profile.platform !== "amiga") throw new Error(`M68kBootAdapter only runs Amiga profiles, got "${profile.platform}"`);
    this.scheduler.stop();
    const boot = profile.media.find((m) => m.id === profile.launch.bootMediaId) ?? profile.media[0]!;
    const bytes = await this.opts.mediaProvider(boot);
    const machine = new AmigaBootMachine();
    machine.loadBootblock(bytes); // throws BootblockError for non-bootable disks
    this.machine = machine;
    this.bootBytes = bytes; // read-only; never modified
    this.profile = profile;
    this.media = [boot];
    this.mapping = profile.input;
    this.display = profile.display;
    this.frame = 0;
    this.pressed.clear();
    this.slots.clear();
    this.last = undefined;
    this._state = "LOADED";
    this.draw();
    this.emit();
  }

  start() {
    this.transition(["LOADED", "PAUSED"], "RUNNING", "start");
    this.scheduler.start();
    this.emit();
  }
  pause() {
    this.transition(["RUNNING"], "PAUSED", "pause");
    this.scheduler.stop();
    this.emit();
  }
  reset() {
    if (this._state === "UNLOADED" || !this.bootBytes) throw new Error("Cannot reset while UNLOADED");
    const wasRunning = this._state === "RUNNING";
    this.scheduler.stop();
    this.machine = new AmigaBootMachine();
    this.machine.loadBootblock(this.bootBytes);
    this.frame = 0;
    this.last = undefined;
    this._state = "LOADED";
    this.draw();
    if (wasRunning) this.start();
    else this.emit();
  }
  stop() {
    this.transition(["LOADED", "RUNNING", "PAUSED"], "STOPPED", "stop");
    this.scheduler.stop();
    this.emit();
  }
  dispose() {
    this.scheduler.stop();
    this.listeners.clear();
  }

  /** Runs exactly one PAL frame of CPU execution and redraws (also used by the scheduler; deterministic in tests). */
  stepFrame(): FrameResult | undefined {
    if (this._state !== "RUNNING" && this._state !== "LOADED" && this._state !== "PAUSED") return undefined;
    this.last = this.machine.runFrame();
    this.frame++;
    this.draw();
    this.emit();
    return this.last;
  }

  saveState(slot: number): SaveStateMeta {
    this.assertLive("save");
    this.assertSlot(slot);
    const meta = { slot, savedAt: Date.now(), frame: this.frame, profileId: this.profile!.id };
    this.slots.set(slot, { meta, snap: this.machine.snapshot() });
    return meta;
  }
  loadState(slot: number): SaveStateMeta {
    this.assertLive("load state");
    this.assertSlot(slot);
    const s = this.slots.get(slot);
    if (!s) throw new Error(`Save slot ${slot} is empty`);
    this.machine.restore(s.snap);
    this.frame = s.meta.frame;
    this.draw();
    this.emit();
    return s.meta;
  }

  setInputMapping(m: InputMapping) { this.mapping = m; }
  setDisplayProfile(p: DisplayProfile) { this.display = p; }
  insertMedia(media: Media) {
    this.assertLive("insert media");
    // Only the boot disk is executed; there is no trackdisk emulation, so the disk is recorded but not readable by the CPU.
    this.media = [...this.media.filter((m) => m.id !== media.id), media];
    this.emit();
  }
  pressInput(action: string, down: boolean) {
    if (down) this.pressed.add(action);
    else this.pressed.delete(action);
    this.emit();
  }
  onStatus(l: (s: RuntimeStatus) => void) {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  private assertLive(op: string) {
    if (!this.profile || this._state === "UNLOADED" || this._state === "STOPPED") throw new Error(`Cannot ${op} while ${this._state}`);
  }
  private assertSlot(slot: number) {
    if (!Number.isInteger(slot) || slot < 0 || slot > 9) throw new RangeError("Save slot must be an integer 0-9");
  }
  private transition(allowed: RuntimeState[], to: RuntimeState, op: string) {
    if (!allowed.includes(this._state)) throw new Error(`Cannot ${op} while ${this._state}`);
    this._state = to;
  }
  private emit() {
    const s: RuntimeStatus = { state: this._state, frame: this.frame, diskActivity: false };
    for (const l of this.listeners) l(s);
  }

  /** 320x256 window onto beam lines 44..299, one fillRect per line from the recorded COLOR00 values, plus a status overlay. */
  private draw() {
    const ctx = this.opts.canvas?.getContext("2d");
    if (!ctx) return;
    const lines = this.machine.bus.color00Lines;
    for (let y = 0; y < 256; y++) {
      ctx.fillStyle = hex12(lines[Math.min(lines.length - 1, DISPLAY_FIRST_LINE + y)] ?? 0);
      ctx.fillRect(0, y, 320, 1);
    }
    if (ctx.fillText && (this.machine.halted || this.machine.error)) {
      ctx.font = "10px monospace";
      ctx.fillStyle = "#ffffff";
      const pc = this.machine.cpu.pc.toString(16).padStart(6, "0");
      const msg = this.machine.error ? this.machine.error.message : "bootblock returned";
      ctx.fillText(`HALTED PC=$${pc}`, 4, 14);
      ctx.fillText(msg.slice(0, 52), 4, 28);
      if (msg.length > 52) ctx.fillText(msg.slice(52, 104), 4, 40);
    }
  }
}
