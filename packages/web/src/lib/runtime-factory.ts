import {
  ChiptunePlayer,
  EmulatorJsCoreAdapter,
  PlaceholderPreviewAdapter,
  VAmigaWebAdapter,
  M68kBootAdapter,
  MockRuntimeAdapter,
  WasmAmigaAdapter,
  createBrowserAudioContext,
  referenceCoreLoader,
  urlLoader,
  wasmAmigaCoreLoader,
  type CanvasLike,
  type Media,
  type RuntimeAdapter,
  type WasmCanvasLike,
  type WasmCoreLoader
} from "@rgme/core";

export type RuntimeKind = "vamiga" | "puae" | "preview" | "wasm" | "m68k" | "mock";

/** Generates a valid 880 KB Amiga ADF disk image with valid 32-bit boot checksum and boot code */
export function generateBootableAdfFallback(media: { filename?: string; label?: string }): Uint8Array {
  const d = new Uint8Array(901120);
  const v = new DataView(d.buffer);
  // Amiga DOS header ("DOS\0")
  d.set([0x44, 0x4f, 0x53, 0]);

  // Bootblock code at offset 12: valid 68000 raster color cycle + mouse button check + clean rts
  const code = [
    0x41, 0xf9, 0x00, 0xdf, 0xf0, 0x00, // lea $dff000, a0 (offset 12..17)
    0x30, 0x28, 0x00, 0x06,             // move.w 6(a0), d0 (offset 18..21)
    0xe0, 0x48,                         // lsr.w #8, d0 (offset 22..23)
    0x31, 0x40, 0x01, 0x80,             // move.w d0, $180(a0) (offset 24..27)
    0x08, 0x39, 0x00, 0x06, 0x00, 0xbf, 0xe0, 0x01, // btst #6, $bfe001 (offset 28..35)
    0x66, 0xec,                         // bne.s loop -> offset 18 (offset 36..37)
    0x70, 0x00,                         // moveq #0, d0 (offset 38..39)
    0x4e, 0x75                          // rts (offset 40..41)
  ];
  d.set(code, 12);

  // Write title/label string into the bootblock
  const rawTitle = media.filename ? media.filename.replace(/\.[^/.]+$/, "") : (media.label ?? "AMIGA GAME DISK");
  const title = rawTitle.slice(0, 32);
  for (let i = 0; i < title.length; i++) {
    d[32 + i] = title.charCodeAt(i);
  }

  // Calculate 32-bit Amiga boot checksum with end-around carry
  v.setUint32(4, 0, false);
  let sum = 0;
  for (let i = 0; i < 256; i++) {
    sum += v.getUint32(i * 4, false);
    if (sum > 0xffffffff) sum = (sum & 0xffffffff) + 1;
  }
  v.setUint32(4, ~sum >>> 0, false);
  return d;
}

/** Remembers the raw ADF bytes the user supplied, keyed by SHA-256, so the WASM host can mount them. Bytes are never modified. */
export class MediaRegistry {
  private bytes = new Map<string, Uint8Array>();

  constructor(private readonly allowSyntheticFallback = false) {}

  register(sha256: string, data: Uint8Array | ArrayBuffer) {
    this.bytes.set(sha256.toLowerCase(), data instanceof Uint8Array ? data : new Uint8Array(data));
  }
  has(sha256: string) {
    return this.bytes.has(sha256.toLowerCase());
  }
  readonly provider = (media: Media): Uint8Array => {
    const key = media.sha256.toLowerCase();
    const b = this.bytes.get(key);
    if (b) return b;
    if (this.allowSyntheticFallback) {
      const fallback = generateBootableAdfFallback(media);
      this.bytes.set(key, fallback);
      return fallback;
    }
    throw new Error(`No bytes registered for ${media.filename} (${media.sha256.slice(0, 12)}…). Drop or mount the ADF first.`);
  };
}

export interface RuntimeFactoryOptions {
  /** Custom core module URL implementing the RGME WASM core contract (e.g. a self-hosted emulator build). */
  coreUrl?: string;
  /** Override the loader entirely (tests). */
  loader?: WasmCoreLoader;
  media?: MediaRegistry;
  kickstartRom?: Uint8Array;
  /** Host element for embedded real emulators (vAmigaWeb, EmulatorJS). */
  container?: HTMLElement | null;
}

/**
 * Creates a runtime behind the RuntimeAdapter interface. Switching "seamlessly" means: dispose the old
 * adapter, create the new one on the SAME canvas or container, re-register its status listener, then call `loadGame`
 * with the current profile (and `start()` if it was RUNNING).
 */
export function createRuntime(kind: RuntimeKind, canvas: HTMLCanvasElement | null, opts: RuntimeFactoryOptions = {}): RuntimeAdapter {
  if (kind === "mock") {
    return new MockRuntimeAdapter((canvas ?? undefined) as unknown as CanvasLike | undefined, undefined, new ChiptunePlayer(createBrowserAudioContext));
  }
  if (kind === "m68k") {
    const media = opts.media ?? new MediaRegistry();
    return new M68kBootAdapter({ mediaProvider: media.provider, canvas: (canvas ?? undefined) as unknown as CanvasLike | undefined });
  }
  if (kind === "vamiga") {
    const media = opts.media ?? new MediaRegistry();
    return new VAmigaWebAdapter({
      mediaProvider: media.provider,
      kickstartRom: opts.kickstartRom,
      baseUrl: opts.coreUrl,
      container: opts.container
    });
  }
  if (kind === "puae") {
    const media = opts.media ?? new MediaRegistry();
    return new EmulatorJsCoreAdapter({
      mediaProvider: media.provider,
      kickstartRom: opts.kickstartRom,
      dataUrl: opts.coreUrl,
      container: opts.container
    });
  }
  if (kind === "preview") {
    const media = opts.media ?? new MediaRegistry();
    return new PlaceholderPreviewAdapter({
      mediaProvider: media.provider,
      kickstartRom: opts.kickstartRom,
      coreUrl: opts.coreUrl,
      canvas: (canvas ?? undefined) as unknown as CanvasLike | undefined
    });
  }
  const loader = opts.loader ?? (opts.coreUrl ? urlLoader(opts.coreUrl) : wasmAmigaCoreLoader({ kickstartRom: opts.kickstartRom }));
  const media = opts.media ?? new MediaRegistry();
  return new WasmAmigaAdapter({ loader, mediaProvider: media.provider, canvas: (canvas ?? undefined) as unknown as WasmCanvasLike | undefined });
}

/** Disposes adapters that support it (WasmAmigaAdapter) and stops others. */
export function disposeRuntime(adapter: RuntimeAdapter | undefined) {
  if (!adapter) return;
  const d = (adapter as { dispose?: () => void }).dispose;
  if (typeof d === "function") d.call(adapter);
  else if (adapter.state !== "UNLOADED" && adapter.state !== "STOPPED") adapter.stop();
}
