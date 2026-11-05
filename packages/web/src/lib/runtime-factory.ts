import {
  ChiptunePlayer, EmulatorJsPuaeAdapter, M68kBootAdapter, MockRuntimeAdapter, WasmAmigaAdapter, createBrowserAudioContext, referenceCoreLoader, urlLoader, wasmAmigaCoreLoader,
  type CanvasLike, type Media, type RuntimeAdapter, type WasmCanvasLike, type WasmCoreLoader
} from "@rgme/core";

export type RuntimeKind = "mock" | "wasm" | "m68k" | "puae";

/** Generates a valid 880 KB Amiga ADF disk image with valid 32-bit boot checksum and boot code */
export function generateBootableAdfFallback(media: { filename?: string; label?: string }): Uint8Array {
  const d = new Uint8Array(901120);
  const v = new DataView(d.buffer);
  // Amiga DOS header ("DOS\0")
  d.set([0x44, 0x4f, 0x53, 0]);

  // Bootblock code at offset 12:
  // MOVE.W #$0055, $DFF180 (Amiga background color)
  // loop: BRA.B loop
  const code = [0x33, 0xfc, 0x00, 0x55, 0x00, 0xdf, 0xf1, 0x80, 0x60, 0xfe];
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
}

/**
 * Creates a runtime behind the RuntimeAdapter interface. Switching "seamlessly" means: dispose the old
 * adapter, create the new one on the SAME canvas, re-register its status listener, then call `loadGame`
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
  if (kind === "puae") {
    const media = opts.media ?? new MediaRegistry();
    return new EmulatorJsPuaeAdapter({
      mediaProvider: media.provider,
      kickstartRom: opts.kickstartRom,
      coreUrl: opts.coreUrl,
      canvas: (canvas ?? undefined) as unknown as WasmCanvasLike | undefined
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
