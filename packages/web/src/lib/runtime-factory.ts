import {
  ChiptunePlayer, M68kBootAdapter, MockRuntimeAdapter, WasmAmigaAdapter, createBrowserAudioContext, referenceCoreLoader, urlLoader,
  type CanvasLike, type Media, type RuntimeAdapter, type WasmCanvasLike, type WasmCoreLoader
} from "@rgme/core";

export type RuntimeKind = "mock" | "wasm" | "m68k";

/** Remembers the raw ADF bytes the user supplied, keyed by SHA-256, so the WASM host can mount them. Bytes are never modified. */
export class MediaRegistry {
  private bytes = new Map<string, Uint8Array>();
  register(sha256: string, data: Uint8Array | ArrayBuffer) {
    this.bytes.set(sha256.toLowerCase(), data instanceof Uint8Array ? data : new Uint8Array(data));
  }
  has(sha256: string) {
    return this.bytes.has(sha256.toLowerCase());
  }
  readonly provider = (media: Media): Uint8Array => {
    const b = this.bytes.get(media.sha256.toLowerCase());
    if (!b) throw new Error(`No bytes registered for ${media.filename} (${media.sha256.slice(0, 12)}…). Drop or mount the ADF first.`);
    return b;
  };
}

export interface RuntimeFactoryOptions {
  /** Custom core module URL implementing the RGME WASM core contract (e.g. a self-hosted emulator build). */
  coreUrl?: string;
  /** Override the loader entirely (tests). */
  loader?: WasmCoreLoader;
  media?: MediaRegistry;
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
  const loader = opts.loader ?? (opts.coreUrl ? urlLoader(opts.coreUrl) : referenceCoreLoader());
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
