/**
 * Motorola 68000 interpreter (PARTIAL).
 *
 * Honest scope: a documented subset of the 68000 instruction set with correct condition-code semantics.
 * NOT implemented: exceptions/interrupt dispatch, TRAP, CHK, TAS, STOP, MOVEP, BCD, ADDX/SUBX/NEGX/CMPM,
 * ROXL/ROXR, 68010+ opcodes. Every opcode outside the subset halts execution with an explicit
 * `UnsupportedInstructionError`; nothing is silently skipped. Cycle counts use the documented 68000
 * timings for the common forms (EA time table + per-instruction base); the rarer forms use the
 * approximations noted in the code, and there is no bus-contention / DMA slot modelling.
 */

export interface Bus {
  read8(addr: number): number;
  read16(addr: number): number;
  read32(addr: number): number;
  write8(addr: number, value: number): void;
  write16(addr: number, value: number): void;
  write32(addr: number, value: number): void;
  /** Called by the RESET instruction (optional). */
  reset?(): void;
}

export class UnsupportedInstructionError extends Error {
  constructor(public readonly opcode: number, public readonly pc: number, detail = "") {
    super(`Unsupported 68000 instruction $${opcode.toString(16).padStart(4, "0")} at $${pc.toString(16).padStart(6, "0")}${detail ? ` (${detail})` : ""}`);
    this.name = "UnsupportedInstructionError";
  }
}
export class AddressError extends Error {
  constructor(public readonly address: number, public readonly pc: number, public readonly write: boolean) {
    super(`Address error: ${write ? "write" : "read"} of word/long at odd address $${address.toString(16)} (PC $${pc.toString(16)})`);
    this.name = "AddressError";
  }
}
export class DivideByZeroError extends Error {
  constructor(public readonly pc: number) {
    super(`Division by zero at $${pc.toString(16).padStart(6, "0")}`);
    this.name = "DivideByZeroError";
  }
}
export class PrivilegeViolationError extends Error {
  constructor(public readonly opcode: number, public readonly pc: number) {
    super(`Privilege violation: $${opcode.toString(16).padStart(4, "0")} at $${pc.toString(16).padStart(6, "0")} (user mode)`);
    this.name = "PrivilegeViolationError";
  }
}

export type Size = 1 | 2 | 4;

export const SR_C = 0x01, SR_V = 0x02, SR_Z = 0x04, SR_N = 0x08, SR_X = 0x10, SR_S = 0x2000, SR_T = 0x8000;
const SR_MASK = 0xa71f;

const MASK: Record<Size, number> = { 1: 0xff, 2: 0xffff, 4: 0xffffffff };
const MSB: Record<Size, number> = { 1: 0x80, 2: 0x8000, 4: 0x80000000 };
const BITS: Record<Size, number> = { 1: 8, 2: 16, 4: 32 };

const u = (v: number, s: Size): number => (s === 4 ? v >>> 0 : v & MASK[s]);
const sx = (v: number, s: Size): number => (s === 1 ? (v << 24) >> 24 : s === 2 ? (v << 16) >> 16 : v | 0);
const sx8 = (v: number) => (v << 24) >> 24;
const sx16 = (v: number) => (v << 16) >> 16;

/** Operand: 0 = Dn, 1 = An, 2 = memory (n = address), 3 = immediate (n = value). */
interface Op {
  t: 0 | 1 | 2 | 3;
  n: number;
}

/** EA time (cycles) for word/byte operands by mode; long = +4 for every non-register mode. */
function eaCycles(mode: number, reg: number, size: Size): number {
  let c: number;
  switch (mode) {
    case 0: case 1: return 0;
    case 2: case 3: c = 4; break;
    case 4: c = 6; break;
    case 5: c = 8; break;
    case 6: c = 10; break;
    default:
      c = reg === 0 ? 8 : reg === 1 ? 12 : reg === 2 ? 8 : reg === 3 ? 10 : 4;
  }
  return size === 4 ? c + 4 : c;
}

export class M68kCpu {
  readonly d = new Uint32Array(8);
  /** A0-A7; a[7] is the ACTIVE stack pointer (USP in user mode, SSP in supervisor mode). */
  readonly a = new Uint32Array(8);
  pc = 0;
  sr = 0x2700;
  usp = 0;
  ssp = 0;
  /** Total cycles executed. */
  cycles = 0;
  /** Address / opcode of the most recently fetched instruction. */
  lastPc = 0;
  lastOpcode = 0;
  private cyc = 0;

  constructor(public bus: Bus) {}

  // ---- status register ----
  get supervisor() {
    return (this.sr & SR_S) !== 0;
  }
  flag(mask: number) {
    return (this.sr & mask) !== 0;
  }
  private setFlag(mask: number, on: boolean) {
    this.sr = on ? this.sr | mask : this.sr & ~mask;
  }
  setSR(v: number) {
    const next = v & SR_MASK;
    if ((next ^ this.sr) & SR_S) {
      if (this.sr & SR_S) this.ssp = this.a[7]!;
      else this.usp = this.a[7]!;
      this.a[7] = (next & SR_S ? this.ssp : this.usp) >>> 0;
    }
    this.sr = next;
  }

  /** Like the real chip: SSP from vector 0, PC from vector 4, supervisor mode, interrupts masked. */
  reset(bus: Bus = this.bus) {
    this.bus = bus;
    this.d.fill(0);
    this.a.fill(0);
    this.sr = SR_S | 0x0700;
    this.usp = 0;
    this.ssp = this.rd(0, 4) >>> 0;
    this.a[7] = this.ssp;
    this.pc = this.rd(4, 4) >>> 0;
    this.cycles = 0;
  }

  // ---- memory (24-bit address bus, odd word/long access => AddressError) ----
  private rd(addr: number, size: Size): number {
    addr >>>= 0;
    if (size > 1 && addr & 1) throw new AddressError(addr, this.lastPc, false);
    const a = addr & 0xffffff;
    return size === 1 ? this.bus.read8(a) : size === 2 ? this.bus.read16(a) : this.bus.read32(a) >>> 0;
  }
  private wr(addr: number, size: Size, v: number) {
    addr >>>= 0;
    if (size > 1 && addr & 1) throw new AddressError(addr, this.lastPc, true);
    const a = addr & 0xffffff;
    if (size === 1) this.bus.write8(a, v & 0xff);
    else if (size === 2) this.bus.write16(a, v & 0xffff);
    else this.bus.write32(a, v >>> 0);
  }
  private fetch16(): number {
    const v = this.rd(this.pc, 2);
    this.pc = (this.pc + 2) >>> 0;
    return v;
  }
  private fetch32(): number {
    const hi = this.fetch16();
    return ((hi << 16) | this.fetch16()) >>> 0;
  }
  private push32(v: number) {
    this.a[7] = (this.a[7]! - 4) >>> 0;
    this.wr(this.a[7]!, 4, v);
  }
  private pop32(): number {
    const v = this.rd(this.a[7]!, 4);
    this.a[7] = (this.a[7]! + 4) >>> 0;
    return v;
  }

  // ---- effective addresses ----
  private unsupported(op: number, detail = ""): never {
    throw new UnsupportedInstructionError(op, this.lastPc, detail);
  }

  private ea(mode: number, reg: number, size: Size, opcode: number): Op {
    this.cyc += eaCycles(mode, reg, size);
    switch (mode) {
      case 0: return { t: 0, n: reg };
      case 1: return { t: 1, n: reg };
      case 2: return { t: 2, n: this.a[reg]! };
      case 3: {
        const addr = this.a[reg]!;
        this.a[reg] = (addr + (size === 1 && reg === 7 ? 2 : size)) >>> 0;
        return { t: 2, n: addr };
      }
      case 4: {
        this.a[reg] = (this.a[reg]! - (size === 1 && reg === 7 ? 2 : size)) >>> 0;
        return { t: 2, n: this.a[reg]! };
      }
      case 5: return { t: 2, n: (this.a[reg]! + sx16(this.fetch16())) >>> 0 };
      case 6: return { t: 2, n: (this.a[reg]! + this.indexed()) >>> 0 };
      default:
        switch (reg) {
          case 0: return { t: 2, n: sx16(this.fetch16()) >>> 0 };
          case 1: return { t: 2, n: this.fetch32() };
          case 2: { const base = this.pc; return { t: 2, n: (base + sx16(this.fetch16())) >>> 0 }; }
          case 3: { const base = this.pc; return { t: 2, n: (base + this.indexed()) >>> 0 }; }
          case 4: return { t: 3, n: size === 4 ? this.fetch32() : size === 2 ? this.fetch16() : this.fetch16() & 0xff };
          default: return this.unsupported(opcode, "invalid effective address");
        }
    }
  }
  /** Brief extension word: d8(An/PC, Xn.size*1). Returns displacement + index (without the base). */
  private indexed(): number {
    const ext = this.fetch16();
    const r = (ext >> 12) & 7;
    let xn = ext & 0x8000 ? this.a[r]! : this.d[r]!;
    if (!(ext & 0x800)) xn = sx16(xn);
    return sx8(ext & 0xff) + (xn | 0);
  }

  private read(o: Op, size: Size): number {
    switch (o.t) {
      case 0: return u(this.d[o.n]!, size);
      case 1: return u(this.a[o.n]!, size);
      case 2: return this.rd(o.n, size);
      default: return o.n;
    }
  }
  private write(o: Op, size: Size, v: number) {
    switch (o.t) {
      case 0: {
        const keep = size === 4 ? 0 : (this.d[o.n]! & ~MASK[size]) >>> 0;
        this.d[o.n] = (keep | u(v, size)) >>> 0;
        return;
      }
      case 1: this.a[o.n] = size === 2 ? sx16(v) >>> 0 : v >>> 0; return;
      case 2: this.wr(o.n, size, v); return;
      default: throw new Error("cannot write to an immediate operand");
    }
  }
  /** Address of a control-mode operand (LEA/PEA/JMP/JSR/MOVEM). */
  private controlAddr(mode: number, reg: number, opcode: number): number {
    if (mode === 2 || mode === 5 || mode === 6 || (mode === 7 && reg <= 3)) {
      const before = this.cyc;
      const addr = this.ea(mode, reg, 2, opcode).n;
      this.cyc = before; // callers add the documented per-instruction totals
      return addr;
    }
    return this.unsupported(opcode, "invalid control addressing mode");
  }
  /** Documented totals indexed by (An), d16(An), d8(An,Xn), abs.W, abs.L, d16(PC), d8(PC,Xn). */
  private ctl(mode: number, reg: number, t: readonly number[]): number {
    const i = mode === 2 ? 0 : mode === 5 ? 1 : mode === 6 ? 2 : reg === 0 ? 3 : reg === 1 ? 4 : reg === 2 ? 5 : 6;
    return t[i]!;
  }

  // ---- flags ----
  private nz(res: number, size: Size) {
    this.setFlag(SR_N, (res & MSB[size]) !== 0);
    this.setFlag(SR_Z, u(res, size) === 0);
    this.setFlag(SR_V | SR_C, false);
  }
  private add(s: number, d: number, size: Size, setX = true): number {
    const r = s + d;
    const res = u(r, size);
    const c = r > MASK[size];
    this.setFlag(SR_C, c);
    if (setX) this.setFlag(SR_X, c);
    this.setFlag(SR_V, ((s ^ res) & (d ^ res) & MSB[size]) !== 0);
    this.setFlag(SR_N, (res & MSB[size]) !== 0);
    this.setFlag(SR_Z, res === 0);
    return res;
  }
  /** d - s */
  private sub(s: number, d: number, size: Size, setX = true): number {
    const res = u(d - s, size);
    const c = s > d;
    this.setFlag(SR_C, c);
    if (setX) this.setFlag(SR_X, c);
    this.setFlag(SR_V, ((d ^ s) & (d ^ res) & MSB[size]) !== 0);
    this.setFlag(SR_N, (res & MSB[size]) !== 0);
    this.setFlag(SR_Z, res === 0);
    return res;
  }

  cond(cc: number): boolean {
    const C = this.flag(SR_C), V = this.flag(SR_V), Z = this.flag(SR_Z), N = this.flag(SR_N);
    switch (cc) {
      case 0: return true;
      case 1: return false;
      case 2: return !C && !Z;
      case 3: return C || Z;
      case 4: return !C;
      case 5: return C;
      case 6: return !Z;
      case 7: return Z;
      case 8: return !V;
      case 9: return V;
      case 10: return !N;
      case 11: return N;
      case 12: return N === V;
      case 13: return N !== V;
      case 14: return !Z && N === V;
      default: return Z || N !== V;
    }
  }

  // ---- shifts / rotates ----
  /** type: 0 AS, 1 LS, 3 RO. Returns the result and sets X/N/Z/V/C per the 68000 manual. */
  private shift(type: number, left: boolean, v: number, n: number, size: Size): number {
    const bits = BITS[size];
    const m = MASK[size];
    v = u(v, size);
    let res = v;
    let carry = false;
    let overflow = false;
    const bit = (i: number) => ((v >>> i) & 1) !== 0;
    if (n > 0) {
      if (type === 3) {
        const k = n % bits;
        if (k > 0) res = left ? u(((v << k) | (v >>> (bits - k))) >>> 0, size) : u(((v >>> k) | (v << (bits - k))) >>> 0, size);
        carry = left ? (res & 1) !== 0 : (res & MSB[size]) !== 0;
      } else if (left) {
        res = n >= bits ? 0 : u(size === 4 ? (v << n) >>> 0 : (v << n) & m, size);
        carry = n <= bits ? bit(bits - n) : false;
        if (type === 0) {
          const first = bit(bits - 1);
          for (let i = 1; i <= Math.min(n, bits); i++) {
            const b = i < bits ? bit(bits - 1 - i) : false; // the value shifted into the MSB
            if (b !== first) overflow = true;
          }
        }
      } else if (type === 1) {
        res = n >= bits ? 0 : v >>> n;
        carry = n <= bits ? bit(n - 1) : false;
      } else {
        const neg = bit(bits - 1);
        res = n >= bits ? (neg ? m : 0) : u((sx(v, size) >> n) >>> 0, size);
        carry = n >= bits ? neg : bit(n - 1);
      }
    }
    this.setFlag(SR_C, carry);
    if (n > 0 && type !== 3) this.setFlag(SR_X, carry);
    this.setFlag(SR_V, overflow);
    this.setFlag(SR_N, (res & MSB[size]) !== 0);
    this.setFlag(SR_Z, res === 0);
    return res;
  }

  // ---- execution ----
  /** Executes one instruction and returns the cycles it took. Throws on unsupported instructions / bus errors. */
  step(): number {
    this.lastPc = this.pc;
    const op = this.fetch16();
    this.lastOpcode = op;
    this.cyc = 0;
    this.exec(op);
    this.cycles += this.cyc;
    return this.cyc;
  }

  /** Runs whole instructions until at least `budget` cycles are consumed; returns cycles used. */
  run(budget: number): number {
    let used = 0;
    while (used < budget) used += this.step();
    return used;
  }

  private exec(op: number) {
    switch (op >>> 12) {
      case 0x0: return this.group0(op);
      case 0x1: return this.move(op, 1);
      case 0x2: return this.move(op, 4);
      case 0x3: return this.move(op, 2);
      case 0x4: return this.group4(op);
      case 0x5: return this.group5(op);
      case 0x6: return this.branch(op);
      case 0x7:
        if (op & 0x100) return this.unsupported(op);
        { const v = sx8(op & 0xff) >>> 0; this.d[(op >> 9) & 7] = v; this.nz(v, 4); this.cyc += 4; }
        return;
      case 0x8: return this.group8(op);
      case 0x9: return this.addSub(op, true);
      case 0xb: return this.groupB(op);
      case 0xc: return this.groupC(op);
      case 0xd: return this.addSub(op, false);
      case 0xe: return this.groupE(op);
      default: return this.unsupported(op, op >>> 12 === 0xa ? "line-A trap" : "line-F trap");
    }
  }

  private sizeOf(bits: number, op: number): Size {
    if (bits === 0) return 1;
    if (bits === 1) return 2;
    if (bits === 2) return 4;
    return this.unsupported(op, "invalid size");
  }

  // MOVE / MOVEA
  private move(op: number, size: Size) {
    const src = this.ea((op >> 3) & 7, op & 7, size, op);
    const v = this.read(src, size);
    const dmode = (op >> 6) & 7;
    const dreg = (op >> 9) & 7;
    this.cyc += 4;
    if (dmode === 1) {
      if (size === 1) return this.unsupported(op, "MOVEA.B");
      this.a[dreg] = (size === 2 ? sx16(v) : v) >>> 0;
      return;
    }
    const dst = this.ea(dmode, dreg, size, op);
    if (dst.t === 3 || dst.t === 1) return this.unsupported(op, "invalid MOVE destination");
    this.write(dst, size, v);
    this.nz(v, size);
  }

  private group0(op: number) {
    if (op === 0x003c || op === 0x023c || op === 0x0a3c) {
      const imm = this.fetch16() & 0xff;
      const ccr = this.sr & 0xff;
      const r = op === 0x003c ? ccr | imm : op === 0x023c ? ccr & imm : ccr ^ imm;
      this.sr = (this.sr & 0xff00) | (r & 0x1f);
      this.cyc += 20;
      return;
    }
    if (op === 0x007c || op === 0x027c || op === 0x0a7c) {
      if (!this.supervisor) throw new PrivilegeViolationError(op, this.lastPc);
      const imm = this.fetch16();
      this.setSR(op === 0x007c ? this.sr | imm : op === 0x027c ? this.sr & imm : this.sr ^ imm);
      this.cyc += 20;
      return;
    }
    const mode = (op >> 3) & 7;
    const reg = op & 7;
    if (op & 0x100 || (op & 0xf00) === 0x800) {
      // bit operations
      const dynamic = (op & 0x100) !== 0;
      if (dynamic && mode === 1) return this.unsupported(op, "MOVEP");
      const kind = (op >> 6) & 3; // 0 BTST 1 BCHG 2 BCLR 3 BSET
      let bit = dynamic ? this.d[(op >> 9) & 7]! : this.fetch16();
      const o = this.ea(mode, reg, 1, op);
      const isReg = o.t === 0;
      if (o.t === 1 || (o.t === 3 && kind !== 0)) return this.unsupported(op, "invalid bit-op operand");
      const size: Size = isReg ? 4 : 1;
      bit = isReg ? bit & 31 : bit & 7;
      let v = isReg ? this.d[o.n]! : this.read(o, 1);
      const was = ((v >>> bit) & 1) !== 0;
      this.setFlag(SR_Z, !was);
      if (kind === 1) v ^= 1 << bit;
      else if (kind === 2) v &= ~(1 << bit);
      else if (kind === 3) v |= 1 << bit;
      if (kind !== 0) {
        if (isReg) this.d[o.n] = v >>> 0;
        else this.write(o, 1, v);
      }
      this.cyc += kind === 0 ? (isReg ? 6 : 4) : isReg ? (kind === 2 ? 10 : 8) : 8;
      void size;
      return;
    }
    const kind = (op >> 9) & 7;
    if (kind === 4 || kind === 7) return this.unsupported(op);
    const size = this.sizeOf((op >> 6) & 3, op);
    const imm = size === 4 ? this.fetch32() : size === 2 ? this.fetch16() : this.fetch16() & 0xff;
    const o = this.ea(mode, reg, size, op);
    if (o.t === 1 || o.t === 3) return this.unsupported(op, "invalid immediate-op destination");
    const d = this.read(o, size);
    this.cyc += o.t === 0 ? (size === 4 ? 16 : 8) : size === 4 ? 20 : 12;
    if (kind === 6) {
      this.sub(imm, d, size, false);
      if (o.t === 0 && size === 4) this.cyc -= 2;
      return;
    }
    let res: number;
    switch (kind) {
      case 0: res = d | imm; this.nz(res, size); break;
      case 1: res = d & imm; this.nz(res, size); break;
      case 2: res = this.sub(imm, d, size); break;
      case 3: res = this.add(imm, d, size); break;
      default: res = d ^ imm; this.nz(res, size); break; // 5 EORI
    }
    this.write(o, size, res);
  }

  private group4(op: number) {
    const mode = (op >> 3) & 7;
    const reg = op & 7;
    if (op === 0x4e71) { this.cyc += 4; return; }
    if (op === 0x4e70) {
      if (!this.supervisor) throw new PrivilegeViolationError(op, this.lastPc);
      this.bus.reset?.();
      this.cyc += 132;
      return;
    }
    if (op === 0x4e73) {
      if (!this.supervisor) throw new PrivilegeViolationError(op, this.lastPc);
      const sr = this.rd(this.a[7]!, 2);
      this.a[7] = (this.a[7]! + 2) >>> 0;
      const pc = this.pop32();
      this.setSR(sr);
      this.pc = pc;
      this.cyc += 20;
      return;
    }
    if (op === 0x4e75) { this.pc = this.pop32(); this.cyc += 16; return; }
    if (op === 0x4e77) {
      const ccr = this.rd(this.a[7]!, 2);
      this.a[7] = (this.a[7]! + 2) >>> 0;
      this.sr = (this.sr & 0xff00) | (ccr & 0x1f);
      this.pc = this.pop32();
      this.cyc += 20;
      return;
    }
    if ((op & 0xfff0) === 0x4e40) return this.unsupported(op, "TRAP (no exception model)");
    if ((op & 0xffc0) === 0x4e80) { // JSR
      const addr = this.controlAddr(mode, reg, op);
      this.push32(this.pc);
      this.pc = addr;
      this.cyc += this.ctl(mode, reg, [16, 18, 22, 18, 20, 18, 22]);
      return;
    }
    if ((op & 0xffc0) === 0x4ec0) { // JMP
      this.pc = this.controlAddr(mode, reg, op);
      this.cyc += this.ctl(mode, reg, [8, 10, 14, 10, 12, 10, 14]);
      return;
    }
    if ((op & 0xf1c0) === 0x41c0) { // LEA
      this.a[(op >> 9) & 7] = this.controlAddr(mode, reg, op);
      this.cyc += this.ctl(mode, reg, [4, 8, 12, 8, 12, 8, 12]);
      return;
    }
    if ((op & 0xffc0) === 0x4840 && mode !== 0) { // PEA
      this.push32(this.controlAddr(mode, reg, op));
      this.cyc += this.ctl(mode, reg, [12, 16, 20, 16, 20, 16, 20]);
      return;
    }
    if ((op & 0xfff8) === 0x4840) { // SWAP
      const v = this.d[reg]!;
      const r = ((v << 16) | (v >>> 16)) >>> 0;
      this.d[reg] = r;
      this.nz(r, 4);
      this.cyc += 4;
      return;
    }
    if ((op & 0xfff8) === 0x4880) { // EXT.W
      const r = u(sx8(this.d[reg]! & 0xff), 2);
      this.d[reg] = ((this.d[reg]! & 0xffff0000) | r) >>> 0;
      this.nz(r, 2);
      this.cyc += 4;
      return;
    }
    if ((op & 0xfff8) === 0x48c0) { // EXT.L
      const r = sx16(this.d[reg]! & 0xffff) >>> 0;
      this.d[reg] = r;
      this.nz(r, 4);
      this.cyc += 4;
      return;
    }
    if ((op & 0xfb80) === 0x4880) return this.movem(op); // MOVEM
    if ((op & 0xffc0) === 0x40c0) { // MOVE from SR
      const o = this.ea(mode, reg, 2, op);
      this.write(o, 2, this.sr);
      this.cyc += o.t === 0 ? 6 : 8;
      return;
    }
    if ((op & 0xffc0) === 0x44c0) { // MOVE to CCR
      const o = this.ea(mode, reg, 2, op);
      this.sr = (this.sr & 0xff00) | (this.read(o, 2) & 0x1f);
      this.cyc += 12;
      return;
    }
    if ((op & 0xffc0) === 0x46c0) { // MOVE to SR
      if (!this.supervisor) throw new PrivilegeViolationError(op, this.lastPc);
      const o = this.ea(mode, reg, 2, op);
      this.setSR(this.read(o, 2));
      this.cyc += 12;
      return;
    }
    const sizeBits = (op >> 6) & 3;
    const k = (op >> 8) & 0xf;
    if (sizeBits !== 3 && (k === 0x2 || k === 0x4 || k === 0x6 || k === 0xa)) {
      const size = this.sizeOf(sizeBits, op);
      const o = this.ea(mode, reg, size, op);
      if (o.t === 3 || (o.t === 1 && k !== 0xa)) return this.unsupported(op, "invalid operand");
      const base = o.t === 0 ? (size === 4 ? 6 : 4) : size === 4 ? 12 : 8;
      if (k === 0xa) { // TST
        this.nz(this.read(o, size), size);
        this.cyc += 4;
        return;
      }
      this.cyc += base;
      if (k === 0x2) { // CLR
        this.write(o, size, 0);
        this.setFlag(SR_N | SR_V | SR_C, false);
        this.setFlag(SR_Z, true);
      } else if (k === 0x4) { // NEG
        const d = this.read(o, size);
        const res = u(0 - d, size);
        this.setFlag(SR_C, d !== 0);
        this.setFlag(SR_X, d !== 0);
        this.setFlag(SR_V, d === MSB[size]);
        this.setFlag(SR_N, (res & MSB[size]) !== 0);
        this.setFlag(SR_Z, res === 0);
        this.write(o, size, res);
      } else { // NOT
        const res = u(~this.read(o, size), size);
        this.nz(res, size);
        this.write(o, size, res);
      }
      return;
    }
    return this.unsupported(op);
  }

  private movem(op: number) {
    const toMemory = (op & 0x400) === 0;
    const size: Size = op & 0x40 ? 4 : 2;
    const mode = (op >> 3) & 7;
    const reg = op & 7;
    const list = this.fetch16();
    let n = 0;
    if (toMemory) {
      if (mode === 4) {
        let addr = this.a[reg]!;
        for (let i = 0; i < 16; i++) {
          if (!(list & (1 << i))) continue;
          const r = 15 - i; // bit0 = A7 ... bit15 = D0
          addr = (addr - size) >>> 0;
          this.wr(addr, size, r < 8 ? this.d[r]! : this.a[r - 8]!);
          n++;
        }
        this.a[reg] = addr;
      } else {
        if (mode < 2 || mode === 3) return this.unsupported(op, "invalid MOVEM destination");
        let addr = this.controlAddr(mode, reg, op);
        for (let i = 0; i < 16; i++) {
          if (!(list & (1 << i))) continue;
          this.wr(addr, size, i < 8 ? this.d[i]! : this.a[i - 8]!);
          addr = (addr + size) >>> 0;
          n++;
        }
      }
      this.cyc += 8 + n * (size === 4 ? 8 : 4);
    } else {
      if (mode === 4 || mode < 2) return this.unsupported(op, "invalid MOVEM source");
      let addr = mode === 3 ? this.a[reg]! : this.controlAddr(mode, reg, op);
      for (let i = 0; i < 16; i++) {
        if (!(list & (1 << i))) continue;
        const v = size === 2 ? sx16(this.rd(addr, 2)) >>> 0 : this.rd(addr, 4);
        if (i < 8) this.d[i] = v;
        else this.a[i - 8] = v;
        addr = (addr + size) >>> 0;
        n++;
      }
      if (mode === 3) this.a[reg] = addr;
      this.cyc += 12 + n * (size === 4 ? 8 : 4);
    }
  }

  // ADDQ/SUBQ/Scc/DBcc
  private group5(op: number) {
    const mode = (op >> 3) & 7;
    const reg = op & 7;
    const sizeBits = (op >> 6) & 3;
    if (sizeBits === 3) {
      const cc = (op >> 8) & 0xf;
      if (mode === 1) { // DBcc
        const base = this.pc;
        const disp = sx16(this.fetch16());
        if (this.cond(cc)) { this.cyc += 12; return; }
        const w = (this.d[reg]! - 1) & 0xffff;
        this.d[reg] = ((this.d[reg]! & 0xffff0000) | w) >>> 0;
        if (w !== 0xffff) { this.pc = (base + disp) >>> 0; this.cyc += 10; } else this.cyc += 14;
        return;
      }
      const o = this.ea(mode, reg, 1, op);
      if (o.t === 1 || o.t === 3) return this.unsupported(op, "invalid Scc destination");
      const t = this.cond(cc);
      this.write(o, 1, t ? 0xff : 0);
      this.cyc += o.t === 0 ? (t ? 6 : 4) : 8;
      return;
    }
    const size = this.sizeOf(sizeBits, op);
    let q = (op >> 9) & 7;
    if (q === 0) q = 8;
    const o = this.ea(mode, reg, size, op);
    if (o.t === 3) return this.unsupported(op);
    const sub = (op & 0x100) !== 0;
    if (o.t === 1) { // address register: full 32-bit, no flags
      this.a[reg] = (sub ? this.a[reg]! - q : this.a[reg]! + q) >>> 0;
      this.cyc += 8;
      return;
    }
    const d = this.read(o, size);
    this.write(o, size, sub ? this.sub(q, d, size) : this.add(q, d, size));
    this.cyc += o.t === 0 ? (size === 4 ? 8 : 4) : size === 4 ? 12 : 8;
  }

  private branch(op: number) {
    const cc = (op >> 8) & 0xf;
    const base = this.pc;
    let disp = sx8(op & 0xff);
    let wide = false;
    if ((op & 0xff) === 0) { disp = sx16(this.fetch16()); wide = true; }
    else if ((op & 0xff) === 0xff) return this.unsupported(op, "68020 32-bit displacement");
    if (cc === 1) { // BSR
      this.push32(this.pc);
      this.pc = (base + disp) >>> 0;
      this.cyc += 18;
      return;
    }
    if (cc === 0) { this.pc = (base + disp) >>> 0; this.cyc += 10; return; }
    if (this.cond(cc)) { this.pc = (base + disp) >>> 0; this.cyc += 10; } else this.cyc += wide ? 12 : 8;
  }

  private group8(op: number) {
    const opmode = (op >> 6) & 7;
    const mode = (op >> 3) & 7;
    const reg = op & 7;
    const dn = (op >> 9) & 7;
    if (opmode === 3 || opmode === 7) { // DIVU / DIVS
      const o = this.ea(mode, reg, 2, op);
      if (o.t === 1) return this.unsupported(op);
      const s = this.read(o, 2);
      if (s === 0) throw new DivideByZeroError(this.lastPc);
      const dv = this.d[dn]!;
      if (opmode === 3) {
        const q = Math.floor(dv / s);
        if (q > 0xffff) { this.setFlag(SR_V, true); this.setFlag(SR_C, false); this.cyc += 10; return; }
        const r = dv % s;
        this.d[dn] = (((r << 16) | q) >>> 0);
        this.setFlag(SR_N, (q & 0x8000) !== 0);
        this.setFlag(SR_Z, q === 0);
        this.setFlag(SR_V | SR_C, false);
        this.cyc += 140; // worst-case documented figure; actual is data dependent (76-140)
      } else {
        const ds = dv | 0;
        const ss = sx16(s);
        const q = Math.trunc(ds / ss);
        if (q > 32767 || q < -32768) { this.setFlag(SR_V, true); this.setFlag(SR_C, false); this.cyc += 12; return; }
        const r = ds % ss;
        this.d[dn] = ((((r & 0xffff) << 16) | (q & 0xffff)) >>> 0);
        this.setFlag(SR_N, (q & 0x8000) !== 0);
        this.setFlag(SR_Z, q === 0);
        this.setFlag(SR_V | SR_C, false);
        this.cyc += 158;
      }
      return;
    }
    if (opmode === 4 && mode < 2) return this.unsupported(op, "SBCD");
    this.logic(op, (a, b) => a | b, true);
  }

  private groupB(op: number) {
    const opmode = (op >> 6) & 7;
    const mode = (op >> 3) & 7;
    const reg = op & 7;
    const dn = (op >> 9) & 7;
    if (opmode === 3 || opmode === 7) { // CMPA
      const size: Size = opmode === 3 ? 2 : 4;
      const o = this.ea(mode, reg, size, op);
      const s = (size === 2 ? sx16(this.read(o, 2)) : this.read(o, 4)) >>> 0;
      this.sub(s, this.a[dn]!, 4, false);
      this.cyc += 6;
      return;
    }
    if (opmode < 3) { // CMP
      const size = this.sizeOf(opmode, op);
      const o = this.ea(mode, reg, size, op);
      this.sub(this.read(o, size), u(this.d[dn]!, size), size, false);
      this.cyc += size === 4 ? 6 : 4;
      return;
    }
    if (mode === 1) return this.unsupported(op, "CMPM");
    this.logic(op, (a, b) => a ^ b, false); // EOR Dn,<ea>
  }

  private groupC(op: number) {
    const opmode = (op >> 6) & 7;
    const mode = (op >> 3) & 7;
    const reg = op & 7;
    const dn = (op >> 9) & 7;
    if (opmode === 3 || opmode === 7) { // MULU / MULS
      const o = this.ea(mode, reg, 2, op);
      if (o.t === 1) return this.unsupported(op);
      const s = this.read(o, 2);
      let res: number;
      let n = 0;
      if (opmode === 3) {
        res = ((s * (this.d[dn]! & 0xffff)) >>> 0);
        for (let v = s; v; v >>>= 1) n += v & 1;
      } else {
        res = (sx16(s) * sx16(this.d[dn]!)) >>> 0;
        const w = (s << 1) & 0x1ffff; // 01/10 transitions
        for (let i = 0; i < 16; i++) if (((w >> i) & 1) !== ((w >> (i + 1)) & 1)) n++;
      }
      this.d[dn] = res;
      this.nz(res, 4);
      this.cyc += 38 + 2 * n;
      return;
    }
    if (opmode === 5 && mode === 0) { const t = this.d[dn]!; this.d[dn] = this.d[reg]!; this.d[reg] = t; this.cyc += 6; return; }
    if (opmode === 5 && mode === 1) { const t = this.a[dn]!; this.a[dn] = this.a[reg]!; this.a[reg] = t; this.cyc += 6; return; }
    if (opmode === 6 && mode === 1) { const t = this.d[dn]!; this.d[dn] = this.a[reg]!; this.a[reg] = t; this.cyc += 6; return; }
    if (opmode === 4 && mode < 2) return this.unsupported(op, "ABCD");
    this.logic(op, (a, b) => a & b, true);
  }

  /** OR / AND / EOR with the standard <ea>,Dn / Dn,<ea> split. */
  private logic(op: number, f: (a: number, b: number) => number, allowEaToDn: boolean) {
    const opmode = (op >> 6) & 7;
    const mode = (op >> 3) & 7;
    const reg = op & 7;
    const dn = (op >> 9) & 7;
    const toEa = opmode >= 4;
    if (!allowEaToDn && !toEa) return this.unsupported(op);
    const size = this.sizeOf(opmode & 3, op);
    const o = this.ea(mode, reg, size, op);
    if (toEa) {
      if (o.t === 1 || o.t === 3) return this.unsupported(op, "invalid destination");
      const res = u(f(this.read(o, size), this.d[dn]!), size);
      this.nz(res, size);
      this.write(o, size, res);
      this.cyc += size === 4 ? 12 : 8;
    } else {
      if (o.t === 1) return this.unsupported(op, "address register source");
      const res = u(f(this.read(o, size), this.d[dn]!), size);
      this.nz(res, size);
      this.write({ t: 0, n: dn }, size, res);
      this.cyc += size === 4 ? (o.t === 2 ? 6 : 8) : 4;
    }
  }

  // ADD / ADDA / SUB / SUBA
  private addSub(op: number, isSub: boolean) {
    const opmode = (op >> 6) & 7;
    const mode = (op >> 3) & 7;
    const reg = op & 7;
    const dn = (op >> 9) & 7;
    if (opmode === 3 || opmode === 7) { // ADDA / SUBA (no flags)
      const size: Size = opmode === 3 ? 2 : 4;
      const o = this.ea(mode, reg, size, op);
      const s = (size === 2 ? sx16(this.read(o, 2)) : this.read(o, 4)) >>> 0;
      this.a[dn] = (isSub ? this.a[dn]! - s : this.a[dn]! + s) >>> 0;
      this.cyc += size === 4 && (o.t === 0 || o.t === 1 || o.t === 3) ? 8 : size === 4 ? 6 : 8;
      return;
    }
    if (opmode >= 4 && mode < 2) return this.unsupported(op, isSub ? "SUBX" : "ADDX");
    const size = this.sizeOf(opmode & 3, op);
    const o = this.ea(mode, reg, size, op);
    if (opmode < 3) {
      const d = u(this.d[dn]!, size);
      const s = this.read(o, size);
      this.write({ t: 0, n: dn }, size, isSub ? this.sub(s, d, size) : this.add(s, d, size));
      this.cyc += size === 4 ? (o.t === 2 ? 6 : 8) : 4;
    } else {
      if (o.t === 1 || o.t === 3) return this.unsupported(op, "invalid destination");
      const d = this.read(o, size);
      const s = u(this.d[dn]!, size);
      this.write(o, size, isSub ? this.sub(s, d, size) : this.add(s, d, size));
      this.cyc += size === 4 ? 12 : 8;
    }
  }

  private groupE(op: number) {
    const sizeBits = (op >> 6) & 3;
    const left = (op & 0x100) !== 0;
    if (sizeBits === 3) { // memory shift, word, count 1
      const type = (op >> 9) & 3;
      if (type === 2) return this.unsupported(op, "ROXL/ROXR");
      const o = this.ea((op >> 3) & 7, op & 7, 2, op);
      if (o.t !== 2) return this.unsupported(op);
      this.write(o, 2, this.shift(type, left, this.read(o, 2), 1, 2));
      this.cyc += 8;
      return;
    }
    const type = (op >> 3) & 3;
    if (type === 2) return this.unsupported(op, "ROXL/ROXR");
    const size = this.sizeOf(sizeBits, op);
    const reg = op & 7;
    let n: number;
    if (op & 0x20) n = this.d[(op >> 9) & 7]! & 63;
    else { n = (op >> 9) & 7; if (n === 0) n = 8; }
    this.d[reg] = (() => {
      const res = this.shift(type, left, this.d[reg]!, n, size);
      return size === 4 ? res >>> 0 : (((this.d[reg]! & ~MASK[size]) | res) >>> 0);
    })();
    this.cyc += (size === 4 ? 8 : 6) + 2 * n;
  }
}
