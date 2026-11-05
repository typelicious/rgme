/**
 * Minimal Amiga-like boot environment for the partial 68000 core.
 *
 * Honest scope: this is NOT an Amiga emulator and does NOT contain Kickstart. It provides chip RAM, a tiny
 * custom-chip register file (colour registers, DMACON/INTENA/INTREQ set/clear semantics, a beam counter),
 * stubbed CIA reads, and a fake ExecBase whose library vectors trap with `UnimplementedLibraryCall`
 * instead of pretending to implement exec/trackdisk/graphics. Real bootblocks that call Kickstart will
 * therefore stop with an explicit error.
 *
 * Registers a real Kickstart provides at bootblock entry (exec/boot): A1 = IOStdReq (trackdisk request for
 * the boot drive), A6 = ExecBase; the bootblock is entered at offset 12 and returns D0 = 0 (success) with
 * A0 = DOS init code. We provide A1 (a zeroed stub request), A6 (the fake ExecBase) and a return address
 * that halts the machine with reason "bootblock-returned".
 */
import { M68kCpu, UnsupportedInstructionError, type Bus } from "./m68k.js";
import { PAL_CYCLES_PER_FRAME, PAL_COLOR_CLOCKS_PER_LINE, PAL_LINES } from "../wasm/timing.js";

export const CHIP_RAM_SIZE = 512 * 1024;
export const SLOW_RAM_BASE = 0xc00000;
export const CUSTOM_BASE = 0xdff000;
export const BOOT_ADDRESS = 0x20000;
export const EXEC_BASE = 0x400;
export const IOREQ_ADDRESS = 0x500;
export const RETURN_SENTINEL = 0x600;
const LIB_VECTORS = 160;
export const CYCLES_PER_LINE = PAL_COLOR_CLOCKS_PER_LINE * 2;
/** First visible beam line of the standard PAL display window ($2C). */
export const DISPLAY_FIRST_LINE = 44;

export class UnimplementedLibraryCall extends Error {
  constructor(public readonly lvo: number, public readonly pc: number) {
    super(`Unimplemented library call: exec.library LVO ${lvo} (called from $${pc.toString(16)}); Kickstart is not emulated`);
    this.name = "UnimplementedLibraryCall";
  }
}
export class BootblockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BootblockError";
  }
}

export type CustomWrite = { line: number; reg: number; value: number };

/** 32-bit sum over the 1024-byte bootblock with end-around carry must equal 0xFFFFFFFF (same rule as AdfParser). */
export function bootChecksumValid(bytes: Uint8Array): boolean {
  if (bytes.length < 1024) return false;
  const v = new DataView(bytes.buffer, bytes.byteOffset, 1024);
  let sum = 0;
  for (let i = 0; i < 256; i++) {
    sum += v.getUint32(i * 4, false);
    if (sum > 0xffffffff) sum = (sum & 0xffffffff) + 1;
  }
  return sum >>> 0 === 0xffffffff;
}

export class AmigaBus implements Bus {
  readonly chip = new Uint8Array(CHIP_RAM_SIZE);
  readonly slow?: Uint8Array;
  /** Custom registers by word index (offset >> 1). */
  readonly regs = new Uint16Array(0x100);
  dmacon = 0;
  intena = 0;
  intreq = 0;
  /** CPU cycle within the current frame, maintained by the machine for the beam counter. */
  frameCycle = 0;
  readonly colors = new Uint16Array(32);
  readonly writes: CustomWrite[] = [];
  readonly diskLog: number[] = [];
  /** COLOR00 as seen at the start of each beam line of the current frame. */
  readonly color00Lines = new Uint16Array(PAL_LINES);

  constructor(slowKb = 0) {
    if (slowKb > 0) this.slow = new Uint8Array(slowKb * 1024);
  }

  get beamLine() {
    return Math.min(PAL_LINES - 1, Math.floor(this.frameCycle / CYCLES_PER_LINE));
  }
  get beamClock() {
    return Math.floor((this.frameCycle % CYCLES_PER_LINE) / 2);
  }

  private ramRef(addr: number): [Uint8Array, number] | undefined {
    if (addr < CHIP_RAM_SIZE) return [this.chip, addr];
    if (this.slow && addr >= SLOW_RAM_BASE && addr < SLOW_RAM_BASE + this.slow.length) return [this.slow, addr - SLOW_RAM_BASE];
    return undefined;
  }
  private isCustom(addr: number) {
    return addr >= CUSTOM_BASE && addr < CUSTOM_BASE + 0x200;
  }
  private isCia(addr: number) {
    return addr >= 0xbfd000 && addr < 0xbff000;
  }

  private readCustom(off: number): number {
    switch (off) {
      case 0x002: return this.dmacon & 0x07ff;
      case 0x004: return (this.beamLine >> 8) & 1; // VPOSR: chip id 0 (OCS), LOF 0
      case 0x006: return ((this.beamLine & 0xff) << 8) | (this.beamClock & 0xff); // VHPOSR
      case 0x01c: return this.intena & 0x7fff;
      case 0x01e: return this.intreq & 0x7fff;
      default: return this.regs[off >> 1]!;
    }
  }
  private writeCustom(off: number, v: number) {
    v &= 0xffff;
    const setClr = (cur: number) => (v & 0x8000 ? cur | (v & 0x7fff) : cur & ~(v & 0x7fff));
    if (off === 0x096) this.dmacon = setClr(this.dmacon);
    else if (off === 0x09a) this.intena = setClr(this.intena);
    else if (off === 0x09c) this.intreq = setClr(this.intreq);
    else if (off === 0x024) this.diskLog.push(v); // DSKLEN: logged, no disk DMA
    else if (off >= 0x180 && off < 0x1c0) {
      const i = (off - 0x180) >> 1;
      this.colors[i] = v & 0xfff;
      if (i === 0) this.color00Lines.fill(v & 0xfff, this.beamLine);
    }
    this.regs[off >> 1] = v;
    this.writes.push({ line: this.beamLine, reg: off, value: v });
  }

  read8(a: number): number {
    const r = this.ramRef(a);
    if (r) return r[0][r[1]]!;
    if (this.isCustom(a)) { const w = this.readCustom((a - CUSTOM_BASE) & ~1); return a & 1 ? w & 0xff : w >> 8; }
    if (this.isCia(a)) return a === 0xbfe001 ? 0xff : 0; // CIAA PRA: fire buttons released (active low)
    return 0;
  }
  read16(a: number): number {
    const r = this.ramRef(a);
    if (r) return (r[0][r[1]]! << 8) | r[0][r[1] + 1]!;
    if (this.isCustom(a)) return this.readCustom(a - CUSTOM_BASE);
    return (this.read8(a) << 8) | this.read8(a + 1);
  }
  read32(a: number): number {
    return ((this.read16(a) << 16) | this.read16(a + 2)) >>> 0;
  }
  write8(a: number, v: number) {
    const r = this.ramRef(a);
    if (r) { r[0][r[1]] = v; return; }
    if (this.isCustom(a)) this.writeCustom((a - CUSTOM_BASE) & ~1, ((v & 0xff) << 8) | (v & 0xff)); // byte writes appear on both halves
  }
  write16(a: number, v: number) {
    const r = this.ramRef(a);
    if (r) { r[0][r[1]] = (v >> 8) & 0xff; r[0][r[1] + 1] = v & 0xff; return; }
    if (this.isCustom(a)) { this.writeCustom(a - CUSTOM_BASE, v); return; }
  }
  write32(a: number, v: number) {
    this.write16(a, (v >>> 16) & 0xffff);
    this.write16(a + 2, v & 0xffff);
  }
  reset() {
    this.dmacon = 0;
    this.intena = 0;
    this.intreq = 0;
  }
}

export type HaltReason = "bootblock-returned" | "error";

export interface FrameResult {
  cycles: number;
  halted: boolean;
  haltReason?: HaltReason;
  error?: Error;
}

export interface TraceEntry {
  pc: number;
  opcode: number;
}

export interface MachineSnapshot {
  chip: Uint8Array;
  slow?: Uint8Array;
  regs: Uint16Array;
  dmacon: number;
  intena: number;
  intreq: number;
  colors: Uint16Array;
  d: number[];
  a: number[];
  pc: number;
  sr: number;
  usp: number;
  ssp: number;
  steps: number;
  frames: number;
  halted: boolean;
  haltReason?: HaltReason;
}

export class AmigaBootMachine {
  readonly bus: AmigaBus;
  readonly cpu: M68kCpu;
  halted = false;
  haltReason?: HaltReason;
  error?: Error;
  stepsExecuted = 0;
  frames = 0;
  private trace: TraceEntry[] = [];
  private traceNext = 0;

  constructor(opts: { slowKb?: number; traceSize?: number } = {}) {
    this.bus = new AmigaBus(opts.slowKb ?? 0);
    this.cpu = new M68kCpu(this.bus);
    this.traceSize = opts.traceSize ?? 64;
  }
  private readonly traceSize: number;

  get colors(): Uint16Array {
    return this.bus.colors;
  }
  /** Last executed instructions, oldest first. */
  get instructionTrace(): TraceEntry[] {
    return [...this.trace.slice(this.traceNext), ...this.trace.slice(0, this.traceNext)];
  }

  /** Builds the fake ExecBase: AbsExecBase at $4, and LVO slots that trap (ILLEGAL) instead of faking Kickstart. */
  private installExec() {
    const b = this.bus;
    b.write32(4, EXEC_BASE);
    for (let i = 1; i <= LIB_VECTORS; i++) b.write16(EXEC_BASE - 6 * i, 0x4afc); // ILLEGAL marks "library call not implemented"
    b.write16(RETURN_SENTINEL, 0x4afc);
    // zeroed IOStdReq stub at IOREQ_ADDRESS (48 bytes)
    for (let i = 0; i < 48; i++) b.write8(IOREQ_ADDRESS + i, 0);
  }

  /**
   * Loads the 1024-byte bootblock of an ADF (verifies 'DOS' magic + checksum), places it in chip RAM and
   * prepares registers like Kickstart's boot code. Throws BootblockError for non-bootable disks.
   */
  loadBootblock(adf: Uint8Array) {
    if (adf.length < 1024) throw new BootblockError("Image too small for a bootblock");
    if (adf[0] !== 0x44 || adf[1] !== 0x4f || adf[2] !== 0x53) throw new BootblockError("Not a DOS disk (missing 'DOS' bootblock magic)");
    if (!bootChecksumValid(adf)) throw new BootblockError("Bootblock checksum is invalid: the disk is not bootable");
    this.bus.chip.fill(0);
    this.installExec();
    this.bus.chip.set(adf.subarray(0, 1024), BOOT_ADDRESS);
    const c = this.cpu;
    c.d.fill(0);
    c.a.fill(0);
    c.ssp = 0x7ff00;
    c.usp = 0x7f000;
    c.sr = 0; // user mode like the boot task; interrupt mask 0
    c.a[7] = c.usp;
    c.a[1] = IOREQ_ADDRESS;
    c.a[6] = EXEC_BASE;
    c.a[7] = (c.a[7]! - 4) >>> 0;
    this.bus.write32(c.a[7]!, RETURN_SENTINEL);
    c.pc = BOOT_ADDRESS + 12;
    c.cycles = 0;
    this.halted = false;
    this.haltReason = undefined;
    this.error = undefined;
    this.stepsExecuted = 0;
    this.frames = 0;
    this.trace = [];
    this.traceNext = 0;
    this.bus.colors.fill(0);
    this.bus.regs.fill(0);
    this.bus.writes.length = 0;
    this.bus.color00Lines.fill(0);
    this.bus.frameCycle = 0;
  }

  private halt(reason: HaltReason, error?: Error) {
    this.halted = true;
    this.haltReason = reason;
    this.error = error;
  }

  private mapError(e: unknown): Error {
    if (e instanceof UnsupportedInstructionError && e.opcode === 0x4afc) {
      const lo = EXEC_BASE - 6 * LIB_VECTORS;
      if (e.pc >= lo && e.pc < EXEC_BASE) {
        const lvo = -(EXEC_BASE - e.pc);
        return new UnimplementedLibraryCall(lvo, this.callerOf());
      }
    }
    return e instanceof Error ? e : new Error(String(e));
  }
  private callerOf(): number {
    const sp = this.cpu.a[7]!;
    return this.bus.read32(sp);
  }

  /** Executes one frame (PAL: 312 lines x 227 colour clocks x 2 = 141,648 CPU cycles). */
  runFrame(): FrameResult {
    const bus = this.bus;
    bus.writes.length = 0;
    bus.frameCycle = 0;
    bus.color00Lines.fill(bus.colors[0]!);
    if (this.halted) return { cycles: 0, halted: true, haltReason: this.haltReason, error: this.error };
    let used = 0;
    while (used < PAL_CYCLES_PER_FRAME) {
      if (this.cpu.pc === RETURN_SENTINEL) {
        this.halt("bootblock-returned");
        break;
      }
      const pc = this.cpu.pc;
      try {
        bus.frameCycle = used;
        const c = this.cpu.step();
        used += c;
        this.stepsExecuted++;
        const entry = { pc, opcode: this.cpu.lastOpcode };
        if (this.trace.length < this.traceSize) this.trace.push(entry);
        else {
          this.trace[this.traceNext] = entry;
          this.traceNext = (this.traceNext + 1) % this.traceSize;
        }
      } catch (e) {
        this.halt("error", this.mapError(e));
        break;
      }
    }
    this.frames++;
    return { cycles: used, halted: this.halted, haltReason: this.haltReason, error: this.error };
  }

  snapshot(): MachineSnapshot {
    const c = this.cpu;
    return {
      chip: this.bus.chip.slice(),
      slow: this.bus.slow?.slice(),
      regs: this.bus.regs.slice(),
      dmacon: this.bus.dmacon,
      intena: this.bus.intena,
      intreq: this.bus.intreq,
      colors: this.bus.colors.slice(),
      d: [...c.d],
      a: [...c.a],
      pc: c.pc,
      sr: c.sr,
      usp: c.usp,
      ssp: c.ssp,
      steps: this.stepsExecuted,
      frames: this.frames,
      halted: this.halted,
      haltReason: this.haltReason
    };
  }
  restore(s: MachineSnapshot) {
    this.bus.chip.set(s.chip);
    if (s.slow && this.bus.slow) this.bus.slow.set(s.slow);
    this.bus.regs.set(s.regs);
    this.bus.dmacon = s.dmacon;
    this.bus.intena = s.intena;
    this.bus.intreq = s.intreq;
    this.bus.colors.set(s.colors);
    s.d.forEach((v, i) => (this.cpu.d[i] = v));
    s.a.forEach((v, i) => (this.cpu.a[i] = v));
    this.cpu.pc = s.pc;
    this.cpu.sr = s.sr;
    this.cpu.usp = s.usp;
    this.cpu.ssp = s.ssp;
    this.stepsExecuted = s.steps;
    this.frames = s.frames;
    this.halted = s.halted;
    this.haltReason = s.haltReason;
    this.error = undefined;
  }
}
