import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  AmigaBootMachine, AmigaBus, BOOT_ADDRESS, BootblockError, EXEC_BASE, M68kBootAdapter, RETURN_SENTINEL,
  UnimplementedLibraryCall, UnsupportedInstructionError, bootChecksumValid, AdfParser, ADF_SIZE
} from "../index.js";
import type { CanvasLike } from "../mock-runtime.js";
import { sampleProfile } from "./fixtures.js";

const l = (v: number): number[] => [(v >>> 16) & 0xffff, v & 0xffff];

/** Builds a bootable 880 KB ADF whose bootblock contains the given 16-bit words at offset 12 (valid checksum). */
function bootAdf(words: number[], opts: { magic?: boolean; checksum?: boolean } = {}): Uint8Array {
  const d = new Uint8Array(901120);
  const v = new DataView(d.buffer);
  if (opts.magic !== false) d.set([0x44, 0x4f, 0x53, 0]);
  words.forEach((w, i) => v.setUint16(12 + i * 2, w, false));
  v.setUint32(4, 0, false);
  let sum = 0;
  for (let i = 0; i < 256; i++) {
    sum += v.getUint32(i * 4, false);
    if (sum > 0xffffffff) sum = (sum & 0xffffffff) + 1;
  }
  if (opts.checksum !== false) v.setUint32(4, ~sum >>> 0, false);
  return d;
}

const FIXTURE = readFileSync(fileURLToPath(new URL("../../../../concept/fixtures/rgme-scene-intro.adf", import.meta.url)));
const fixtureBytes = new Uint8Array(FIXTURE.buffer, FIXTURE.byteOffset, FIXTURE.byteLength);

// MOVE.W #$0F00,$DFF180 ; loop: MOVE.W #$000F,$DFF180 ; BRA.B loop
const COLOR_LOOP = [0x33fc, 0x0f00, ...l(0xdff180), 0x33fc, 0x000f, ...l(0xdff180), 0x60f6];
// loop: MOVE.W $DFF006,D0 ; MOVE.W D0,$DFF180 ; BRA.B loop   (rasterbars: colour follows the beam)
const RASTER_LOOP = [0x3039, ...l(0xdff006), 0x33c0, ...l(0xdff180), 0x60f2];

function recordingCanvas() {
  const fills: string[] = [];
  const texts: string[] = [];
  const ctx = {
    fillStyle: "" as string | CanvasGradient | CanvasPattern,
    font: "",
    fillRect: () => void fills.push(String(ctx.fillStyle)),
    fillText: (t: string) => void texts.push(t)
  };
  const canvas: CanvasLike = { width: 0, height: 0, getContext: () => ctx };
  return { canvas, fills, texts };
}

describe("bootblock loading", () => {
  it("accepts a valid bootblock and agrees with AdfParser on the checksum", () => {
    expect(bootChecksumValid(fixtureBytes)).toBe(true);
    expect(new AdfParser(fixtureBytes).parse().bootChecksumValid).toBe(true);
    expect(fixtureBytes.length).toBe(ADF_SIZE);
  });
  it("rejects missing magic and bad checksums with a BootblockError", () => {
    expect(() => new AmigaBootMachine().loadBootblock(bootAdf(COLOR_LOOP, { magic: false }))).toThrow(BootblockError);
    expect(() => new AmigaBootMachine().loadBootblock(bootAdf(COLOR_LOOP, { checksum: false }))).toThrow(/checksum/);
    expect(() => new AmigaBootMachine().loadBootblock(new Uint8Array(100))).toThrow(BootblockError);
  });
  it("prepares registers like Kickstart: A6 = ExecBase, A1 = IOStdReq, entry at bootblock+12, original untouched", () => {
    const adf = bootAdf(COLOR_LOOP);
    const copy = adf.slice();
    const m = new AmigaBootMachine();
    m.loadBootblock(adf);
    expect(m.cpu.pc).toBe(BOOT_ADDRESS + 12);
    expect(m.cpu.a[6]).toBe(EXEC_BASE);
    expect(m.cpu.a[1]).toBeGreaterThan(0);
    expect(m.bus.read32(4)).toBe(EXEC_BASE);
    expect(m.bus.read32(m.cpu.a[7]!)).toBe(RETURN_SENTINEL);
    expect(m.bus.read32(BOOT_ADDRESS)).toBe(new DataView(adf.buffer).getUint32(0, false));
    expect(adf.every((b, i) => b === copy[i])).toBe(true);
  });
});

describe("custom chip register file", () => {
  it("DMACON/INTENA/INTREQ implement set/clear semantics", () => {
    const b = new AmigaBus();
    b.write16(0xdff096, 0x8000 | 0x0180); // set
    b.write16(0xdff096, 0x0100); // clear bit 8
    expect(b.read16(0xdff002)).toBe(0x0080);
    b.write16(0xdff09a, 0xc000);
    expect(b.read16(0xdff01c)).toBe(0x4000);
    b.write16(0xdff09c, 0x8004);
    b.write16(0xdff09c, 0x0004);
    expect(b.read16(0xdff01e)).toBe(0);
  });
  it("VHPOSR/VPOSR follow elapsed cycles (454 cycles per line)", () => {
    const b = new AmigaBus();
    b.frameCycle = 454 * 100 + 40;
    expect(b.read16(0xdff006) >> 8).toBe(100);
    expect(b.read16(0xdff006) & 0xff).toBe(20);
    b.frameCycle = 454 * 300;
    expect(b.read16(0xdff004) & 1).toBe(1); // line 300 has V8 set
    expect(b.read16(0xdff006) >> 8).toBe(300 & 0xff);
  });
  it("colour registers mask to 12 bits; CIA reads are stubbed; DSKLEN is logged", () => {
    const b = new AmigaBus();
    b.write16(0xdff182, 0xffff);
    expect(b.colors[1]).toBe(0x0fff);
    expect(b.read8(0xbfe001)).toBe(0xff);
    expect(b.read8(0xbfd000)).toBe(0);
    b.write16(0xdff024, 0x8123);
    expect(b.diskLog).toEqual([0x8123]);
  });
});

describe("running bootblocks", () => {
  it("executes a COLOR00 loop for a whole frame without halting", () => {
    const m = new AmigaBootMachine();
    m.loadBootblock(bootAdf(COLOR_LOOP));
    const r = m.runFrame();
    expect(r.halted).toBe(false);
    expect(r.cycles).toBeGreaterThanOrEqual(141_648);
    expect(r.cycles).toBeLessThan(141_648 + 64);
    expect(m.colors[0]).toBe(0x000f);
    expect(m.stepsExecuted).toBeGreaterThan(1000);
    expect(m.instructionTrace.length).toBeGreaterThan(0);
  });
  it("records per-line COLOR00 changes (rasterbars follow the beam)", () => {
    const m = new AmigaBootMachine();
    m.loadBootblock(bootAdf(RASTER_LOOP));
    m.runFrame();
    const distinct = new Set(m.bus.color00Lines);
    expect(distinct.size).toBeGreaterThan(100);
  });
  it("halts with 'bootblock-returned' when the code executes RTS", () => {
    const m = new AmigaBootMachine();
    m.loadBootblock(bootAdf([0x7005, 0x4e75])); // MOVEQ #5,D0 ; RTS
    const r = m.runFrame();
    expect(r.halted).toBe(true);
    expect(r.haltReason).toBe("bootblock-returned");
    expect(m.cpu.d[0]).toBe(5);
  });
  it("calls into exec raise UnimplementedLibraryCall instead of faking Kickstart", () => {
    const m = new AmigaBootMachine();
    m.loadBootblock(bootAdf([0x4eae, 0xfdd8])); // JSR -552(A6)
    const r = m.runFrame();
    expect(r.halted).toBe(true);
    expect(r.error).toBeInstanceOf(UnimplementedLibraryCall);
    expect((r.error as UnimplementedLibraryCall).lvo).toBe(-552);
    expect((r.error as UnimplementedLibraryCall).pc).toBe(BOOT_ADDRESS + 12 + 4);
  });
  it("unsupported instructions halt with the opcode and address", () => {
    const m = new AmigaBootMachine();
    m.loadBootblock(bootAdf([0x7001, 0x4e40])); // MOVEQ ; TRAP #0
    const r = m.runFrame();
    expect(r.error).toBeInstanceOf(UnsupportedInstructionError);
    expect((r.error as UnsupportedInstructionError).opcode).toBe(0x4e40);
    expect((r.error as UnsupportedInstructionError).pc).toBe(BOOT_ADDRESS + 14);
    expect(m.runFrame().cycles).toBe(0); // stays halted
  });
  it("snapshot/restore round-trips CPU and memory", () => {
    const m = new AmigaBootMachine();
    m.loadBootblock(bootAdf([0x5280, 0x60fc])); // loop: ADDQ.L #1,D0 ; BRA.B loop
    m.runFrame();
    const snap = m.snapshot();
    const d0 = m.cpu.d[0]!;
    m.runFrame();
    expect(m.cpu.d[0]).not.toBe(d0);
    m.restore(snap);
    expect(m.cpu.d[0]).toBe(d0);
  });
});

describe("the real fixture: concept/fixtures/rgme-scene-intro.adf", () => {
  /**
   * Observed behaviour (asserted so it cannot silently change): the fixture's bootblock is a valid DOS
   * bootblock (magic + checksum) but its "code" at offset 12 is the ASCII banner text "RGME SCENE INTRO ...".
   * The first two bytes "RG" decode as ADDQ.W #1,D7 (0x5247); the next word "ME" (0x4D45) is CHK, which
   * this partial core does not implement, so execution stops there with an explicit error.
   */
  it("executes ADDQ.W #1,D7 and then halts at the CHK opcode taken from the ASCII banner", () => {
    const m = new AmigaBootMachine();
    m.loadBootblock(fixtureBytes);
    expect(m.bus.read16(BOOT_ADDRESS + 12)).toBe(0x5247);
    const r = m.runFrame();
    expect(r.halted).toBe(true);
    expect(r.haltReason).toBe("error");
    expect(r.error).toBeInstanceOf(UnsupportedInstructionError);
    const e = r.error as UnsupportedInstructionError;
    expect(e.opcode).toBe(0x4d45);
    expect(e.pc).toBe(BOOT_ADDRESS + 14);
    expect(m.cpu.d[7]).toBe(1); // ADDQ.W #1,D7 really ran
    expect(m.stepsExecuted).toBe(1);
    expect(m.instructionTrace[0]).toEqual({ pc: BOOT_ADDRESS + 12, opcode: 0x5247 });
  });
});

describe("M68kBootAdapter", () => {
  const profile = sampleProfile();
  const provider = (adf: Uint8Array) => () => adf;

  it("walks UNLOADED -> LOADED -> RUNNING -> PAUSED -> STOPPED with MockRuntimeAdapter's error behaviour", async () => {
    const a = new M68kBootAdapter({ mediaProvider: provider(bootAdf(COLOR_LOOP)) });
    expect(a.state).toBe("UNLOADED");
    expect(() => a.start()).toThrow();
    expect(() => a.reset()).toThrow();
    expect(() => a.saveState(0)).toThrow();
    await a.loadGame(profile);
    expect(a.state).toBe("LOADED");
    a.start();
    expect(a.state).toBe("RUNNING");
    a.pause();
    expect(a.state).toBe("PAUSED");
    a.start();
    a.stop();
    expect(a.state).toBe("STOPPED");
    expect(() => a.pause()).toThrow();
  });
  it("is honest about its capabilities", () => {
    const a = new M68kBootAdapter({ mediaProvider: provider(bootAdf(COLOR_LOOP)) });
    expect(a.identifyCapabilities()).toMatchObject({ id: "m68k-boot", emulation: "partial-68000", frameRateHz: 50 });
  });
  it("rejects non-bootable media and non-Amiga profiles", async () => {
    const bad = new M68kBootAdapter({ mediaProvider: provider(bootAdf(COLOR_LOOP, { checksum: false })) });
    await expect(bad.loadGame(profile)).rejects.toBeInstanceOf(BootblockError);
    const ok = new M68kBootAdapter({ mediaProvider: provider(bootAdf(COLOR_LOOP)) });
    await expect(ok.loadGame({ ...profile, platform: "c64" })).rejects.toThrow(/Amiga/);
  });
  it("renders COLOR00 per beam line to the canvas (one frame per stepFrame)", async () => {
    const { canvas, fills } = recordingCanvas();
    const a = new M68kBootAdapter({ mediaProvider: provider(bootAdf(RASTER_LOOP)), canvas });
    expect(canvas.width).toBe(320);
    expect(canvas.height).toBe(256);
    await a.loadGame(profile);
    a.start();
    fills.length = 0;
    const r = a.stepFrame();
    expect(r?.halted).toBe(false);
    expect(a.currentFrame).toBe(1);
    expect(fills).toHaveLength(256);
    expect(new Set(fills).size).toBeGreaterThan(50);
    a.stop();
  });
  it("shows a HALTED overlay with PC and error when the program stops", async () => {
    const { canvas, texts } = recordingCanvas();
    const a = new M68kBootAdapter({ mediaProvider: provider(fixtureBytes), canvas });
    await a.loadGame(profile);
    a.start();
    a.stepFrame();
    expect(texts.some((t) => t.startsWith("HALTED PC=$"))).toBe(true);
    expect(texts.some((t) => t.includes("Unsupported 68000 instruction $4d45"))).toBe(true);
    a.stop();
  });
  it("save/load state restores the machine and frame counter; reset reboots", async () => {
    const a = new M68kBootAdapter({ mediaProvider: provider(bootAdf([0x5280, 0x60fc])) });
    await a.loadGame(profile);
    a.start();
    a.stepFrame();
    const meta = a.saveState(2);
    const d0 = a.cpuMachine.cpu.d[0];
    a.stepFrame();
    a.stepFrame();
    expect(a.loadState(2).frame).toBe(meta.frame);
    expect(a.cpuMachine.cpu.d[0]).toBe(d0);
    expect(() => a.loadState(3)).toThrow(/empty/);
    expect(() => a.saveState(10)).toThrow(RangeError);
    a.reset();
    expect(a.currentFrame).toBe(0);
    expect(a.cpuMachine.cpu.d[0]).toBe(0);
    a.stop();
  });
  it("reads the boot media through the provider with the profile's media entry", async () => {
    const seen: string[] = [];
    const a = new M68kBootAdapter({ mediaProvider: (m) => { seen.push(m.id); return bootAdf(COLOR_LOOP); } });
    await a.loadGame(profile);
    expect(seen).toEqual(["df0"]);
  });
});
