import type { Canvas2DLike, CanvasLike } from "../mock-runtime.js";
import type { AudioSink } from "../chiptune.js";
import type { DisplayProfile, GameProfile, InputMapping, Media, Platform } from "../profile.js";
import type {
  RuntimeAdapter, RuntimeCapabilities, RuntimeSnapshot, RuntimeState, RuntimeStatus, SaveStateMeta
} from "../runtime.js";

/**
 * Capabilities of a REFERENCE runtime: platform-correct video mode, media parsing and synthesised sound,
 * but no instruction-level CPU/chip emulation. `emulation: "reference"` makes that explicit to the UI.
 */
export interface PlatformCapabilities extends RuntimeCapabilities {
  platform: Platform;
  emulation: "reference";
}

export interface ReferenceConfig {
  adapterId: string;
  platform: Platform;
  name: string;
  size: { width: number; height: number };
  hz: number;
  video: "PAL" | "NTSC";
}

/**
 * Shared lifecycle for reference runtimes. Same state machine and error behaviour as MockRuntimeAdapter:
 * UNLOADED -> LOADED -> RUNNING <-> PAUSED -> STOPPED.
 */
export abstract class ReferenceAdapter implements RuntimeAdapter {
  protected _state: RuntimeState = "UNLOADED";
  protected profile?: GameProfile;
  protected frame = 0;
  protected media: Media[] = [];
  protected bootMediaId?: string;
  protected mediaData = new Map<string, Uint8Array>();
  protected pressed = new Set<string>();
  protected mapping?: InputMapping;
  protected display?: DisplayProfile;
  protected diskUntil = 0;
  private timer?: ReturnType<typeof setInterval>;
  private slots = new Map<number, { meta: SaveStateMeta; inputs: string[] }>();
  private listeners = new Set<(s: RuntimeStatus) => void>();

  constructor(
    protected readonly cfg: ReferenceConfig,
    protected readonly canvas?: CanvasLike,
    protected readonly now: () => number = () => Date.now(),
    protected readonly audio?: AudioSink
  ) {
    if (canvas) {
      canvas.width = cfg.size.width;
      canvas.height = cfg.size.height;
    }
  }

  protected abstract onMediaChanged(): void;
  protected abstract drawStatic(ctx: Canvas2DLike): void;
  protected abstract drawFrame(ctx: Canvas2DLike, frame: number): void;

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

  identifyCapabilities(): PlatformCapabilities {
    return {
      id: this.cfg.adapterId,
      name: this.cfg.name,
      platform: this.cfg.platform,
      emulation: "reference",
      videoStandards: [this.cfg.video],
      frameRateHz: this.cfg.hz,
      saveStates: true,
      audio: Boolean(this.audio)
    };
  }

  /** Supplies the raw bytes of a media entry (never modified). Parsed when the game loads / the media is inserted. */
  setMediaData(mediaId: string, bytes: Uint8Array) {
    this.mediaData.set(mediaId, bytes);
    if (mediaId === this.bootMediaId && this._state !== "UNLOADED") {
      this.onMediaChanged();
      this.redraw();
    }
  }

  private transition(allowed: RuntimeState[], to: RuntimeState, op: string) {
    if (!allowed.includes(this._state)) throw new Error(`Cannot ${op} while ${this._state}`);
    this._state = to;
  }

  async loadGame(profile: GameProfile): Promise<void> {
    this.clearTimer();
    this.audio?.stop();
    this.profile = profile;
    this.media = profile.media.map((m) => ({ ...m }));
    this.bootMediaId = profile.launch.bootMediaId;
    this.mapping = profile.input;
    this.display = profile.display;
    this.frame = 0;
    this.slots.clear();
    this.pressed.clear();
    this._state = "LOADED";
    this.pulseDisk();
    this.onMediaChanged();
    this.redraw();
    this.emit();
  }

  start() {
    this.transition(["LOADED", "PAUSED"], "RUNNING", "start");
    this.clearTimer();
    this.timer = setInterval(() => this.tick(), 1000 / this.cfg.hz);
    this.audio?.start();
    this.emit();
  }
  pause() {
    this.transition(["RUNNING"], "PAUSED", "pause");
    this.clearTimer();
    this.audio?.pause();
    this.emit();
  }
  reset() {
    if (this._state === "UNLOADED") throw new Error("Cannot reset while UNLOADED");
    const wasRunning = this._state === "RUNNING";
    this.clearTimer();
    this.audio?.stop();
    this.frame = 0;
    this.pressed.clear();
    this._state = "LOADED";
    this.pulseDisk();
    this.redraw();
    if (wasRunning) this.start();
    else this.emit();
  }
  stop() {
    this.transition(["LOADED", "RUNNING", "PAUSED"], "STOPPED", "stop");
    this.clearTimer();
    this.audio?.stop();
    this.emit();
  }

  /** Advances exactly one video frame (also used by the timer; deterministic in tests). */
  tick() {
    if (this._state !== "RUNNING") return;
    this.frame++;
    const ctx = this.canvas?.getContext("2d");
    if (ctx) this.drawFrame(ctx, this.frame);
    this.emit();
  }

  saveState(slot: number): SaveStateMeta {
    this.assertActive("save");
    this.assertSlot(slot);
    const meta = { slot, savedAt: this.now(), frame: this.frame, profileId: this.profile!.id };
    this.slots.set(slot, { meta, inputs: [...this.pressed] });
    this.pulseDisk();
    this.emit();
    return meta;
  }
  loadState(slot: number): SaveStateMeta {
    this.assertActive("load state");
    this.assertSlot(slot);
    const snap = this.slots.get(slot);
    if (!snap) throw new Error(`Save slot ${slot} is empty`);
    this.frame = snap.meta.frame;
    this.pressed = new Set(snap.inputs);
    this.pulseDisk();
    this.redraw();
    this.emit();
    return snap.meta;
  }

  exportSnapshot(): RuntimeSnapshot {
    this.assertActive("snapshot");
    return {
      version: 1,
      adapterId: this.cfg.adapterId,
      profileId: this.profile!.id,
      frame: this.frame,
      inputs: [...this.pressed].sort(),
      media: this.media.map((m) => ({ ...m })),
      display: this.display ? { ...this.display } : undefined,
      state: this._state
    };
  }
  importSnapshot(s: RuntimeSnapshot): void {
    this.assertActive("restore snapshot");
    if (s.version !== 1) throw new Error(`Unsupported snapshot version ${String(s.version)}`);
    if (s.adapterId !== this.cfg.adapterId) throw new Error(`Snapshot belongs to adapter "${s.adapterId}"`);
    if (s.profileId !== this.profile!.id) throw new Error(`Snapshot is for "${s.profileId}", loaded game is "${this.profile!.id}"`);
    this.frame = s.frame;
    this.pressed = new Set(s.inputs);
    this.media = s.media.map((m) => ({ ...m }));
    if (s.display) this.display = { ...s.display };
    this.pulseDisk();
    this.onMediaChanged();
    this.redraw();
    this.emit();
  }

  setInputMapping(mapping: InputMapping) {
    this.mapping = mapping;
  }
  setDisplayProfile(profile: DisplayProfile) {
    this.display = profile;
  }
  insertMedia(media: Media) {
    if (this._state === "UNLOADED" || this._state === "STOPPED") throw new Error(`Cannot insert media while ${this._state}`);
    this.media = [...this.media.filter((m) => m.id !== media.id), { ...media }];
    this.bootMediaId = media.id;
    this.pulseDisk();
    this.onMediaChanged();
    this.redraw();
    this.emit();
  }
  pressInput(action: string, down: boolean) {
    if (down) this.pressed.add(action);
    else this.pressed.delete(action);
    this.emit();
  }
  setMuted(muted: boolean) {
    this.audio?.setMuted(muted);
  }
  onStatus(listener: (s: RuntimeStatus) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  protected redraw() {
    const ctx = this.canvas?.getContext("2d");
    if (!ctx) return;
    this.drawStatic(ctx);
    this.drawFrame(ctx, this.frame);
  }
  protected pulseDisk() {
    this.diskUntil = this.now() + 300;
  }
  private assertActive(op: string) {
    if (!this.profile || this._state === "UNLOADED" || this._state === "STOPPED") throw new Error(`Cannot ${op} while ${this._state}`);
  }
  private assertSlot(slot: number) {
    if (!Number.isInteger(slot) || slot < 0 || slot > 9) throw new RangeError("Save slot must be an integer 0-9");
  }
  private emit() {
    const s: RuntimeStatus = { state: this._state, frame: this.frame, diskActivity: this.now() < this.diskUntil };
    for (const l of this.listeners) l(s);
  }
  private clearTimer() {
    if (this.timer !== undefined) clearInterval(this.timer);
    this.timer = undefined;
  }
}
