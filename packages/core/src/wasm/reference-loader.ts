import { REFERENCE_CORE_WASM_BASE64 } from "./reference-core.js";
import { bytesLoader, type WasmCoreLoader } from "./loader.js";

export function referenceCoreBytes(): Uint8Array<ArrayBuffer> {
  const bin = atob(REFERENCE_CORE_WASM_BASE64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Loader for the bundled reference core: a deterministic timing/integration reference that implements the
 * RGME core contract. It is NOT an Amiga emulator (no 68000, no OCS).
 */
export function referenceCoreLoader(): WasmCoreLoader {
  return bytesLoader(() => referenceCoreBytes());
}
