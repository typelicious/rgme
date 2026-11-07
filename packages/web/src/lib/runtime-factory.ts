import {
  ChiptunePlayer,
  CopperlineWebAdapter,
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

export type RuntimeKind = "vamiga" | "puae" | "copperline" | "preview" | "wasm" | "m68k" | "mock";

/** Generates a valid 880 KB Amiga ADF disk image with valid 32-bit boot checksum, raster display & Paula audio */
export function generateBootableAdfFallback(media: { filename?: string; label?: string }): Uint8Array {
  const d = new Uint8Array(901120);
  const v = new DataView(d.buffer);
  // Amiga DOS header ("DOS\0")
  d.set([0x44, 0x4f, 0x53, 0]);

  // Bootblock code at offset 12: valid 68000 machine code setting up Paula audio + copper raster cycle + mouse check + clean rts
  const code = [
    0x41, 0xf9, 0x00, 0xdf, 0xf0, 0x00, // 12..17: lea $dff000, a0
    0x43, 0xfa, 0x00, 0x3c,             // 18..21: lea 60(pc), a1 -> offset 80 (audio sample)
    0x21, 0x49, 0x00, 0xa0,             // 22..25: move.l a1, $a0(a0) (AUD0LCH)
    0x31, 0x7c, 0x00, 0x08, 0x00, 0xa4, // 26..31: move.w #8, $a4(a0) (AUD0LEN = 8 words = 16 bytes)
    0x31, 0x7c, 0x01, 0x5e, 0x00, 0xa6, // 32..37: move.w #350, $a6(a0) (AUD0PER = 350 -> ~250 Hz tone)
    0x31, 0x7c, 0x00, 0x40, 0x00, 0xa8, // 38..43: move.w #64, $a8(a0) (AUD0VOL = 64 max)
    0x31, 0x7c, 0x82, 0x01, 0x00, 0x96, // 44..49: move.w #$8201, $96(a0) (DMACON = enable AUD0)
    0x30, 0x28, 0x00, 0x06,             // 50..53: move.w 6(a0), d0 (read VPOSR)
    0xe0, 0x48,                         // 54..55: lsr.w #8, d0
    0x31, 0x40, 0x01, 0x80,             // 56..59: move.w d0, $180(a0) (COLOR00 raster gradient)
    0x08, 0x39, 0x00, 0x06, 0x00, 0xbf, 0xe0, 0x01, // 60..67: btst #6, $bfe001 (left mouse button)
    0x66, 0xec,                         // 68..69: bne.s loop -> offset 50
    0x70, 0x00,                         // 70..71: moveq #0, d0
    0x4e, 0x75                          // 72..73: rts
  ];
  d.set(code, 12);

  // 16-byte audio waveform sample at offset 80
  const sample = [120, 100, 70, 30, 0, -30, -70, -100, -120, -100, -70, -30, 0, 30, 70, 100];
  for (let i = 0; i < 16; i++) {
    d[80 + i] = ((sample[i] ?? 0) + 256) & 0xff;
  }

  // Write title/label string safely into the bootblock starting at offset 96 (never overwriting opcodes)
  const rawTitle = media.filename ? media.filename.replace(/\.[^/.]+$/, "") : (media.label ?? "AMIGA GAME DISK");
  const title = rawTitle.slice(0, 64);
  for (let i = 0; i < title.length; i++) {
    d[96 + i] = title.charCodeAt(i);
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
  if (kind === "copperline") {
    const media = opts.media ?? new MediaRegistry();
    return new CopperlineWebAdapter({
      mediaProvider: media.provider,
      kickstartRom: opts.kickstartRom,
      baseUrl: opts.coreUrl ?? "/emulators/copperline/",
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
