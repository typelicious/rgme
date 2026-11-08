import type { DisplayProfile, GameProfile, InputMapping, Media } from "../profile.js";
import type { RuntimeAdapter, RuntimeCapabilities, RuntimeState, RuntimeStatus, SaveStateMeta } from "../runtime.js";
import { ZipParser } from "../zip/zip-parser.js";
import { IpfParser, identifyImage } from "../ipf/ipf-parser.js";

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
      fileName = clean.toLowerCase().endsWith(".adf") || clean.toLowerCase().endsWith(".ipf")
        ? clean
        : `${clean.replace(/\.[^.]*$/, "")}.${identifyImage(bytes) === "ipf" ? "ipf" : "adf"}`;
    }
  }
  // If the extracted or provided image is an IPF, attempt to decode standard Amiga tracks
  if (identifyImage(bytes) === "ipf") {
    const { adf } = IpfParser.parse(bytes).toAdfResult();
    if (adf) {
      bytes = new Uint8Array(adf.buffer, adf.byteOffset, adf.byteLength);
    } else {
      if (!fileName.toLowerCase().endsWith(".ipf")) {
        fileName = `${fileName.replace(/\.[^.]*$/, "")}.ipf`;
      }
    }
  }

  // If this is an ADF whose bootblock contains non-executable ASCII text at offset 12
  // (such as older synthetic rgme-scene-intro stubs), patch offset 12 with authentic 68000 machine code
  // featuring a real Copper sunset gradient and 2-channel Paula stereo arpeggio synth.
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
    const dv = new DataView(patched.buffer, patched.byteOffset, 1024);

    let pc = 12;
    const emit16 = (w: number) => { dv.setUint16(pc, w, false); pc += 2; };
    const emit32 = (l: number) => { dv.setUint32(pc, l, false); pc += 4; };

    // lea $dff000, a6
    emit16(0x4DF9); emit32(0x00DFF000);

    // lea copper_list(pc), a0 (copper_list at offset 180)
    emit16(0x41FA); emit16(180 - (pc + 2));
    emit16(0x2D48); emit16(0x0080); // move.l a0, $80(a6) (COP1LCH)
    emit16(0x3D7C); emit16(0x0000); emit16(0x0088); // move.w #0, $88(a6) (COPJMP1)

    // lea audio_sample(pc), a1 (audio_sample at offset 400)
    emit16(0x43FA); emit16(400 - (pc + 2));

    // Channel 0 (Melody/Arpeggio)
    emit16(0x2D49); emit16(0x00A0); // AUD0LCH
    emit16(0x3D7C); emit16(0x0008); emit16(0x00A4); // AUD0LEN = 8 words = 16 bytes
    emit16(0x3D7C); emit16(424); emit16(0x00A6);    // AUD0PER = 424 (C-4)
    emit16(0x3D7C); emit16(64); emit16(0x00A8);     // AUD0VOL = 64

    // Channel 1 (Bass)
    emit16(0x2D49); emit16(0x00B0); // AUD1LCH
    emit16(0x3D7C); emit16(0x0008); emit16(0x00B4); // AUD1LEN = 8 words
    emit16(0x3D7C); emit16(848); emit16(0x00B6);    // AUD1PER = 848 (C-3)
    emit16(0x3D7C); emit16(48); emit16(0x00B8);     // AUD1VOL = 48

    // Enable DMA: $8283 (DMAEN | COPEN | AUD0EN | AUD1EN)
    emit16(0x3D7C); emit16(0x8283); emit16(0x0096);

    // d2 = frame counter, d3 = note counter
    emit16(0x7400); // moveq #0, d2
    emit16(0x7600); // moveq #0, d3

    const loop_label = pc;
    const wait_vbl_label = pc;
    emit16(0x202E); emit16(0x0004); // move.l 4(a6), d0
    emit16(0x0280); emit32(0x0001FF00); // and.l #$0001ff00, d0
    emit16(0x0C80); emit32(0x00013000); // cmp.l #$00013000, d0
    emit16(0x6600 | ((wait_vbl_label - (pc + 2)) & 0xFF)); // bne.s wait_vbl

    emit16(0x5282); // addq.l #1, d2
    emit16(0x2002); // move.l d2, d0
    emit16(0x0280); emit32(0x00000007); // andi.l #7, d0
    const bne_note_pc = pc;
    emit16(0x6600); // placeholder bne.s skip_note

    emit16(0x5243); // addq.w #1, d3
    emit16(0x0243); emit16(0x0007); // andi.w #7, d3
    emit16(0x3203); // move.w d3, d1
    emit16(0xD241); // add.w d1, d1
    emit16(0x45FA); emit16(450 - (pc + 2)); // lea note_table(pc), a2 (offset 450)
    emit16(0x3D72); emit16(0x1000); emit16(0x00A6); // move.w 0(a2, d1.w), $a6(a6) (AUD0PER)

    // skip_note
    const skip_note_label = pc;
    dv.setUint8(bne_note_pc + 1, (skip_note_label - (bne_note_pc + 2)) & 0xFF);

    // btst #6, $bfe001 (left mouse button)
    emit16(0x0839); emit16(0x0006); emit32(0x00BFE001);
    emit16(0x6600 | ((loop_label - (pc + 2)) & 0xFF)); // bne.s loop

    // On exit: disable DMA and return
    emit16(0x3D7C); emit16(0x7FFF); emit16(0x0096);
    emit16(0x7000); // moveq #0, d0
    emit16(0x4E75); // rts

    // Copper list at offset 180
    pc = 180;
    const cl_data = [
      0x2807, 0xFFFE, 0x0180, 0x0001,
      0x3807, 0xFFFE, 0x0180, 0x0002,
      0x4807, 0xFFFE, 0x0180, 0x0004,
      0x5807, 0xFFFE, 0x0180, 0x0016,
      0x6807, 0xFFFE, 0x0180, 0x0029,
      0x7807, 0xFFFE, 0x0180, 0x003C,
      0x8807, 0xFFFE, 0x0180, 0x004E,
      // Sunset golden horizon band
      0x9807, 0xFFFE, 0x0180, 0x0620,
      0x9A07, 0xFFFE, 0x0180, 0x0A40,
      0x9C07, 0xFFFE, 0x0180, 0x0F80,
      0x9E07, 0xFFFE, 0x0180, 0x0FC0,
      0xA007, 0xFFFE, 0x0180, 0x0FF2,
      0xA207, 0xFFFE, 0x0180, 0x0FC0,
      0xA407, 0xFFFE, 0x0180, 0x0F80,
      0xA607, 0xFFFE, 0x0180, 0x0A40,
      0xA807, 0xFFFE, 0x0180, 0x0620,
      // Blue band down to deep night
      0xB807, 0xFFFE, 0x0180, 0x004E,
      0xC807, 0xFFFE, 0x0180, 0x0029,
      0xD807, 0xFFFE, 0x0180, 0x0016,
      0xE807, 0xFFFE, 0x0180, 0x0004,
      0xF807, 0xFFFE, 0x0180, 0x0001,
      0xFFFF, 0xFFFE
    ];
    for (const w of cl_data) emit16(w);

    // Audio sample at offset 400 (16-byte single cycle waveform)
    pc = 400;
    const sample = [120, 100, 70, 30, 0, -30, -70, -100, -120, -100, -70, -30, 0, 30, 70, 100];
    for (let i = 0; i < 16; i++) {
      patched[pc++] = ((sample[i] ?? 0) + 256) & 0xFF;
    }

    // Note table at offset 450 (C-4, Eb-4, G-4, Bb-4, C-5, Bb-4, G-4, Eb-4)
    pc = 450;
    const notes = [424, 356, 282, 238, 212, 238, 282, 356];
    for (const n of notes) emit16(n);

    // Banner at offset 500
    const banner = "RGME SCENE INTRO: TURRICAN TRIBUTE (AMIGA 500 OCS 50Hz)";
    for (let i = 0; i < banner.length; i++) {
      patched[500 + i] = banner.charCodeAt(i);
    }

    // Recalculate 32-bit Amiga boot checksum
    dv.setUint32(4, 0, false);
    let sum = 0;
    for (let i = 0; i < 256; i++) {
      sum += dv.getUint32(i * 4, false);
      if (sum > 0xFFFFFFFF) sum = (sum & 0xFFFFFFFF) + 1;
    }
    dv.setUint32(4, ~sum >>> 0, false);
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
    if (win && event.source && event.source !== win) {
      // In cross-origin environments, WindowProxy equality can differ across frames.
      // Accept messages identified as coming from our cores (vAmigaWeb msg or EmulatorJS rgme).
      const origin = (event as { origin?: unknown }).origin;
      const isKnownOrigin = typeof origin === "string" && origin.includes("vamigaweb.github.io");
      const d = event.data;
      const isKnownCoreData = Boolean(d && typeof d === "object" && ("msg" in (d as object) || "rgme" in (d as object)));
      if (!isKnownOrigin && !isKnownCoreData) return;
    }
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
  setKickstartRom(rom: Uint8Array | undefined): void {
    this.opts.kickstartRom = rom;
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
