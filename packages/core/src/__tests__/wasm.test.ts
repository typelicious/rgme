import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  WasmAmigaAdapter, WasmCoreContractError, WasmCoreUnavailableError, bytesLoader, referenceCoreLoader,
  PAL_CYCLES_PER_FRAME, PAL_LINES, PAL_COLOR_CLOCKS_PER_LINE, FrameScheduler, validateCoreExports,
  type SchedulerClock, type WasmCoreLoader
} from "../wasm/index.js";
import { sampleProfile } from "./fixtures.js";

const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

function adfWithMagic(magic: string, seed = 7): Uint8Array {
  const b = new Uint8Array(901120);
  for (let i = 0; i < b.length; i++) b[i] = (i * 31 + seed) & 255;
  for (let i = 0; i < magic.length; i++) b[i] = magic.charCodeAt(i);
  return b;
}

class FakeClock implements SchedulerClock {
  t = 0;
  private id = 0;
  private q: Array<{ at: number; fn: () => void; id: number }> = [];
  constructor(private readonly jitter = 0) {}
  now() { return this.t; }
  setTimeout(fn: () => void, ms: number) {
    const id = ++this.id;
    this.q.push({ at: this.t + ms + this.jitter, fn, id });
    return id;
  }
  clearTimeout(h: unknown) { this.q = this.q.filter((x) => x.id !== h); }
  advance(ms: number) {
    const target = this.t + ms;
    for (;;) {
      this.q.sort((a, b) => a.at - b.at);
      const next = this.q[0];
      if (!next || next.at > target) break;
      this.q.shift();
      this.t = Math.max(this.t, next.at);
      next.fn();
    }
    this.t = target;
  }
}

function make(opts: { disk?: Uint8Array; clock?: SchedulerClock; loader?: WasmCoreLoader } = {}) {
  const disk = opts.disk ?? adfWithMagic("DOS\0");
  return {
    disk,
    adapter: new WasmAmigaAdapter({
      loader: opts.loader ?? referenceCoreLoader(),
      mediaProvider: () => disk,
      clock: opts.clock ?? new FakeClock()
    })
  };
}

describe("PAL timing model", () => {
  it("budget is 312 lines x 227 colour clocks x 2 CPU cycles", () => {
    expect(PAL_CYCLES_PER_FRAME).toBe(PAL_LINES * PAL_COLOR_CLOCKS_PER_LINE * 2);
    expect(PAL_CYCLES_PER_FRAME).toBe(141_648);
  });
});

describe("core contract", () => {
  const emptyModule = new Uint8Array([0, 0x61, 0x73, 0x6d, 1, 0, 0, 0]);
  it("rejects a module that lacks the contract exports", async () => {
    const { adapter } = make({ loader: bytesLoader(emptyModule) });
    const err = await adapter.loadGame(sampleProfile()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(WasmCoreContractError);
    expect((err as WasmCoreContractError).missing).toContain("rgme_run_frame");
    expect((err as WasmCoreContractError).missing).toContain("memory");
    expect(adapter.state).toBe("UNLOADED");
  });
  it("validateCoreExports accepts the reference core", async () => {
    const inst = await referenceCoreLoader().load();
    expect(() => validateCoreExports(inst.exports)).not.toThrow();
  });
  it("throws WasmCoreUnavailableError when no core is configured or loadable", async () => {
    await expect(new WasmAmigaAdapter().loadGame(sampleProfile())).rejects.toBeInstanceOf(WasmCoreUnavailableError);
    const bad = make({ loader: bytesLoader(new Uint8Array([1, 2, 3])) }).adapter;
    await expect(bad.loadGame(sampleProfile())).rejects.toBeInstanceOf(WasmCoreUnavailableError);
    expect(bad.state).toBe("UNLOADED");
  });
  it("refuses non-Amiga profiles", async () => {
    const p = { ...sampleProfile(), platform: "c64" as const };
    await expect(make().adapter.loadGame(p)).rejects.toThrow(/Amiga/);
  });
});

describe("WasmAmigaAdapter with the reference core", () => {
  it("advances the core cycle counter by exactly the PAL budget per frame", async () => {
    const { adapter } = make();
    await adapter.loadGame(sampleProfile());
    expect(adapter.cycleCounter).toBe(0n);
    adapter.start();
    for (let i = 1; i <= 10; i++) {
      adapter.stepFrame();
      expect(adapter.cycleCounter).toBe(BigInt(PAL_CYCLES_PER_FRAME) * BigInt(i));
    }
    expect(adapter.currentFrame).toBe(10);
    adapter.stop();
  });

  it("is deterministic: same media + frames + input => same framebuffer hash", async () => {
    const run = async (inputs: string[]) => {
      const { adapter } = make();
      await adapter.loadGame(sampleProfile());
      adapter.start();
      inputs.forEach((a) => adapter.pressInput(a, true));
      for (let i = 0; i < 5; i++) adapter.stepFrame();
      const h = sha(adapter.framebuffer()!);
      adapter.stop();
      return h;
    };
    const a = await run([]);
    expect(await run([])).toBe(a);
    expect(await run(["fire"])).not.toBe(a); // input lights a cell
    expect(await run(["fire"])).toBe(await run(["fire"]));
  });

  it("consumes the mounted media (bootblock magic selects colour vs grey) without mutating it", async () => {
    const dos = adfWithMagic("DOS\0");
    const other = adfWithMagic("XXXX");
    const before = [sha(dos), sha(other)];
    const fbOf = async (disk: Uint8Array) => {
      const { adapter } = make({ disk });
      await adapter.loadGame(sampleProfile());
      const fb = adapter.framebuffer()!;
      adapter.stop();
      return fb;
    };
    const color = await fbOf(dos);
    const grey = await fbOf(other);
    expect(sha(color)).not.toBe(sha(grey));
    // grey: r==g==b for every pixel
    for (let i = 0; i < grey.length; i += 4 * 997) expect(grey[i]).toBe(grey[i + 1]);
    expect(color.some((_, i) => i % 4 === 0 && color[i] !== color[i + 1])).toBe(true);
    expect([sha(dos), sha(other)]).toEqual(before);
  });

  it("copies media into core memory (source buffer is separate and untouched)", async () => {
    const inst = await referenceCoreLoader().load();
    const disk = adfWithMagic("DOS\0", 3);
    const a = new WasmAmigaAdapter({ loader: { load: async () => inst }, mediaProvider: () => disk, clock: new FakeClock() });
    await a.loadGame(sampleProfile());
    const mem = new Uint8Array((inst.exports as { memory: WebAssembly.Memory }).memory.buffer);
    const needle = disk.subarray(1000, 1032);
    let found = false;
    for (let i = 393216; i < mem.length - 32 && !found; i += 16) found = needle.every((v, k) => mem[i + 1000 + k] === v) || false;
    expect(found).toBe(true);
    expect(disk.buffer).not.toBe((inst.exports as { memory: WebAssembly.Memory }).memory.buffer);
  });

  it("boots the real rgme-scene-intro.adf fixture from concept/fixtures", async () => {
    const adf = readFileSync(fileURLToPath(new URL("../../../../concept/fixtures/rgme-scene-intro.adf", import.meta.url)));
    const { adapter } = make({ disk: new Uint8Array(adf) });
    await adapter.loadGame(sampleProfile());
    adapter.start();
    adapter.stepFrame();
    const fb = adapter.framebuffer()!;
    expect(fb.some((_, i) => i % 4 === 0 && fb[i] !== fb[i + 1])).toBe(true); // "DOS" bootblock => colour
    adapter.stop();
  });

  it("follows the MockRuntimeAdapter lifecycle and error behaviour", async () => {
    const { adapter } = make();
    expect(adapter.state).toBe("UNLOADED");
    expect(() => adapter.start()).toThrow(/Cannot start while UNLOADED/);
    expect(() => adapter.pause()).toThrow();
    expect(() => adapter.reset()).toThrow(/UNLOADED/);
    expect(() => adapter.saveState(0)).toThrow();
    await adapter.loadGame(sampleProfile());
    expect(adapter.state).toBe("LOADED");
    adapter.start();
    expect(adapter.state).toBe("RUNNING");
    adapter.pause();
    expect(adapter.state).toBe("PAUSED");
    adapter.start();
    adapter.stepFrame(); adapter.stepFrame();
    adapter.reset();
    expect(adapter.currentFrame).toBe(0);
    expect(adapter.cycleCounter).toBe(0n);
    expect(adapter.state).toBe("RUNNING");
    adapter.stop();
    expect(adapter.state).toBe("STOPPED");
    expect(() => adapter.start()).toThrow(/STOPPED/);
    expect(adapter.identifyCapabilities()).toMatchObject({ id: "wasm-amiga", frameRateHz: 50, saveStates: true });
  });

  it("maps joystick actions to the input mask and reports status events", async () => {
    const { adapter } = make();
    const seen: string[] = [];
    adapter.onStatus((s) => seen.push(s.state));
    await adapter.loadGame(sampleProfile());
    adapter.pressInput("left", true);
    adapter.pressInput("fire", true);
    expect(adapter.activeInputs).toEqual(["fire", "left"]);
    adapter.pressInput("left", false);
    expect(adapter.activeInputs).toEqual(["fire"]);
    expect(seen).toContain("LOADED");
  });

  it("save states and snapshots round-trip core state", async () => {
    const { adapter } = make();
    await adapter.loadGame(sampleProfile());
    adapter.start();
    for (let i = 0; i < 3; i++) adapter.stepFrame();
    const meta = adapter.saveState(2);
    const snap = adapter.exportSnapshot();
    const hashAt3 = sha(adapter.framebuffer()!);
    adapter.stepFrame(); adapter.stepFrame();
    expect(adapter.cycleCounter).toBe(BigInt(PAL_CYCLES_PER_FRAME) * 5n);
    adapter.loadState(2);
    expect(adapter.currentFrame).toBe(meta.frame);
    expect(adapter.cycleCounter).toBe(BigInt(PAL_CYCLES_PER_FRAME) * 3n);
    expect(sha(adapter.framebuffer()!)).toBe(hashAt3);
    adapter.stepFrame();
    adapter.importSnapshot(snap);
    expect(adapter.cycleCounter).toBe(BigInt(PAL_CYCLES_PER_FRAME) * 3n);
    expect(() => adapter.importSnapshot({ ...snap, adapterId: "mock" })).toThrow(/adapter/);
    expect(() => adapter.importSnapshot({ ...snap, profileId: "other" })).toThrow(/other/);
    expect(() => adapter.saveState(10)).toThrow(RangeError);
    expect(() => adapter.loadState(5)).toThrow(/empty/);
    adapter.stop();
  });

  it("runs at 50 frames per second on the scheduler clock, incl. under timer jitter", async () => {
    for (const jitter of [0, 3]) {
      const clock = new FakeClock(jitter);
      const { adapter } = make({ clock });
      await adapter.loadGame(sampleProfile());
      adapter.start();
      clock.advance(1000);
      expect(adapter.currentFrame).toBeGreaterThanOrEqual(jitter ? 48 : 50);
      expect(adapter.currentFrame).toBeLessThanOrEqual(50);
      clock.advance(1000);
      expect(adapter.currentFrame).toBeGreaterThanOrEqual(jitter ? 97 : 100);
      expect(adapter.currentFrame).toBeLessThanOrEqual(100);
      adapter.pause();
      const f = adapter.currentFrame;
      clock.advance(500);
      expect(adapter.currentFrame).toBe(f);
      adapter.stop();
    }
  });

  it("mounts further media via insertMediaAsync and rejects unsupported targets", async () => {
    const { adapter } = make();
    await adapter.loadGame(sampleProfile());
    const m = { id: "df1", kind: "adf" as const, filename: "b.adf", sha256: "b".repeat(64) };
    await adapter.insertMediaAsync(m); // DF0: swap
    expect(adapter.currentMedia.map((x) => x.id)).toContain("df1");
    await expect(adapter.insertMediaAsync(m, 1)).rejects.toThrow(/only supports DF0/);
    await expect(adapter.insertMediaAsync({ ...m, kind: "d64" })).rejects.toThrow(/ADF/);
    adapter.stop();
    await expect(adapter.insertMediaAsync(m)).rejects.toThrow(/STOPPED/);
  });
});

describe("FrameScheduler", () => {
  it("drops a huge backlog instead of replaying it", () => {
    const clock = new FakeClock();
    let n = 0;
    const s = new FrameScheduler(() => n++, clock, 20, 5);
    s.start();
    clock.advance(20); // first frame
    clock.t += 10_000; // tab throttled for 10 s without timers firing
    clock.advance(20);
    expect(n).toBeLessThanOrEqual(1 + 6);
    s.stop();
    expect(s.isRunning).toBe(false);
  });
});

describe("reference core build", () => {
  it("checked-in base64 matches a fresh compile of reference-core.wat", async () => {
    const wabtInit = (await import("wabt")).default;
    const wabt = await wabtInit();
    const wat = readFileSync(fileURLToPath(new URL("../wasm/reference-core.wat", import.meta.url)), "utf8");
    const m = wabt.parseWat("reference-core.wat", wat);
    m.validate();
    const fresh = Buffer.from(m.toBinary({ log: false, write_debug_names: false }).buffer);
    const { REFERENCE_CORE_WASM_SHA256 } = await import("../wasm/reference-core.js");
    expect(sha(fresh)).toBe(REFERENCE_CORE_WASM_SHA256);
  });
});
