import { describe, it, expect } from "vitest";
import {
  AddressError, DivideByZeroError, M68kCpu, PrivilegeViolationError, UnsupportedInstructionError,
  SR_C, SR_N, SR_V, SR_X, SR_Z, type Bus
} from "../cpu/m68k.js";
import { AmigaBus } from "../cpu/amiga-boot.js";

/** Plain 1 MB RAM bus (big endian). */
class Ram implements Bus {
  readonly m = new Uint8Array(0x100000);
  read8(a: number) { return this.m[a]!; }
  read16(a: number) { return (this.m[a]! << 8) | this.m[a + 1]!; }
  read32(a: number) { return ((this.read16(a) << 16) | this.read16(a + 2)) >>> 0; }
  write8(a: number, v: number) { this.m[a] = v; }
  write16(a: number, v: number) { this.m[a] = v >> 8; this.m[a + 1] = v; }
  write32(a: number, v: number) { this.write16(a, v >>> 16); this.write16(a + 2, v & 0xffff); }
}

const PROG = 0x1000;
const STACK = 0x8000;

/** Tiny "assembler": programs are arrays of 16-bit words; 32-bit immediates are given as two words via l(). */
const l = (v: number): number[] => [(v >>> 16) & 0xffff, v & 0xffff];
const moveqD = (n: number, d: number) => 0x7000 | (d << 9) | (n & 0xff);
const MOVE_L_IMM_D = (d: number) => 0x203c | (d << 9);
const MOVE_W_IMM_D = (d: number) => 0x303c | (d << 9);
const MOVE_B_IMM_D = (d: number) => 0x103c | (d << 9);
const shiftOp = (type: number, left: boolean, sizeBits: number, count: number, reg: number, regCount = false) =>
  0xe000 | ((count & 7) << 9) | (left ? 0x100 : 0) | (sizeBits << 6) | (regCount ? 0x20 : 0) | (type << 3) | reg;
const RTS = 0x4e75, NOP = 0x4e71;

function machine(words: number[], setup?: (c: M68kCpu, ram: Ram) => void) {
  const ram = new Ram();
  ram.write32(0, STACK);
  ram.write32(4, PROG);
  words.forEach((w, i) => ram.write16(PROG + i * 2, w));
  const cpu = new M68kCpu(ram);
  cpu.reset(ram);
  setup?.(cpu, ram);
  return { cpu, ram };
}
function runN(words: number[], n: number, setup?: (c: M68kCpu, ram: Ram) => void) {
  const m = machine(words, setup);
  for (let i = 0; i < n; i++) m.cpu.step();
  return m;
}
const flags = (c: M68kCpu) =>
  (c.flag(SR_X) ? "X" : "-") + (c.flag(SR_N) ? "N" : "-") + (c.flag(SR_Z) ? "Z" : "-") + (c.flag(SR_V) ? "V" : "-") + (c.flag(SR_C) ? "C" : "-");

describe("reset and registers", () => {
  it("takes SSP and PC from the vectors, starts in supervisor mode", () => {
    const { cpu } = machine([NOP]);
    expect(cpu.pc).toBe(PROG);
    expect(cpu.a[7]).toBe(STACK);
    expect(cpu.supervisor).toBe(true);
    expect(cpu.sr & 0x0700).toBe(0x0700);
  });
  it("switches stack pointers when the S bit changes", () => {
    // MOVE #$0000,SR (to user mode)
    const { cpu } = runN([0x46fc, 0x0000], 1);
    expect(cpu.supervisor).toBe(false);
    expect(cpu.ssp).toBe(STACK);
    expect(cpu.a[7]).toBe(0); // USP
  });
});

describe("arithmetic flags (hand-computed vectors)", () => {
  // [name, opcode(D1 -> D0), D0, D1, expected D0 (masked), expected flags]
  const vectors: Array<[string, number, number, number, number, string]> = [
    ["ADD.B 0x7F+1", 0xd001, 0x7f, 1, 0x80, "-N-V-"],
    ["ADD.B 0xFF+1", 0xd001, 0xff, 1, 0x00, "X-Z-C"],
    ["ADD.B 0x80+0x80", 0xd001, 0x80, 0x80, 0x00, "X-ZVC"],
    ["ADD.W 0x7FFF+1", 0xd041, 0x7fff, 1, 0x8000, "-N-V-"],
    ["ADD.W 0xFFFF+1", 0xd041, 0xffff, 1, 0x0000, "X-Z-C"],
    ["ADD.L 0x7FFFFFFF+1", 0xd081, 0x7fffffff, 1, 0x80000000, "-N-V-"],
    ["ADD.L 0xFFFFFFFF+1", 0xd081, 0xffffffff, 1, 0, "X-Z-C"],
    ["SUB.B 0x80-1", 0x9001, 0x80, 1, 0x7f, "---V-"],
    ["SUB.B 0-1", 0x9001, 0, 1, 0xff, "XN--C"],
    ["SUB.B 5-5", 0x9001, 5, 5, 0, "--Z--"],
    ["SUB.W 0x8000-1", 0x9041, 0x8000, 1, 0x7fff, "---V-"],
    ["SUB.L 0x80000000-1", 0x9081, 0x80000000, 1, 0x7fffffff, "---V-"],
    ["SUB.L 0-0xFFFFFFFF", 0x9081, 0, 0xffffffff, 1, "X---C"]
  ];
  it.each(vectors)("%s", (_n, opcode, d0, d1, expD0, expFlags) => {
    const { cpu } = runN([opcode], 1, (c) => { c.d[0] = d0; c.d[1] = d1; });
    const size = opcode & 0xc0;
    const mask = size === 0 ? 0xff : size === 0x40 ? 0xffff : 0xffffffff;
    expect((cpu.d[0]! & mask) >>> 0).toBe(expD0 >>> 0);
    expect(flags(cpu)).toBe(expFlags);
  });

  it("ADD.B/W keep the upper bits of the destination", () => {
    const { cpu } = runN([0xd001], 1, (c) => { c.d[0] = 0x12345680; c.d[1] = 0x01; });
    expect(cpu.d[0]).toBe(0x12345681);
  });

  const cmp: Array<[string, number, number, number, string]> = [
    ["CMP.W 3 vs 5", 0xb041, 3, 5, "-N--C"],
    ["CMP.W 5 vs 5", 0xb041, 5, 5, "--Z--"],
    ["CMP.W 0x8000 vs 1", 0xb041, 0x8000, 1, "---V-"],
    ["CMP.B 0x7F vs 0xFF", 0xb001, 0x7f, 0xff, "-N-VC"],
    ["CMP.L 0 vs 1", 0xb081, 0, 1, "-N--C"]
  ];
  it.each(cmp)("%s (X preserved, destination unchanged)", (_n, opcode, d0, d1, expFlags) => {
    const { cpu } = runN([opcode], 1, (c) => { c.d[0] = d0; c.d[1] = d1; c.sr |= SR_X; });
    expect(flags(cpu).replace("X", "-")).toBe(expFlags);
    expect(cpu.flag(SR_X)).toBe(true);
    expect(cpu.d[0]).toBe(d0 >>> 0);
  });

  const neg: Array<[string, number, number, number, string]> = [
    ["NEG.B 0x80", 0x4400, 0x80, 0x80, "XN-VC"],
    ["NEG.W 0", 0x4440, 0, 0, "--Z--"],
    ["NEG.L 1", 0x4480, 1, 0xffffffff, "XN--C"],
    ["NEG.W 0x8000", 0x4440, 0x8000, 0x8000, "XN-VC"]
  ];
  it.each(neg)("%s", (_n, opcode, d0, exp, expFlags) => {
    const { cpu } = runN([opcode], 1, (c) => { c.d[0] = d0; });
    const mask = (opcode & 0xc0) === 0 ? 0xff : (opcode & 0xc0) === 0x40 ? 0xffff : 0xffffffff;
    expect((cpu.d[0]! & mask) >>> 0).toBe(exp);
    expect(flags(cpu)).toBe(expFlags);
  });

  it("ADDQ/SUBQ to an address register do not touch the flags and use 32 bits", () => {
    const { cpu } = runN([0x5288, 0x5148], 2, (c) => { c.a[0] = 0xffffffff; c.sr = (c.sr & ~0x1f) | SR_Z; });
    // ADDQ.L #1,A0 -> 0 ; SUBQ.W #8,A0 -> 0xFFFFFFF8 (full register)
    expect(cpu.a[0]).toBe(0xfffffff8);
    expect(cpu.flag(SR_Z)).toBe(true);
  });
  it("immediate forms: ADDI/SUBI/CMPI/ANDI/ORI/EORI", () => {
    const { cpu } = runN(
      [moveqD(0x10, 0), 0x0680, ...l(0xfffffff0), // ADDI.L #-16,D0 -> 0, carry
        0x0400, 0x0001, // SUBI.B #1,D0 -> 0xFF low byte
        0x0c40, 0x00ff, // CMPI.W #$FF,D0 -> low word 0x00FF => Z
        0x0240, 0x0f0f, // ANDI.W #$0F0F,D0
        0x0040, 0x1000, // ORI.W #$1000,D0
        0x0a40, 0x000f], // EORI.W #$000F,D0
      7
    );
    expect(cpu.d[0]! & 0xffff).toBe(0x1000); // ((0x00FF & 0x0F0F) | 0x1000) ^ 0x000F
  });
});

describe("shifts and rotates", () => {
  // [name, opcode, D0, D1, expected D0, flags (X preset to 0 unless noted)]
  const vectors: Array<[string, number, number, number, number, string]> = [
    ["LSL.B #1 0x80", shiftOp(1, true, 0, 1, 0), 0x80, 0, 0x00, "X-Z-C"],
    ["LSL.W #1 0x4000", shiftOp(1, true, 1, 1, 0), 0x4000, 0, 0x8000, "-N---"],
    ["ASL.B #1 0x40 (overflow)", shiftOp(0, true, 0, 1, 0), 0x40, 0, 0x80, "-N-V-"],
    ["ASL.W #1 0xC000 (sign kept)", shiftOp(0, true, 1, 1, 0), 0xc000, 0, 0x8000, "XN--C"],
    ["LSR.W #1 1", shiftOp(1, false, 1, 1, 0), 1, 0, 0, "X-Z-C"],
    ["ASR.B #1 0x81", shiftOp(0, false, 0, 1, 0), 0x81, 0, 0xc0, "XN--C"],
    ["ROL.B #1 0x81", shiftOp(3, true, 0, 1, 0), 0x81, 0, 0x03, "----C"],
    ["ROR.B #1 0x01", shiftOp(3, false, 0, 1, 0), 0x01, 0, 0x80, "-N--C"],
    ["LSL.L #8 (count field 0 = 8)", shiftOp(1, true, 2, 0, 0), 0x00ff0001, 0, 0xff000100, "-N---"],
    ["LSL.W by reg 16", shiftOp(1, true, 1, 1, 0, true), 0x0001, 16, 0, "X-Z-C"],
    ["LSL.W by reg 0 (flags: C cleared, X kept)", shiftOp(1, true, 1, 1, 0, true), 0x0003, 0, 0x0003, "-----"],
    ["ASR.L by reg 40", shiftOp(0, false, 2, 1, 0, true), 0x80000000, 40, 0xffffffff, "XN--C"],
    ["LSR.L by reg 33", shiftOp(1, false, 2, 1, 0, true), 0x80000000, 33, 0, "--Z--"],
    ["ROL.L by reg 32", shiftOp(3, true, 2, 1, 0, true), 0x80000001, 32, 0x80000001, "-N--C"]
  ];
  it.each(vectors)("%s", (_n, opcode, d0, d1, exp, expFlags) => {
    const { cpu } = runN([opcode], 1, (c) => { c.d[0] = d0; c.d[1] = d1; });
    const size = (opcode >> 6) & 3;
    const mask = size === 0 ? 0xff : size === 1 ? 0xffff : 0xffffffff;
    expect((cpu.d[0]! & mask) >>> 0).toBe(exp >>> 0);
    expect(flags(cpu)).toBe(expFlags);
  });
});

describe("multiply and divide", () => {
  it("MULU 0xFFFF*0xFFFF and MULS -1*2", () => {
    let m = runN([0xc0c1], 1, (c) => { c.d[0] = 0xffff; c.d[1] = 0xffff; });
    expect(m.cpu.d[0]).toBe(0xfffe0001);
    expect(flags(m.cpu)).toBe("-N---");
    m = runN([0xc1c1], 1, (c) => { c.d[0] = 0xffff; c.d[1] = 2; });
    expect(m.cpu.d[0]).toBe(0xfffffffe);
    expect(flags(m.cpu)).toBe("-N---");
    m = runN([0xc0c1], 1, (c) => { c.d[0] = 0; c.d[1] = 5; });
    expect(flags(m.cpu)).toBe("--Z--");
  });
  it("DIVU quotient/remainder, overflow and divide by zero", () => {
    let m = runN([0x80c1], 1, (c) => { c.d[0] = 0x10000; c.d[1] = 3; });
    expect(m.cpu.d[0]).toBe(0x00015555); // remainder 1 : quotient 0x5555
    m = runN([0x80c1], 1, (c) => { c.d[0] = 0x20000; c.d[1] = 1; });
    expect(m.cpu.d[0]).toBe(0x20000); // overflow: unchanged
    expect(flags(m.cpu)).toBe("---V-");
    expect(() => runN([0x80c1], 1, (c) => { c.d[0] = 5; c.d[1] = 0; })).toThrow(DivideByZeroError);
  });
  it("DIVS handles negative operands", () => {
    const m = runN([0x81c1], 1, (c) => { c.d[0] = (-7 >>> 0); c.d[1] = 2; });
    expect(m.cpu.d[0]).toBe(0xfffffffd); // r = -1 (0xFFFF), q = -3 (0xFFFD)
    expect(flags(m.cpu)).toBe("-N---");
  });
});

describe("branches, subroutines and stack", () => {
  it("BEQ taken / not taken with 8-bit displacement", () => {
    let m = runN([moveqD(0, 0), 0x6702, moveqD(1, 1), NOP], 3);
    expect(m.cpu.d[1]).toBe(0); // MOVEQ #1,D1 skipped
    m = runN([moveqD(1, 0), 0x6702, moveqD(1, 1), NOP], 3);
    expect(m.cpu.d[1]).toBe(1);
  });
  it("BRA.W with 16-bit and negative displacement", () => {
    const m = runN([0x6000, 0x0004, moveqD(1, 1), moveqD(2, 2), moveqD(3, 3)], 3);
    expect(m.cpu.d[1]).toBe(0); // skipped
    expect(m.cpu.d[2]).toBe(2);
    expect(m.cpu.d[3]).toBe(3);
    // backwards: NOP; BRA.B -4 (back to the NOP... target = base(PROG+4)-4 = PROG)
    const b = machine([NOP, 0x60fc]);
    b.cpu.step(); b.cpu.step();
    expect(b.cpu.pc).toBe(PROG);
  });
  it("all 14 condition codes", () => {
    const sr = (c: boolean, v: boolean, z: boolean, n: boolean) => (c ? SR_C : 0) | (v ? SR_V : 0) | (z ? SR_Z : 0) | (n ? SR_N : 0);
    const cpu = new M68kCpu(new Ram());
    const table: Array<[number, number, boolean]> = [
      [2, sr(false, false, false, false), true], [2, sr(true, false, false, false), false], // HI
      [3, sr(true, false, false, false), true], [3, sr(false, false, true, false), true], [3, 0, false], // LS
      [4, 0, true], [4, SR_C, false], [5, SR_C, true], // CC CS
      [6, 0, true], [6, SR_Z, false], [7, SR_Z, true], // NE EQ
      [8, 0, true], [8, SR_V, false], [9, SR_V, true], // VC VS
      [10, 0, true], [10, SR_N, false], [11, SR_N, true], // PL MI
      [12, 0, true], [12, SR_N | SR_V, true], [12, SR_N, false], // GE
      [13, SR_N, true], [13, SR_V, true], [13, SR_N | SR_V, false], // LT
      [14, 0, true], [14, SR_Z, false], [14, SR_N, false], // GT
      [15, SR_Z, true], [15, SR_N, true], [15, SR_N | SR_V, false] // LE
    ];
    for (const [cc, srv, expected] of table) {
      cpu.sr = 0x2700 | srv;
      expect(cpu.cond(cc), `cc=${cc} sr=${srv}`).toBe(expected);
    }
  });
  it("BSR/RTS", () => {
    const m = runN([0x6104, moveqD(7, 2), NOP, moveqD(5, 1), RTS], 4);
    expect(m.cpu.d[1]).toBe(5);
    expect(m.cpu.d[2]).toBe(7);
    expect(m.cpu.a[7]).toBe(STACK);
  });
  it("JSR through an address register returns with RTS", () => {
    // MOVEA.L #PROG+12,A0 ; JSR (A0) ; MOVEQ #3,D3 ; NOP ; (PROG+12:) MOVEQ #9,D4 ; RTS
    const m = runN([0x207c, ...l(PROG + 12), 0x4e90, moveqD(3, 3), NOP, moveqD(9, 4), RTS], 5);
    expect(m.cpu.d[4]).toBe(9);
    expect(m.cpu.d[3]).toBe(3);
    expect(m.cpu.a[7]).toBe(STACK);
  });
  it("JMP (A0) transfers control without touching the stack", () => {
    const m = runN([0x207c, ...l(PROG + 10), 0x4ed0, moveqD(1, 1), moveqD(2, 2)], 3);
    expect(m.cpu.d[1]).toBe(0);
    expect(m.cpu.d[2]).toBe(2);
    expect(m.cpu.a[7]).toBe(STACK);
  });
  it("stack push/pop with MOVE.L", () => {
    const m = runN([moveqD(1, 0), 0x2f00, moveqD(2, 0), 0x221f], 4);
    expect(m.cpu.d[1]).toBe(1);
    expect(m.cpu.a[7]).toBe(STACK);
  });
  it("MOVEM.L round trip (predecrement / postincrement)", () => {
    const m = runN([moveqD(1, 0), moveqD(2, 1), moveqD(3, 2), 0x48e7, 0xe000, moveqD(0, 0), moveqD(0, 1), moveqD(0, 2), 0x4cdf, 0x0007], 8);
    expect([m.cpu.d[0], m.cpu.d[1], m.cpu.d[2]]).toEqual([1, 2, 3]);
    expect(m.cpu.a[7]).toBe(STACK);
  });
  it("MOVEM stores in the documented order (D0 lowest address, 12 bytes)", () => {
    const m = runN([moveqD(1, 0), moveqD(2, 1), moveqD(3, 2), 0x48e7, 0xe000], 4);
    expect(m.cpu.a[7]).toBe(STACK - 12);
    expect([m.ram.read32(STACK - 12), m.ram.read32(STACK - 8), m.ram.read32(STACK - 4)]).toEqual([1, 2, 3]);
  });
});

describe("addressing modes and memory", () => {
  it("memory copy loop with (A0)+,(A1)+ and DBF", () => {
    const SRC = 0x3000, DST = 0x3100;
    const prog = [0x41f9, ...l(SRC), 0x43f9, ...l(DST), moveqD(3, 0), 0x12d8, 0x51c8, 0xfffc, NOP];
    const m = machine(prog, (_c, ram) => { [0xde, 0xad, 0xbe, 0xef].forEach((b, i) => ram.write8(SRC + i, b)); });
    for (let i = 0; i < 3 + 4 * 2; i++) m.cpu.step();
    expect([...m.ram.m.slice(DST, DST + 4)]).toEqual([0xde, 0xad, 0xbe, 0xef]);
    expect(m.cpu.a[0]).toBe(SRC + 4);
    expect(m.cpu.d[0]! & 0xffff).toBe(0xffff);
  });
  it("d16(An), d8(An,Xn), abs.W, d16(PC) and immediate modes", () => {
    const m = machine(
      [
        0x207c, ...l(0x3000), // MOVEA.L #$3000,A0
        0x317c, 0x1234, 0x0010, // MOVE.W #$1234,16(A0)
        0x3028, 0x0010, // MOVE.W 16(A0),D0
        moveqD(4, 1), // D1 = 4
        0x3030, 0x1808, // MOVE.W 8(A0,D1.L),D0 ; extension: D1.L (0x1800|8)
        0x3038, 0x3010, // MOVE.W $3010.W,D0
        0x303a, 0x0004, // MOVE.W d16(PC),D0 ; EA = (address of ext word) + 4
        NOP, 0xbeef
      ]
    );
    m.ram.write16(0x300c, 0x5678); // 8(A0,D1.L) = 0x3000+8+4
    for (let i = 0; i < 3; i++) m.cpu.step(); // MOVEA, MOVE #imm,d16(A0), MOVE d16(A0),D0
    expect(m.cpu.d[0]! & 0xffff).toBe(0x1234);
    m.cpu.step(); m.cpu.step(); // MOVEQ, MOVE.W 8(A0,D1.L),D0
    expect(m.cpu.d[0]! & 0xffff).toBe(0x5678);
    m.cpu.step(); // MOVE.W $3010.W,D0
    expect(m.cpu.d[0]! & 0xffff).toBe(0x1234);
    m.cpu.step(); // MOVE.W d16(PC),D0 -> word at (ext address + 4)
    expect(m.cpu.d[0]! & 0xffff).toBe(0xbeef);
  });
  it("LEA / PEA / SWAP / EXT / CLR / TST / Scc", () => {
    const m = runN(
      [0x43f9, ...l(0x2468), // LEA $2468,A1
        0x4879, ...l(0xcafe0000), // PEA $cafe0000 (abs.L)
        MOVE_L_IMM_D(0), ...l(0x0000ff80), 0x4840, // SWAP D0 -> 0xff800000
        0x4880, // EXT.W D0 (low byte 0 -> 0)
        MOVE_B_IMM_D(2), 0x0080, 0x4882, // EXT.W D2 : 0xFF80
        0x48c2, // EXT.L D2 : 0xFFFFFF80
        0x4282, // CLR.L D2
        0x4a42, // TST.W D2
        0x57c3 // SEQ D3
      ],
      11
    );
    expect(m.cpu.a[1]).toBe(0x2468);
    expect(m.ram.read32(m.cpu.a[7]!)).toBe(0xcafe0000);
    expect(m.cpu.d[0]).toBe(0xff800000);
    expect(m.cpu.d[2]).toBe(0);
    expect(m.cpu.d[3]! & 0xff).toBe(0xff); // Z was set by TST
  });
  it("BTST/BSET/BCLR (register and immediate)", () => {
    const m = runN([moveqD(0, 0), 0x08c0, 0x0003, 0x0800, 0x0003, 0x0880, 0x0003, 0x0800, 0x0003], 5);
    // BSET #3,D0 ; BTST #3,D0 (set => Z clear) ; BCLR #3,D0 ; BTST #3 (clear => Z)
    expect(m.cpu.d[0]).toBe(0);
    expect(m.cpu.flag(SR_Z)).toBe(true);
    const s = runN([moveqD(0, 0), 0x08c0, 0x0003, 0x0800, 0x0003], 3);
    expect(s.cpu.d[0]).toBe(8);
    expect(s.cpu.flag(SR_Z)).toBe(false);
  });
  it("logical ops AND/OR/EOR/NOT", () => {
    const m = runN([MOVE_W_IMM_D(0), 0x0ff0, MOVE_W_IMM_D(1), 0x00ff, 0xc041, 0x8041, 0xb340, 0x4640], 6);
    // AND.W D1,D0 -> 0x00F0 ; OR.W D1,D0 -> 0x00FF ; EOR.W D1,D0 -> 0x0000 ; NOT.W D0 -> 0xFFFF
    expect(m.cpu.d[0]! & 0xffff).toBe(0xffff);
    expect(flags(m.cpu)).toBe("-N---");
  });
  it("custom-chip style abs.L write and read-back through a bus", () => {
    const bus = new AmigaBus();
    bus.write32(0, STACK);
    bus.write32(4, PROG);
    [0x33fc, 0x0f0f, ...l(0xdff180), 0x3039, ...l(0xdff180)].forEach((w, i) => bus.write16(PROG + i * 2, w));
    const cpu = new M68kCpu(bus);
    cpu.reset(bus);
    cpu.step(); cpu.step();
    expect(bus.colors[0]).toBe(0x0f0f);
    expect(cpu.d[0]! & 0xffff).toBe(0x0f0f);
  });
});

describe("faults are explicit", () => {
  it("odd word access raises AddressError (read and write)", () => {
    expect(() => runN([0x207c, ...l(0x2001), 0x3010], 2)).toThrow(AddressError);
    expect(() => runN([0x207c, ...l(0x2001), 0x3080], 2)).toThrow(AddressError);
  });
  it("TRAP, line-A, line-F, CHK and ILLEGAL are reported with opcode and pc", () => {
    for (const op of [0x4e40, 0xa000, 0xf000, 0x4d45, 0x4afc]) {
      try {
        runN([NOP, op], 2);
        throw new Error("expected UnsupportedInstructionError");
      } catch (e) {
        expect(e).toBeInstanceOf(UnsupportedInstructionError);
        expect((e as UnsupportedInstructionError).opcode).toBe(op);
        expect((e as UnsupportedInstructionError).pc).toBe(PROG + 2);
      }
    }
  });
  it("RTE/RESET are privileged in user mode", () => {
    expect(() => runN([0x46fc, 0x0000, 0x4e73], 2)).toThrow(PrivilegeViolationError);
    expect(() => runN([0x46fc, 0x0000, 0x4e70], 2)).toThrow(PrivilegeViolationError);
  });
  it("RTE restores SR and PC from the supervisor stack", () => {
    const m = machine([0x4e73], (c, ram) => {
      c.a[7] = STACK - 6;
      ram.write16(STACK - 6, 0x0004); // SR: Z, supervisor cleared -> user mode
      ram.write32(STACK - 4, PROG + 0x40);
    });
    m.cpu.step();
    expect(m.cpu.pc).toBe(PROG + 0x40);
    expect(m.cpu.supervisor).toBe(false);
    expect(m.cpu.flag(SR_Z)).toBe(true);
  });
});

describe("cycle counts (documented 68000 timings for common forms)", () => {
  const c = (words: number[], setup?: (cpu: M68kCpu) => void) => {
    const m = machine(words, (cpu) => setup?.(cpu));
    return m.cpu.step();
  };
  it("matches the manual for the common forms", () => {
    expect(c([NOP])).toBe(4);
    expect(c([moveqD(1, 0)])).toBe(4);
    expect(c([0xd041])).toBe(4); // ADD.W D1,D0
    expect(c([0xd081])).toBe(8); // ADD.L D1,D0
    expect(c([0x3001])).toBe(4); // MOVE.W D1,D0
    expect(c([0x2018], (cpu) => (cpu.a[0] = 0x3000))).toBe(12); // MOVE.L (A0)+,D0
    expect(c([0x6004, NOP, NOP, NOP])).toBe(10); // BRA.B
    expect(c([0x6702], (cpu) => { cpu.sr &= ~SR_Z; })).toBe(8); // BEQ.B not taken
    expect(c([0x6702], (cpu) => { cpu.sr |= SR_Z; })).toBe(10); // taken
    expect(c([RTS])).toBe(16);
    expect(c([0x6104, NOP, NOP, NOP])).toBe(18); // BSR.B
    expect(c([0x41d0])).toBe(4); // LEA (A0),A0
    expect(c([0xc0c1], (cpu) => { cpu.d[1] = 0; })).toBe(38); // MULU #0
    expect(c([0xc0c1], (cpu) => { cpu.d[1] = 0xffff; })).toBe(70); // MULU 16 ones: 38 + 32
  });
});
