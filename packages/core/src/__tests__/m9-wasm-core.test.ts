import { describe, it, expect, beforeEach } from "vitest";
import {
  WasmAmigaHardwareCore,
  wasmAmigaCoreLoader,
  validateCoreExports,
  WasmAmigaAdapter,
  KickstartRomStore,
  BUILTIN_AROS_META,
  KNOWN_COMMODORE_ROMS
} from "../index.js";

function makeTestAdf(words: number[]): Uint8Array {
  const d = new Uint8Array(901120);
  const v = new DataView(d.buffer);
  d.set([0x44, 0x4f, 0x53, 0]); // "DOS\0"
  words.forEach((w, i) => v.setUint16(12 + i * 2, w, false));
  v.setUint32(4, 0, false);
  let sum = 0;
  for (let i = 0; i < 256; i++) {
    sum += v.getUint32(i * 4, false);
    if (sum > 0xffffffff) sum = (sum & 0xffffffff) + 1;
  }
  v.setUint32(4, ~sum >>> 0, false);
  return d;
}

describe("Milestone 9: WebAssembly Amiga Hardware Core & Kickstart ROM", () => {
  let core: WasmAmigaHardwareCore;

  beforeEach(() => {
    core = new WasmAmigaHardwareCore();
  });

  it("strictly satisfies the RGME WASM Core Contract", () => {
    const validated = validateCoreExports(core);
    expect(validated.memory).toBeInstanceOf(WebAssembly.Memory);
    expect(typeof validated.rgme_init).toBe("function");
    expect(typeof validated.rgme_alloc).toBe("function");
    expect(typeof validated.rgme_load_media).toBe("function");
    expect(typeof validated.rgme_run_frame).toBe("function");
    expect(typeof validated.rgme_framebuffer_ptr).toBe("function");
    expect(typeof validated.rgme_framebuffer_width).toBe("function");
    expect(typeof validated.rgme_framebuffer_height).toBe("function");
    expect(typeof validated.rgme_set_input).toBe("function");
    expect(typeof validated.rgme_reset).toBe("function");
    expect(typeof validated.rgme_cycle_counter).toBe("function");
  });

  it("reports correct framebuffer dimensions and audio buffer", () => {
    expect(core.rgme_framebuffer_width()).toBe(320);
    expect(core.rgme_framebuffer_height()).toBe(256);
    expect(core.rgme_framebuffer_ptr()).toBeGreaterThan(0);
    expect(core.rgme_audio_ptr()).toBeGreaterThan(0);
  });

  it("allocates memory with 16-byte alignment", () => {
    const p1 = core.rgme_alloc(100);
    const p2 = core.rgme_alloc(50);
    expect(p1 % 16).toBe(0);
    expect(p2 % 16).toBe(0);
    expect(p2).toBeGreaterThanOrEqual(p1 + 100);
  });

  it("mounts ADF media and processes bootblock", () => {
    const dummyAdf = makeTestAdf([0x4e71, 0x4e75]); // NOP, RTS
    const allocPtr = core.rgme_alloc(dummyAdf.length);
    new Uint8Array(core.memory.buffer).set(dummyAdf, allocPtr);

    const ok = core.rgme_load_media(allocPtr, dummyAdf.length, 0);
    expect(ok).toBe(1);
  });

  it("advances cycles and renders video frame on rgme_run_frame", () => {
    const cycles = core.rgme_run_frame(141875);
    expect(cycles).toBe(141875);
    expect(core.rgme_cycle_counter()).toBe(141875n);
    expect(core.rgme_audio_samples()).toBe(882);

    // Check that framebuffer has non-zero pixels
    const fb = new Uint32Array(core.memory.buffer, core.rgme_framebuffer_ptr(), 320 * 256);
    let nonZero = 0;
    for (let i = 0; i < fb.length; i++) {
      if (fb[i] !== 0) nonZero++;
    }
    expect(nonZero).toBeGreaterThan(1000);
  });

  it("supports save state serialization and restoration", () => {
    core.rgme_run_frame(1000);
    const size = core.rgme_state_size();
    expect(size).toBeGreaterThan(0);

    const statePtr = core.rgme_alloc(size);
    core.rgme_state_save(statePtr);

    const savedCycles = core.rgme_cycle_counter();
    core.rgme_run_frame(5000);
    expect(core.rgme_cycle_counter()).toBeGreaterThan(savedCycles);

    core.rgme_state_load(statePtr, size);
    expect(core.rgme_cycle_counter()).toBe(savedCycles);
  });

  it("works with WasmAmigaAdapter through wasmAmigaCoreLoader", async () => {
    const adapter = new WasmAmigaAdapter({
      loader: wasmAmigaCoreLoader(),
      mediaProvider: () => makeTestAdf([0x4e71, 0x4e75])
    });

    const dummyProfile = {
      id: "test-game",
      title: "Test Game",
      platform: "amiga" as const,
      display: { standard: "PAL" as const, frameRateHz: 50 },
      media: [{ id: "m1", filename: "disk.adf", sha256: "0000000000000000000000000000000000000000000000000000000000000001", kind: "adf" as const, size: 901120 }],
      launch: { bootMediaId: "m1" }
    };

    await adapter.loadGame(dummyProfile);
    expect(adapter.state).toBe("LOADED");

    adapter.start();
    expect(adapter.state).toBe("RUNNING");

    adapter.pause();
    expect(adapter.state).toBe("PAUSED");

    adapter.reset();
    expect(adapter.state).toBe("LOADED");
  });
});

describe("Milestone 9: KickstartRomStore", () => {
  let store: KickstartRomStore;

  beforeEach(() => {
    store = new KickstartRomStore();
  });

  it("lists built-in AROS ROM by default", async () => {
    const roms = await store.listRoms();
    expect(roms.length).toBeGreaterThanOrEqual(1);
    expect(roms[0]!.id).toBe(BUILTIN_AROS_META.id);
    expect(roms[0]!.builtIn).toBe(true);
  });

  it("returns active built-in ROM bytes", async () => {
    const active = await store.getActiveRom();
    expect(active.meta.id).toBe(BUILTIN_AROS_META.id);
    expect(active.bytes.length).toBe(512 * 1024);
  });

  it("registers and identifies known Commodore ROMs", async () => {
    const knownSha = "c4f0f55f119409d811b408c56c20573e0473ce17800c2ab5c9c9351e2202ea6d";
    const dummyBytes = new Uint8Array(256 * 1024);

    const meta = await store.registerRom(dummyBytes, knownSha);
    expect(meta.name).toBe(KNOWN_COMMODORE_ROMS[knownSha]!.name);
    expect(meta.compatibility).toBe("authentic-commodore");
    expect(meta.builtIn).toBe(false);

    const list = await store.listRoms();
    expect(list.some(r => r.id === knownSha)).toBe(true);

    const active = await store.getActiveRom();
    expect(active.meta.id).toBe(knownSha);
  });
});
