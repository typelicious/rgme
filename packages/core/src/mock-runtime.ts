import type { DisplayProfile, GameProfile, InputMapping, Media } from "./profile.js";
import { drawSceneIntro } from "./scene-intro.js";
import { drawGuruMeditation } from "./guru-meditation.js";
import { createInitialBoingState, drawBoingScene, updateBoingPhysics, type BoingState } from "./boing-ball.js";
import type { AudioSink } from "./chiptune.js";
import type { RuntimeAdapter, RuntimeCapabilities, RuntimeSnapshot, RuntimeState, RuntimeStatus, SaveStateMeta } from "./runtime.js";

/** Minimal 2D context surface used by the mock (satisfied by CanvasRenderingContext2D). */
export interface Canvas2DLike {
  fillStyle: string | CanvasGradient | CanvasPattern;
  fillRect(x: number, y: number, w: number, h: number): void;
  fillText?(text: string, x: number, y: number): void;
  strokeText?(text: string, x: number, y: number): void;
  createLinearGradient?(x0: number, y0: number, x1: number, y1: number): { addColorStop(offset: number, color: string): void };
  createImageData?(w: number, h: number): { data: Uint8ClampedArray };
  putImageData?(img: unknown, dx: number, dy: number): void;
  font?: string;
  strokeStyle?: string | CanvasGradient | CanvasPattern;
  lineWidth?: number;
  lineJoin?: string;
  textAlign?: string;
  textBaseline?: string;
}
export interface CanvasLike {
  width: number;
  height: number;
  getContext(type: "2d"): Canvas2DLike | null;
}

export const PAL_LORES = { width: 320, height: 256 } as const;
export const PAL_HZ = 50;

const BARS = ["#ffffff", "#ffff00", "#00ffff", "#00ff00", "#ff00ff", "#ff0000", "#0000ff", "#000000"];

interface Snapshot {
  meta: SaveStateMeta;
  inputs: string[];
}

export class MockRuntimeAdapter implements RuntimeAdapter {
  private _state: RuntimeState = "UNLOADED";
  private profile?: GameProfile;
  private frame = 0;
  private timer?: ReturnType<typeof setInterval>;
  private slots = new Map<number, Snapshot>();
  private listeners = new Set<(s: RuntimeStatus) => void>();
  private pressed = new Set<string>();
  private diskUntil = 0;
  private mapping?: InputMapping;
  private display?: DisplayProfile;
  private media: Media[] = [];

  private scene = "pattern";
  private boingState: BoingState = createInitialBoingState();

  /** `audio` is optional: when present it follows the lifecycle (start/pause/stop) and carries the soundtrack. */
  constructor(
    private readonly canvas?: CanvasLike,
    private readonly now: () => number = () => Date.now(),
    private readonly audio?: AudioSink
  ) {
    if (canvas) {
      canvas.width = PAL_LORES.width;
      canvas.height = PAL_LORES.height;
    }
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

  identifyCapabilities(): RuntimeCapabilities {
    return { id: "mock", name: "RGME Mock Runtime", videoStandards: ["PAL", "NTSC"], frameRateHz: PAL_HZ, saveStates: true, audio: Boolean(this.audio) };
  }

  private transition(allowed: RuntimeState[], to: RuntimeState, op: string) {
    if (!allowed.includes(this._state)) throw new Error(`Cannot ${op} while ${this._state}`);
    this._state = to;
  }

  async loadGame(profile: GameProfile): Promise<void> {
    this.clearTimer();
    this.profile = profile;
    this.scene = String(
      profile.runtime.options?.scene ??
        (profile.id === "demo" || profile.id === "rgme-demo-game"
          ? "pattern"
          : "boing")
    );
    this.boingState = createInitialBoingState();
    this.audio?.stop();
    this.media = [...profile.media];
    this.mapping = profile.input;
    this.display = profile.display;
    this.frame = 0;
    this.slots.clear();
    this.pressed.clear();
    this._state = "LOADED";
    this.pulseDisk();
    this.draw();
    this.emit();
  }

  start() {
    this.transition(["LOADED", "PAUSED", "STOPPED"], "RUNNING", "start");
    this.clearTimer();
    this.timer = setInterval(() => this.tick(), 1000 / PAL_HZ);
    if (typeof this.timer === "object" && this.timer !== null && "unref" in this.timer) {
      (this.timer as { unref: () => void }).unref();
    }
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
    this.draw();
    if (wasRunning) this.start();
    else this.emit();
  }
  stop() {
    if (this._state === "STOPPED" || this._state === "UNLOADED") return;
    this.transition(["LOADED", "RUNNING", "PAUSED"], "STOPPED", "stop");
    this.clearTimer();
    this.audio?.stop();
    this.emit();
  }

  /** Advance exactly one 50Hz frame (also used by the timer; deterministic in tests). */
  tick() {
    if (this._state !== "RUNNING") return;
    this.frame++;
    if (this.scene === "boing") {
      this.boingState = updateBoingPhysics(this.boingState, this.pressed, PAL_LORES.width, PAL_LORES.height);
    }
    this.draw();
    this.emit();
  }

  saveState(slot: number): SaveStateMeta {
    if (!this.profile || this._state === "UNLOADED" || this._state === "STOPPED") throw new Error(`Cannot save while ${this._state}`);
    this.assertSlot(slot);
    const meta = { slot, savedAt: this.now(), frame: this.frame, profileId: this.profile.id };
    this.slots.set(slot, { meta, inputs: [...this.pressed] });
    this.pulseDisk();
    this.emit();
    return meta;
  }
  loadState(slot: number): SaveStateMeta {
    if (!this.profile || this._state === "UNLOADED" || this._state === "STOPPED") throw new Error(`Cannot load state while ${this._state}`);
    this.assertSlot(slot);
    const snap = this.slots.get(slot);
    if (!snap) throw new Error(`Save slot ${slot} is empty`);
    this.frame = snap.meta.frame;
    this.pressed = new Set(snap.inputs);
    this.pulseDisk();
    this.draw();
    this.emit();
    return snap.meta;
  }
  listSaveStates(): SaveStateMeta[] {
    return [...this.slots.values()].map((s) => s.meta).sort((a, b) => a.slot - b.slot);
  }

  setInputMapping(mapping: InputMapping) {
    this.mapping = mapping;
  }
  setDisplayProfile(profile: DisplayProfile) {
    this.display = profile;
  }
  insertMedia(media: Media) {
    if (this._state === "UNLOADED" || this._state === "STOPPED") throw new Error(`Cannot insert media while ${this._state}`);
    this.media = [...this.media.filter((m) => m.id !== media.id), media];
    this.pulseDisk();
    this.emit();
  }

  pressInput(action: string, down: boolean) {
    if (down) this.pressed.add(action);
    else this.pressed.delete(action);
    this.emit();
  }

  onStatus(listener: (s: RuntimeStatus) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private assertSlot(slot: number) {
    if (!Number.isInteger(slot) || slot < 0 || slot > 9) throw new RangeError("Save slot must be an integer 0-9");
  }
  private pulseDisk() {
    this.diskUntil = this.now() + 300;
  }
  private emit() {
    const s: RuntimeStatus = { state: this._state, frame: this.frame, diskActivity: this.now() < this.diskUntil };
    for (const l of this.listeners) l(s);
  }
  private clearTimer() {
    if (this.timer !== undefined) clearInterval(this.timer);
    this.timer = undefined;
  }

  exportSnapshot(): RuntimeSnapshot {
    if (!this.profile || this._state === "UNLOADED" || this._state === "STOPPED") throw new Error(`Cannot snapshot while ${this._state}`);
    return {
      version: 1,
      adapterId: "mock",
      profileId: this.profile.id,
      frame: this.frame,
      inputs: [...this.pressed].sort(),
      media: this.media.map((x) => ({ ...x })),
      display: this.display ? { ...this.display } : undefined,
      state: this._state
    };
  }

  importSnapshot(s: RuntimeSnapshot): void {
    if (!this.profile || this._state === "UNLOADED" || this._state === "STOPPED") throw new Error(`Cannot restore snapshot while ${this._state}`);
    if (s.version !== 1) throw new Error(`Unsupported snapshot version ${String(s.version)}`);
    if (s.adapterId !== "mock") throw new Error(`Snapshot belongs to adapter "${s.adapterId}"`);
    if (s.profileId !== this.profile.id) throw new Error(`Snapshot is for "${s.profileId}", loaded game is "${this.profile.id}"`);
    this.frame = s.frame;
    this.pressed = new Set(s.inputs);
    this.media = s.media.map((x) => ({ ...x }));
    if (s.display) this.display = { ...s.display };
    this.pulseDisk();
    this.draw();
    this.emit();
  }

  setMuted(muted: boolean) {
    this.audio?.setMuted(muted);
  }

  /** Renders the selected scene: the demo-scene intro, Guru Meditation, Boing Ball retro engine, or PAL colour bars. */
  private draw() {
    const ctx = this.canvas?.getContext("2d");
    if (!ctx) return;
    if (this.scene === "intro") {
      drawSceneIntro(ctx, this.frame);
      this.drawOverlay(ctx);
      return;
    }
    if (this.scene === "guru") {
      drawGuruMeditation(ctx, PAL_LORES.width, PAL_LORES.height, this.frame);
      return;
    }
    if (this.scene === "boing") {
      drawBoingScene(ctx, PAL_LORES.width, PAL_LORES.height, this.boingState, this.profile?.title, this.pressed);
      this.drawOverlay(ctx);
      return;
    }
    const { width: w, height: h } = PAL_LORES;
    const barW = w / BARS.length;
    BARS.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(i * barW, 0, barW, h);
    });
    // animated raster lines scrolling at 50Hz
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    for (let y = this.frame % 16; y < h; y += 16) ctx.fillRect(0, y, w, 2);
    // joystick feedback block
    if (this.pressed.size > 0) {
      ctx.fillStyle = "#ff8800";
      ctx.fillRect(8, h - 24, 16 * this.pressed.size, 16);
    }
    this.drawOverlay(ctx);
  }

  private drawOverlay(ctx: Canvas2DLike) {
    const { width: w, height: h } = PAL_LORES;
    if (this.pressed.size > 0 && this.scene === "intro") {
      ctx.fillStyle = "#ff8800";
      ctx.fillRect(8, h - 24, 16 * this.pressed.size, 6);
    }
    // disk activity LED
    ctx.fillStyle = this.now() < this.diskUntil ? "#39ff14" : "#113311";
    ctx.fillRect(w - 20, h - 12, 12, 6);
  }
}
