import type { DisplayProfile, GameProfile, InputMapping, Media } from "../profile.js";
import type { RuntimeAdapter, RuntimeCapabilities, RuntimeSnapshot, RuntimeState, RuntimeStatus, SaveStateMeta } from "../runtime.js";
import {
  INPUT_BITS, MEDIA_KIND_ADF, WasmCoreUnavailableError, validateCoreExports,
  type InputAction, type WasmCoreExports
} from "./contract.js";
import type { WasmCoreLoader } from "./loader.js";
import { FrameScheduler, PAL_CYCLES_PER_FRAME, PAL_FRAME_RATE_HZ, REAL_CLOCK, type SchedulerClock } from "./timing.js";

/** Structural canvas surface (satisfied by HTMLCanvasElement); everything is optional-guarded for jsdom/node. */
export interface WasmCanvasLike {
  width: number;
  height: number;
  getContext(type: "2d"): {
    putImageData?(image: unknown, dx: number, dy: number): void;
    createImageData?(w: number, h: number): { data: Uint8ClampedArray };
  } | null;
}

/** Supplies the raw bytes of a profile media entry (user-supplied ADF, library record, fixture ...). Read-only use. */
export type MediaProvider = (media: Media) => Uint8Array | Promise<Uint8Array>;

export interface WasmAmigaAdapterOptions {
  loader?: WasmCoreLoader;
  mediaProvider?: MediaProvider;
  canvas?: WasmCanvasLike;
  clock?: SchedulerClock;
  cyclesPerFrame?: number;
}

const ADAPTER_ID = "wasm-amiga";

type CoreWithState = WasmCoreExports & Required<Pick<WasmCoreExports, "rgme_state_size" | "rgme_state_save" | "rgme_state_load">>;

/**
 * Hosts an external WebAssembly Amiga core behind the RuntimeAdapter interface.
 * It provides the real host layer (loading, media mount, PAL cycle budget, frame pacing, blit, input);
 * emulation accuracy is entirely the loaded core's responsibility. Without a core it refuses to run.
 */
export class WasmAmigaAdapter implements RuntimeAdapter {
  private _state: RuntimeState = "UNLOADED";
  private core?: WasmCoreExports;
  private profile?: GameProfile;
  private frame = 0;
  private mask = 0;
  private pressed = new Set<string>();
  private media: Media[] = [];
  private mapping?: InputMapping;
  private display?: DisplayProfile;
  private diskUntil = 0;
  private slots = new Map<number, { meta: SaveStateMeta; state: Uint8Array }>();
  private listeners = new Set<(s: RuntimeStatus) => void>();
  private readonly clock: SchedulerClock;
  private readonly cyclesPerFrame: number;
  private readonly scheduler: FrameScheduler;
  /** Last asynchronous failure from `insertMedia` (which cannot return a promise through the interface). */
  lastError?: Error;

  constructor(private readonly opts: WasmAmigaAdapterOptions = {}) {
    this.clock = opts.clock ?? REAL_CLOCK;
    this.cyclesPerFrame = opts.cyclesPerFrame ?? PAL_CYCLES_PER_FRAME;
    this.scheduler = new FrameScheduler(() => this.stepFrame(), this.clock);
  }

  get state() {
    return this._state;
  }
  get currentFrame() {
    return this.frame;
  }
  get activeInputs(): string[] {
    return [...this.pressed].sort();
  }
  get currentMedia(): readonly Media[] {
    return this.media;
  }
  get currentDisplay() {
    return this.display;
  }
  get currentMapping() {
    return this.mapping;
  }
  /** Total CPU cycles the core reports it has executed. */
  get cycleCounter(): bigint {
    return this.core ? this.core.rgme_cycle_counter() : 0n;
  }
  get cycleBudget() {
    return this.cyclesPerFrame;
  }

  identifyCapabilities(): RuntimeCapabilities {
    return {
      id: ADAPTER_ID,
      name: "WASM Amiga core host",
      videoStandards: ["PAL"],
      frameRateHz: PAL_FRAME_RATE_HZ,
      saveStates: this.hasState(this.core),
      audio: Boolean(this.core?.rgme_audio_ptr)
    };
  }

  async loadGame(profile: GameProfile): Promise<void> {
    if (profile.platform !== "amiga") throw new Error(`WasmAmigaAdapter only runs Amiga profiles, got "${profile.platform}"`);
    if (!this.opts.loader) throw new WasmCoreUnavailableError("No WASM core configured (WasmAmigaAdapter needs a WasmCoreLoader)");
    if (!this.opts.mediaProvider) throw new Error("WasmAmigaAdapter needs a mediaProvider to read ADF bytes");
    this.scheduler.stop();
    this.core = undefined;
    const inst = await this.opts.loader.load();
    const core = validateCoreExports(inst.exports); // throws WasmCoreContractError
    core.rgme_init();
    (core as unknown as { setGameProfile?: (p: GameProfile) => void }).setGameProfile?.(profile);
    this.core = core;
    this.profile = profile;
    this.mapping = profile.input;
    this.display = profile.display;
    this.frame = 0;
    this.mask = 0;
    this.pressed.clear();
    this.slots.clear();
    const boot = profile.media.find((m) => m.id === profile.launch.bootMediaId) ?? profile.media[0]!;
    await this.mount(boot, 0);
    this.media = [boot];
    this._state = "LOADED";
    this.blit();
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
    if (this._state === "UNLOADED" || !this.core) throw new Error("Cannot reset while UNLOADED");
    const wasRunning = this._state === "RUNNING";
    this.scheduler.stop();
    this.core.rgme_reset();
    this.frame = 0;
    this.mask = 0;
    this.pressed.clear();
    this._state = "LOADED";
    this.blit();
    if (wasRunning) this.start();
    else this.emit();
  }
  stop() {
    this.transition(["LOADED", "RUNNING", "PAUSED"], "STOPPED", "stop");
    this.scheduler.stop();
    this.emit();
  }
  /** Release the core and timers (use before swapping runtimes). */
  dispose() {
    this.scheduler.stop();
    this.listeners.clear();
    this.core = undefined;
    this._state = "UNLOADED";
  }

  /** Run exactly one frame with the PAL cycle budget (driven by the scheduler; callable directly in tests). */
  stepFrame() {
    if (this._state !== "RUNNING" || !this.core) return;
    this.core.rgme_set_input(this.mask);
    this.core.rgme_run_frame(this.cyclesPerFrame);
    this.frame++;
    this.blit();
    this.emit();
  }

  /** Interleaved stereo Int16 audio of the last frame, if the core exports it. */
  readAudio(): Int16Array | undefined {
    const c = this.core;
    if (!c?.rgme_audio_ptr || !c.rgme_audio_samples) return undefined;
    const n = c.rgme_audio_samples() * 2;
    return new Int16Array(c.memory.buffer.slice(c.rgme_audio_ptr(), c.rgme_audio_ptr() + n * 2));
  }

  saveState(slot: number): SaveStateMeta {
    const core = this.requireState("save");
    this.assertSlot(slot);
    const state = this.captureState(core);
    const meta = { slot, savedAt: Date.now(), frame: this.frame, profileId: this.profile!.id };
    this.slots.set(slot, { meta, state });
    this.pulseDisk();
    this.emit();
    return meta;
  }
  loadState(slot: number): SaveStateMeta {
    const core = this.requireState("load state");
    this.assertSlot(slot);
    const snap = this.slots.get(slot);
    if (!snap) throw new Error(`Save slot ${slot} is empty`);
    this.restoreState(core, snap.state);
    this.frame = snap.meta.frame;
    this.pulseDisk();
    this.blit();
    this.emit();
    return snap.meta;
  }

  /** Snapshot incl. the core's own state (base64 in `coreState`); requires a core with rgme_state_*. */
  exportSnapshot(): RuntimeSnapshot & { coreState: string } {
    const core = this.requireState("snapshot");
    return {
      version: 1,
      adapterId: ADAPTER_ID,
      profileId: this.profile!.id,
      frame: this.frame,
      inputs: [...this.pressed].sort(),
      media: this.media.map((m) => ({ ...m })),
      display: this.display ? { ...this.display } : undefined,
      state: this._state,
      coreState: toBase64(this.captureState(core))
    };
  }
  importSnapshot(s: RuntimeSnapshot): void {
    const core = this.requireState("restore snapshot");
    if (s.version !== 1) throw new Error(`Unsupported snapshot version ${String(s.version)}`);
    if (s.adapterId !== ADAPTER_ID) throw new Error(`Snapshot belongs to adapter "${s.adapterId}"`);
    if (s.profileId !== this.profile!.id) throw new Error(`Snapshot is for "${s.profileId}", loaded game is "${this.profile!.id}"`);
    const coreState = (s as { coreState?: unknown }).coreState;
    if (typeof coreState !== "string") throw new Error("Snapshot has no core state");
    this.restoreState(core, fromBase64(coreState));
    this.frame = s.frame;
    this.pressed = new Set(s.inputs);
    this.mask = maskOf(this.pressed);
    this.media = s.media.map((m) => ({ ...m }));
    if (s.display) this.display = { ...s.display };
    this.blit();
    this.emit();
  }

  setInputMapping(mapping: InputMapping) {
    this.mapping = mapping;
  }
  setDisplayProfile(profile: DisplayProfile) {
    this.display = profile;
  }
  insertMedia(media: Media) {
    this.insertMediaAsync(media).catch((e: unknown) => {
      this.lastError = e instanceof Error ? e : new Error(String(e));
    });
  }
  /** Mount `media` into DF0: (or DF1:..DF3: when the core exports rgme_insert_media). Source bytes are never modified. */
  async insertMediaAsync(media: Media, drive = 0): Promise<void> {
    if (this._state === "UNLOADED" || this._state === "STOPPED" || !this.core) throw new Error(`Cannot insert media while ${this._state}`);
    await this.mount(media, drive);
    this.media = [...this.media.filter((m) => m.id !== media.id), media];
    this.emit();
  }

  pressInput(action: string, down: boolean) {
    if (down) this.pressed.add(action);
    else this.pressed.delete(action);
    this.mask = maskOf(this.pressed);
    this.core?.rgme_set_input(this.mask);
    this.emit();
  }

  onStatus(listener: (s: RuntimeStatus) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ---- internals ----
  private transition(allowed: RuntimeState[], to: RuntimeState, op: string) {
    if (!allowed.includes(this._state)) throw new Error(`Cannot ${op} while ${this._state}`);
    this._state = to;
  }
  private assertSlot(slot: number) {
    if (!Number.isInteger(slot) || slot < 0 || slot > 9) throw new RangeError("Save slot must be an integer 0-9");
  }
  private hasState(c?: WasmCoreExports): c is CoreWithState {
    return Boolean(c?.rgme_state_size && c.rgme_state_save && c.rgme_state_load);
  }
  private requireState(op: string): CoreWithState {
    if (!this.profile || !this.core || this._state === "UNLOADED" || this._state === "STOPPED") throw new Error(`Cannot ${op} while ${this._state}`);
    if (!this.hasState(this.core)) throw new Error("This WASM core does not export save-state support");
    return this.core;
  }
  private captureState(core: CoreWithState): Uint8Array {
    const size = core.rgme_state_size();
    const ptr = core.rgme_alloc(size);
    core.rgme_state_save(ptr);
    return new Uint8Array(core.memory.buffer.slice(ptr, ptr + size));
  }
  private restoreState(core: CoreWithState, state: Uint8Array) {
    const ptr = core.rgme_alloc(state.length);
    new Uint8Array(core.memory.buffer, ptr, state.length).set(state);
    core.rgme_state_load(ptr, state.length);
  }

  /** Copies the media bytes into core memory (the provider's buffer is only read). */
  private async mount(media: Media, drive: number) {
    const core = this.core!;
    if (media.kind !== "adf" && media.kind !== "ipf" && media.kind !== "dms") {
      throw new Error(`WasmAmigaAdapter mounts ADF media only, got "${media.kind}"`);
    }
    const bytes = await this.opts.mediaProvider!(media);
    const ptr = core.rgme_alloc(bytes.length);
    new Uint8Array(core.memory.buffer, ptr, bytes.length).set(bytes); // re-read buffer: alloc may have grown memory
    let ok: number;
    if (drive === 0) ok = core.rgme_load_media(ptr, bytes.length, MEDIA_KIND_ADF);
    else if (core.rgme_insert_media) ok = core.rgme_insert_media(drive, ptr, bytes.length, MEDIA_KIND_ADF);
    else throw new Error(`This WASM core only supports DF0: (no rgme_insert_media); cannot mount DF${drive}:`);
    if (!ok) throw new Error(`WASM core rejected media "${media.filename}"`);
    this.pulseDisk();
  }

  private blit() {
    const core = this.core;
    const canvas = this.opts.canvas;
    if (!core || !canvas) return;
    const w = core.rgme_framebuffer_width();
    const h = core.rgme_framebuffer_height();
    const ctx = canvas.getContext("2d");
    if (!ctx?.putImageData) return;
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    const ptr = core.rgme_framebuffer_ptr();
    const pixels = new Uint8ClampedArray(core.memory.buffer.slice(ptr, ptr + w * h * 4));
    const image =
      typeof ImageData !== "undefined" ? new ImageData(pixels, w, h) : (() => {
        const img = ctx.createImageData?.(w, h);
        img?.data.set(pixels);
        return img;
      })();
    if (image) ctx.putImageData(image, 0, 0);
  }

  /** Raw RGBA framebuffer copy (for tests, thumbnails and hashing). */
  framebuffer(): Uint8Array | undefined {
    const c = this.core;
    if (!c) return undefined;
    const ptr = c.rgme_framebuffer_ptr();
    return new Uint8Array(c.memory.buffer.slice(ptr, ptr + c.rgme_framebuffer_width() * c.rgme_framebuffer_height() * 4));
  }

  private pulseDisk() {
    this.diskUntil = this.clock.now() + 300;
  }
  private emit() {
    const s: RuntimeStatus = { state: this._state, frame: this.frame, diskActivity: this.clock.now() < this.diskUntil };
    for (const l of this.listeners) l(s);
  }
}

function maskOf(pressed: ReadonlySet<string>): number {
  let m = 0;
  for (const a of pressed) m |= INPUT_BITS[a as InputAction] ?? 0;
  return m;
}
function toBase64(b: Uint8Array): string {
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
}
function fromBase64(s: string): Uint8Array {
  const bin = atob(s);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
