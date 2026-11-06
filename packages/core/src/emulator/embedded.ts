import type { DisplayProfile, GameProfile, InputMapping, Media } from "../profile.js";
import type { RuntimeAdapter, RuntimeCapabilities, RuntimeState, RuntimeStatus, SaveStateMeta } from "../runtime.js";
import { ZipParser } from "../zip/zip-parser.js";

/**
 * Shared plumbing for REAL emulator cores that run inside an <iframe> (vAmigaWeb, EmulatorJS/PUAE).
 *
 * The adapter never draws game frames itself: the core renders video + audio inside its own frame.
 * Everything that touches the browser (frame creation, message source, timers) is injectable so the
 * contract can be unit-tested without a DOM, a network or a real core.
 */

export type EmbeddedMediaProvider = (media: Media) => Uint8Array | Promise<Uint8Array>;

/** Minimal `window` surface of an embedded frame. */
export interface FrameWindow {
  postMessage(message: unknown, targetOrigin: string): void;
}

export interface EmbeddedFrame {
  readonly contentWindow: FrameWindow | null;
  remove(): void;
}

export interface FrameInit {
  /** Remote core URL (vAmigaWeb). */
  src?: string;
  /** Inline document (EmulatorJS bootstrap). */
  srcdoc?: string;
  title: string;
  allow: string;
}

export type FrameFactory = (init: FrameInit) => EmbeddedFrame;

export interface MessageEventLike {
  data: unknown;
  source: unknown;
}

/** Where `message` events from the frames arrive (default: `window`). */
export interface MessageTarget {
  addEventListener(type: "message", listener: (event: MessageEventLike) => void): void;
  removeEventListener(type: "message", listener: (event: MessageEventLike) => void): void;
}

export interface EmbeddedTimers {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
  setInterval(fn: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
}

export const REAL_TIMERS: EmbeddedTimers = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (h) => globalThis.clearTimeout(h as ReturnType<typeof setTimeout>),
  setInterval: (fn, ms) => globalThis.setInterval(fn, ms),
  clearInterval: (h) => globalThis.clearInterval(h as ReturnType<typeof setInterval>)
};

export interface EmbeddedAdapterOptions {
  mediaProvider: EmbeddedMediaProvider;
  /** User-supplied Kickstart (BYOR). Used only where the core protocol supports injection. */
  kickstartRom?: Uint8Array;
  /** Host element the iframe is mounted into (shown while a frame is mounted, hidden otherwise). */
  container?: HTMLElement | null;
  /** Test seam / custom host: overrides `container`. */
  frameFactory?: FrameFactory;
  messageTarget?: MessageTarget;
  timers?: EmbeddedTimers;
  /** Milliseconds to wait for the core before reporting an error status. */
  readyTimeoutMs?: number;
}

export interface BootDisk {
  media: Media;
  bytes: Uint8Array;
  /** File name handed to the core, always with a disk extension (`.adf`). */
  fileName: string;
}

const POLL_MS = 500;
const PAL_HZ = 50;

/** Real DOM implementation of {@link FrameFactory}. */
export function createDomFrameFactory(container: HTMLElement): FrameFactory {
  return (init) => {
    const el = container.ownerDocument.createElement("iframe");
    el.title = init.title;
    el.setAttribute("allow", init.allow);
    el.setAttribute("data-testid", "emulator-frame");
    el.style.cssText = "width:100%;height:100%;border:0;display:block;background:#000";
    if (init.srcdoc !== undefined) el.srcdoc = init.srcdoc;
    else if (init.src) el.src = init.src;
    container.style.display = "block";
    container.appendChild(el);
    return {
      get contentWindow() {
        return el.contentWindow as FrameWindow | null;
      },
      remove() {
        el.remove();
        if (!container.querySelector("iframe")) container.style.display = "none";
      }
    };
  };
}

export function toDiskFileName(media: Media): string {
  const base = (media.filename || media.label || "disk").replace(/\.[^.]*$/, "").replace(/[^A-Za-z0-9._-]/g, "_");
  return `${base || "disk"}.adf`;
}

/**
 * Ensures media passed to real emulators is guaranteed to be an uncompressed ADF disk image.
 * If a ZIP archive is provided, the primary disk entry (.adf) is extracted transparently.
 */
export async function resolveDiskBytesAndName(
  media: Media,
  raw: Uint8Array
): Promise<{ bytes: Uint8Array; fileName: string }> {
  let bytes = raw;
  let fileName = toDiskFileName(media);
  if (ZipParser.isZip(bytes)) {
    const zip = new ZipParser(bytes);
    const mediaEntries = zip.getMediaEntries();
    const target = mediaEntries.length > 0 ? mediaEntries[0]! : zip.entries[0];
    if (target) {
      bytes = await zip.extractEntry(target);
      const innerName = target.filename.split("/").pop() ?? target.filename;
      const clean = innerName.replace(/[^A-Za-z0-9._-]/g, "_");
      fileName = clean.toLowerCase().endsWith(".adf") ? clean : `${clean.replace(/\.[^.]*$/, "")}.adf`;
    }
  }
  // If this is an ADF whose bootblock contains non-executable ASCII text at offset 12
  // (such as the synthetic rgme-scene-intro.adf), patch offset 12 with valid 68000 copper loop
  // so authentic Amiga CPUs execute it cleanly without Guru Meditation #00000004.
  if (
    bytes.length >= 1024 &&
    bytes[0] === 0x44 &&
    bytes[1] === 0x4f &&
    bytes[2] === 0x53 &&
    bytes[12] === 0x52 &&
    bytes[13] === 0x47 &&
    bytes[14] === 0x4d &&
    bytes[15] === 0x45
  ) {
    const patched = new Uint8Array(bytes);
    const m68kCode = [
      0x41, 0xf9, 0x00, 0xdf, 0xf0, 0x00, // lea $dff000, a0
      0x30, 0x28, 0x00, 0x06,             // move.w 6(a0), d0 (read beam pos)
      0xe1, 0x58,                         // rol.w #8, d0 (vertical beam into low byte)
      0x02, 0x40, 0x00, 0xff,             // andi.w #$00ff, d0
      0x31, 0x40, 0x01, 0x80,             // move.w d0, $180(a0) (set COLOR00 background)
      0x08, 0x39, 0x00, 0x06, 0x00, 0xbf, 0xe0, 0x01, // btst #6, $bfe001 (LMB)
      0x66, 0xe8,                         // bne.s loop
      0x4e, 0x75                          // rts
    ];
    patched.set(m68kCode, 12);
    // Recalculate 32-bit Amiga boot checksum
    const v = new DataView(patched.buffer, patched.byteOffset, 1024);
    v.setUint32(4, 0, false);
    let sum = 0;
    for (let i = 0; i < 256; i++) {
      sum += v.getUint32(i * 4, false);
      if (sum > 0xffffffff) sum = (sum & 0xffffffff) + 1;
    }
    v.setUint32(4, ~sum >>> 0, false);
    bytes = patched;
  }

  return { bytes, fileName };
}

/**
 * Base class: lifecycle, status, input bookkeeping, timeouts. Subclasses supply the core protocol.
 * `start()` / `pause()` express *intent*; it is applied as soon as the core reports it is ready.
 */
export abstract class EmbeddedEmulatorAdapter implements RuntimeAdapter {
  protected _state: RuntimeState = "UNLOADED";
  protected profile?: GameProfile;
  protected media: Media[] = [];
  protected mapping?: InputMapping;
  protected display?: DisplayProfile;
  protected frame?: EmbeddedFrame;
  protected boot?: BootDisk;
  protected ready = false;
  protected wantRun = false;
  protected muted = false;
  protected frames = 0;
  protected readonly pressed = new Set<string>();
  private phase: RuntimeStatus["phase"];
  private message?: string;
  private readonly listeners = new Set<(s: RuntimeStatus) => void>();
  private readonly factory?: FrameFactory;
  private readonly timers: EmbeddedTimers;
  private readonly target?: MessageTarget;
  private readyTimer?: unknown;
  private pollTimer?: unknown;
  private readonly onMessage = (event: MessageEventLike): void => {
    const win = this.frame?.contentWindow;
    if (!win || event.source !== win) return;
    this.handleMessage(event.data);
  };

  protected constructor(protected readonly opts: EmbeddedAdapterOptions) {
    this.factory = opts.frameFactory ?? (opts.container ? createDomFrameFactory(opts.container) : undefined);
    this.timers = opts.timers ?? REAL_TIMERS;
    const t = opts.messageTarget ?? (globalThis as unknown as Partial<MessageTarget>);
    this.target = typeof t.addEventListener === "function" ? (t as MessageTarget) : undefined;
  }

  /** Display name of the core, e.g. "vAmiga". */
  protected abstract readonly coreLabel: string;
  protected abstract readonly adapterId: string;
  protected abstract readonly readyTimeoutDefaultMs: number;
  protected abstract frameInit(boot: BootDisk): FrameInit;
  /** Called for every message coming from the mounted frame. Use {@link markReady} / {@link fail}. */
  protected abstract handleMessage(data: unknown): void;
  protected abstract applyRun(run: boolean): void;
  protected abstract applyReset(): void;
  protected abstract applyMute(muted: boolean): void;
  protected abstract applyInput(action: string, down: boolean): void;
  protected abstract applyDisk(boot: BootDisk): void;
  /** Hook for periodic core polling (vAmigaWeb `poll_state`). */
  protected poll(): void {}
  protected cleanupCore(): void {}

  get state(): RuntimeState {
    return this._state;
  }
  get currentFrame(): number {
    return this.frames;
  }
  get currentMedia(): readonly Media[] {
    return this.media;
  }
  get isMuted(): boolean {
    return this.muted;
  }
  get activeInputs(): string[] {
    return [...this.pressed].sort();
  }

  abstract identifyCapabilities(): RuntimeCapabilities;

  protected capabilities(name: string): RuntimeCapabilities {
    return { id: this.adapterId, name, videoStandards: ["PAL", "NTSC"], frameRateHz: PAL_HZ, saveStates: false, audio: true };
  }

  async loadGame(profile: GameProfile): Promise<void> {
    if (profile.platform !== "amiga") {
      throw new Error(`${this.coreLabel} only runs Amiga profiles, got "${profile.platform}"`);
    }
    if (!this.factory) {
      throw new Error(`${this.coreLabel}: no host element — pass { container } or { frameFactory }`);
    }
    const bootMedia = profile.media.find((m) => m.id === profile.launch.bootMediaId) ?? profile.media[0];
    if (!bootMedia) throw new Error("No media defined in GameProfile");
    const rawBytes = await this.opts.mediaProvider(bootMedia);
    const { bytes, fileName } = await resolveDiskBytesAndName(bootMedia, rawBytes);

    this.teardownFrame();
    this.profile = profile;
    this.media = [bootMedia];
    this.mapping = profile.input;
    this.display = profile.display;
    this.frames = 0;
    this.pressed.clear();
    this.ready = false;
    this.boot = { media: bootMedia, bytes, fileName };
    this._state = "LOADED";
    this.phase = "loading";
    this.message = `Loading ${this.coreLabel}…`;

    this.target?.addEventListener("message", this.onMessage);
    this.frame = this.factory(this.frameInit(this.boot));
    const timeout = this.opts.readyTimeoutMs ?? this.readyTimeoutDefaultMs;
    this.readyTimer = this.timers.setTimeout(() => {
      if (!this.ready) {
        this.fail(`${this.coreLabel} did not start within ${Math.round(timeout / 1000)}s — offline, blocked, or the core host changed.`);
      }
    }, timeout);
    this.pollTimer = this.timers.setInterval(() => this.tick(), POLL_MS);
    this.poll();
    this.emit();
  }

  start(): void {
    this.requireLoaded("start");
    this.wantRun = true;
    this._state = "RUNNING";
    if (this.ready) this.applyRun(true);
    this.emit();
  }

  pause(): void {
    if (this._state === "UNLOADED" || this._state === "STOPPED") return;
    this.wantRun = false;
    if (this._state === "RUNNING") this._state = "PAUSED";
    if (this.ready) this.applyRun(false);
    this.emit();
  }

  reset(): void {
    this.requireLoaded("reset");
    this.frames = 0;
    if (this.ready) this.applyReset();
    this.emit();
  }

  stop(): void {
    this.wantRun = false;
    this.teardownFrame();
    if (this._state !== "UNLOADED") this._state = "STOPPED";
    this.emit();
  }

  /** Releases the frame, listeners and timers. Safe to call repeatedly. */
  dispose(): void {
    this.wantRun = false;
    this.teardownFrame();
    this._state = "UNLOADED";
  }

  saveState(): SaveStateMeta {
    throw new Error(`${this.coreLabel}: save states are not supported by the embedded core`);
  }
  loadState(): SaveStateMeta {
    throw new Error(`${this.coreLabel}: save states are not supported by the embedded core`);
  }

  setInputMapping(mapping: InputMapping): void {
    this.mapping = mapping;
  }
  setDisplayProfile(profile: DisplayProfile): void {
    this.display = profile;
  }

  insertMedia(media: Media): void {
    this.media = [...this.media.filter((m) => m.id !== media.id), media];
    if (!this.frame) return;
    void Promise.resolve(this.opts.mediaProvider(media)).then(async (rawBytes) => {
      if (!this.frame) return;
      const { bytes, fileName } = await resolveDiskBytesAndName(media, rawBytes);
      this.boot = { media, bytes, fileName };
      if (this.ready) this.applyDisk(this.boot);
    });
  }

  pressInput(action: string, down: boolean): void {
    if (down) this.pressed.add(action);
    else this.pressed.delete(action);
    if (this.ready) this.applyInput(action, down);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.ready) this.applyMute(muted);
  }

  onStatus(listener: (s: RuntimeStatus) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // --- helpers for subclasses -------------------------------------------------------------------

  protected markReady(): void {
    if (this.ready) return;
    this.ready = true;
    if (this.readyTimer !== undefined) this.timers.clearTimeout(this.readyTimer);
    this.readyTimer = undefined;
    this.phase = "ready";
    this.message = undefined;
    this.applyMute(this.muted);
    if (this.wantRun) this.applyRun(true);
    this.emit();
  }

  protected fail(message: string): void {
    if (this.readyTimer !== undefined) this.timers.clearTimeout(this.readyTimer);
    this.readyTimer = undefined;
    this.phase = "error";
    this.message = message;
    this.emit();
  }

  protected postToFrame(message: unknown): void {
    this.frame?.contentWindow?.postMessage(message, "*");
  }

  protected emit(): void {
    const status: RuntimeStatus = { state: this._state, frame: this.frames, diskActivity: false };
    if (this.phase) status.phase = this.phase;
    if (this.message) status.message = this.message;
    for (const l of this.listeners) l(status);
  }

  private tick(): void {
    this.poll();
    if (this._state === "RUNNING" && this.ready) {
      this.frames += Math.round((POLL_MS * PAL_HZ) / 1000);
      this.emit();
    }
  }

  private requireLoaded(op: string): void {
    if (this._state === "UNLOADED") throw new Error(`Cannot ${op}: no game loaded`);
  }

  private teardownFrame(): void {
    if (this.readyTimer !== undefined) this.timers.clearTimeout(this.readyTimer);
    if (this.pollTimer !== undefined) this.timers.clearInterval(this.pollTimer);
    this.readyTimer = undefined;
    this.pollTimer = undefined;
    this.target?.removeEventListener("message", this.onMessage);
    this.cleanupCore();
    this.frame?.remove();
    this.frame = undefined;
    this.ready = false;
    this.phase = undefined;
    this.message = undefined;
  }
}
