import { WasmCoreUnavailableError } from "./contract.js";

/** Anything with WebAssembly-style `exports` (a real Instance or a test double). */
export interface CoreInstanceLike {
  readonly exports: unknown;
}

export interface WasmCoreLoader {
  load(): Promise<CoreInstanceLike>;
}

/** Instantiate from bytes (or a lazy byte source). Imports default to none (the contract needs none). */
export function bytesLoader(
  source: BufferSource | (() => BufferSource | Promise<BufferSource>),
  imports: WebAssembly.Imports = {}
): WasmCoreLoader {
  return {
    async load() {
      try {
        const bytes = typeof source === "function" ? await source() : source;
        const { instance } = await WebAssembly.instantiate(bytes, imports);
        return instance;
      } catch (cause) {
        throw new WasmCoreUnavailableError(`Could not instantiate WASM core: ${cause instanceof Error ? cause.message : String(cause)}`, { cause });
      }
    }
  };
}

/** Fetch a core module from a URL (e.g. a self-hosted PUAE/vAmiga build that implements the contract). */
export function urlLoader(url: string, imports: WebAssembly.Imports = {}, fetchFn: typeof fetch = fetch): WasmCoreLoader {
  return {
    async load() {
      try {
        const res = await fetchFn(url);
        if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
        const { instance } = await WebAssembly.instantiate(await res.arrayBuffer(), imports);
        return instance;
      } catch (cause) {
        throw new WasmCoreUnavailableError(`Could not load WASM core from ${url}: ${cause instanceof Error ? cause.message : String(cause)}`, { cause });
      }
    }
  };
}
