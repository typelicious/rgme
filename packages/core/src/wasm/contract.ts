/**
 * RGME WebAssembly core contract.
 *
 * Any WebAssembly module that exports the symbols below can be hosted by `WasmAmigaAdapter`.
 * RGME does NOT ship an instruction-accurate Amiga emulator: real cores (PUAE, vAmiga, ...) are
 * supplied by the integrator, and Kickstart ROMs are never bundled. The bundled
 * `reference-core` only proves the host plumbing (timing budget, media mount, framebuffer, input).
 *
 * Required exports
 * ----------------
 *   memory                              WebAssembly.Memory (the host re-reads `memory.buffer` after every call)
 *   rgme_init(): void                   cold-start the machine (clears media + allocator)
 *   rgme_alloc(len: i32): i32           returns a pointer to `len` writable bytes the host fills with media
 *   rgme_load_media(ptr, len, kind): i32  mount media into DF0:. kind: 0 = ADF. Returns 1 on success, 0 if rejected.
 *   rgme_run_frame(cycleBudget: i32): i32 run one video frame with the given CPU cycle budget; returns cycles consumed
 *   rgme_framebuffer_ptr(): i32         pointer to RGBA8888 pixels (width*height*4 bytes)
 *   rgme_framebuffer_width(): i32
 *   rgme_framebuffer_height(): i32
 *   rgme_set_input(mask: i32): void     joystick bitmask, see `INPUT_BITS`
 *   rgme_reset(): void                  warm reset (keeps mounted media)
 *   rgme_cycle_counter(): i64           total CPU cycles executed since init/reset (BigInt in JS)
 *
 * Optional exports
 * ----------------
 *   rgme_insert_media(drive, ptr, len, kind): i32   mount into DF1:..DF3: (drive 1..3)
 *   rgme_audio_ptr(): i32 / rgme_audio_samples(): i32   interleaved stereo Int16 produced by the last frame
 *   rgme_state_size(): i32, rgme_state_save(ptr): void, rgme_state_load(ptr, len): void   save states
 */
export const INPUT_BITS = { up: 1, down: 2, left: 4, right: 8, fire: 16, fire2: 32 } as const;
export type InputAction = keyof typeof INPUT_BITS;

export const MEDIA_KIND_ADF = 0;

export interface WasmCoreExports {
  memory: WebAssembly.Memory;
  rgme_init(): void;
  rgme_alloc(len: number): number;
  rgme_load_media(ptr: number, len: number, kind: number): number;
  rgme_run_frame(cycleBudget: number): number;
  rgme_framebuffer_ptr(): number;
  rgme_framebuffer_width(): number;
  rgme_framebuffer_height(): number;
  rgme_set_input(mask: number): void;
  rgme_reset(): void;
  rgme_cycle_counter(): bigint;
  rgme_insert_media?(drive: number, ptr: number, len: number, kind: number): number;
  rgme_audio_ptr?(): number;
  rgme_audio_samples?(): number;
  rgme_state_size?(): number;
  rgme_state_save?(ptr: number): void;
  rgme_state_load?(ptr: number, len: number): void;
}

export const REQUIRED_CORE_FUNCTIONS = [
  "rgme_init", "rgme_alloc", "rgme_load_media", "rgme_run_frame", "rgme_framebuffer_ptr",
  "rgme_framebuffer_width", "rgme_framebuffer_height", "rgme_set_input", "rgme_reset", "rgme_cycle_counter"
] as const;

/** No core could be loaded (none configured, fetch failed, bad module). The host never fakes emulation. */
export class WasmCoreUnavailableError extends Error {
  override readonly name = "WasmCoreUnavailableError";
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
  }
}

/** A module was loaded but does not satisfy the contract. */
export class WasmCoreContractError extends Error {
  override readonly name = "WasmCoreContractError";
  constructor(readonly missing: string[]) {
    super(`WASM core does not satisfy the RGME contract; missing/invalid exports: ${missing.join(", ")}`);
  }
}

export function validateCoreExports(exports: unknown): WasmCoreExports {
  const e = (exports ?? {}) as Record<string, unknown>;
  const missing: string[] = [];
  if (!(e.memory instanceof WebAssembly.Memory)) missing.push("memory");
  for (const f of REQUIRED_CORE_FUNCTIONS) if (typeof e[f] !== "function") missing.push(f);
  if (missing.length) throw new WasmCoreContractError(missing);
  return e as unknown as WasmCoreExports;
}
