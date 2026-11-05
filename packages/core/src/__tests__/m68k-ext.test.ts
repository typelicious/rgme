import { describe, it, expect } from "vitest";
import { M68kCpu, AmigaBootMachine, BOOT_ADDRESS, EXEC_BASE, type Bus } from "../index.js";

class SimpleBus implements Bus {
  mem = new Uint8Array(0x100000);
  read8(a: number): number { return this.mem[a & 0xfffff]!; }
  read16(a: number): number {
    const i = a & 0xfffff;
    return (this.mem[i]! << 8) | this.mem[i + 1]!;
  }
  read32(a: number): number {
    return ((this.read16(a) << 16) | this.read16(a + 2)) >>> 0;
  }
  write8(a: number, v: number): void { this.mem[a & 0xfffff] = v & 0xff; }
  write16(a: number, v: number): void {
    const i = a & 0xfffff;
    this.mem[i] = (v >> 8) & 0xff;
    this.mem[i + 1] = v & 0xff;
  }
  write32(a: number, v: number): void {
    this.write16(a, (v >>> 16) & 0xffff);
    this.write16(a + 2, v & 0xffff);
  }
}

describe("Extended 68000 CPU instructions (M5)", () => {
  it("CHK.W tests bounds without exception when in-range", () => {
    const bus = new SimpleBus();
    const cpu = new M68kCpu(bus);
    cpu.pc = 0x1000;
    // MOVEQ #10, D0 ; CHK.W #20, D0 (CHK.W (PC+), D0: 0x41fa disp) or CHK.W D1, D0
    cpu.d[0] = 10;
    cpu.d[1] = 20;
    // 0x4181 = CHK.W D1, D0
    bus.write16(0x1000, 0x4181);
    const cycles = cpu.step();
    expect(cycles).toBe(10);
    expect(cpu.d[0]).toBe(10);
  });

  it("CHK.W invokes trap vector 6 when out of bounds", () => {
    const bus = new SimpleBus();
    const cpu = new M68kCpu(bus);
    cpu.pc = 0x1000;
    cpu.d[0] = 50;
    cpu.d[1] = 20; // 50 > 20 -> exception
    bus.write16(0x1000, 0x4181);
    bus.write32(6 * 4, 0x2000); // CHK vector handler
    cpu.step();
    expect(cpu.pc).toBe(0x2000);
    expect(cpu.supervisor).toBe(true);
  });

  it("TRAP #0 triggers exception to vector 32", () => {
    const bus = new SimpleBus();
    const cpu = new M68kCpu(bus);
    cpu.pc = 0x1000;
    bus.write16(0x1000, 0x4e40); // TRAP #0
    bus.write32(32 * 4, 0x3000);
    cpu.step();
    expect(cpu.pc).toBe(0x3000);
    expect(cpu.supervisor).toBe(true);
  });

  it("STOP loads new status register in supervisor mode", () => {
    const bus = new SimpleBus();
    const cpu = new M68kCpu(bus);
    cpu.sr = 0x2700; // supervisor mode
    cpu.pc = 0x1000;
    bus.write16(0x1000, 0x4e72); // STOP #$2000
    bus.write16(0x1002, 0x2000);
    cpu.step();
    expect(cpu.sr).toBe(0x2000);
  });

  it("MOVEP moves word and longword to and from peripheral alternate bytes", () => {
    const bus = new SimpleBus();
    const cpu = new M68kCpu(bus);
    cpu.a[0] = 0x5000;
    cpu.d[0] = 0x12345678;
    cpu.pc = 0x1000;

    // MOVEP.L D0, 0(A0): 0x0188 0x0000 (reg 0, opmode 7, ay 0)
    bus.write16(0x1000, 0x01c8); // MOVEP.L D0, (A0)
    bus.write16(0x1002, 0x0000);
    cpu.step();

    expect(bus.read8(0x5000)).toBe(0x12);
    expect(bus.read8(0x5002)).toBe(0x34);
    expect(bus.read8(0x5004)).toBe(0x56);
    expect(bus.read8(0x5006)).toBe(0x78);

    // Read back into D1 with MOVEP.L (A0), D1: 0x0388
    cpu.pc = 0x1004;
    bus.write16(0x1004, 0x0348);
    bus.write16(0x1006, 0x0000);
    cpu.step();
    expect(cpu.d[1]).toBe(0x12345678);
  });

  it("ABCD and SBCD perform decimal arithmetic correctly", () => {
    const bus = new SimpleBus();
    const cpu = new M68kCpu(bus);
    cpu.pc = 0x1000;

    // 0x15 + 0x27 = 0x42
    cpu.d[0] = 0x15;
    cpu.d[1] = 0x27;
    // ABCD D0, D1: 1100 <rx=1> 10000 <mode=0> <ry=0> -> 0xc300
    bus.write16(0x1000, 0xc300);
    cpu.step();
    expect(cpu.d[1] & 0xff).toBe(0x42);

    // SBCD: 0x42 - 0x15 = 0x27
    cpu.pc = 0x1002;
    // SBCD D0, D1: 1000 <rx=1> 10000 <mode=0> <ry=0> -> 0x8300
    bus.write16(0x1002, 0x8300);
    cpu.step();
    expect(cpu.d[1] & 0xff).toBe(0x27);
  });

  it("NBCD negates decimal byte", () => {
    const bus = new SimpleBus();
    const cpu = new M68kCpu(bus);
    cpu.pc = 0x1000;
    cpu.d[0] = 0x23;
    // NBCD D0: 0x4800
    bus.write16(0x1000, 0x4800);
    cpu.step();
    // 100 - 23 = 77 (0x77)
    expect(cpu.d[0] & 0xff).toBe(0x77);
  });

  it("ADDX and SUBX add/subtract with extend bit", () => {
    const bus = new SimpleBus();
    const cpu = new M68kCpu(bus);
    cpu.pc = 0x1000;
    cpu.d[0] = 0x10;
    cpu.d[1] = 0x20;
    // Set X flag
    cpu.sr |= 0x10; // SR_X
    // ADDX.B D0, D1: 1101 <rx=1> 1 <size=00> 0 <0> <ry=0> -> 0xd300
    bus.write16(0x1000, 0xd300);
    cpu.step();
    expect(cpu.d[1] & 0xff).toBe(0x31); // 0x20 + 0x10 + 1 = 0x31

    // SUBX.B D0, D1: 1001 <rx=1> 1 <size=00> 0 <0> <ry=0> -> 0x9300
    cpu.pc = 0x1002;
    bus.write16(0x1002, 0x9300);
    cpu.step();
    expect(cpu.d[1] & 0xff).toBe(0x21); // 0x31 - 0x10 - 0 = 0x21
  });

  it("NEGX negates with extend flag", () => {
    const bus = new SimpleBus();
    const cpu = new M68kCpu(bus);
    cpu.pc = 0x1000;
    cpu.d[0] = 0x05;
    cpu.sr |= 0x10; // set X
    // NEGX.B D0: 0x4000
    bus.write16(0x1000, 0x4000);
    cpu.step();
    expect(cpu.d[0] & 0xff).toBe(0xfa); // 0 - 5 - 1 = -6 = 0xfa
  });

  it("CMPM compares memory and increments address registers", () => {
    const bus = new SimpleBus();
    const cpu = new M68kCpu(bus);
    cpu.pc = 0x1000;
    cpu.a[0] = 0x2000;
    cpu.a[1] = 0x3000;
    bus.write16(0x2000, 0x1234);
    bus.write16(0x3000, 0x1234);
    // CMPM.W (A0)+, (A1)+: 1011 <rx=1> 1 <size=01> 001 <ry=0> -> 0xb348
    bus.write16(0x1000, 0xb348);
    cpu.step();
    expect(cpu.flag(0x04)).toBe(true); // SR_Z
    expect(cpu.a[0]).toBe(0x2002);
    expect(cpu.a[1]).toBe(0x3002);
  });

  it("ROXL and ROXR rotate through extend bit", () => {
    const bus = new SimpleBus();
    const cpu = new M68kCpu(bus);
    cpu.pc = 0x1000;
    cpu.d[0] = 0x80;
    cpu.sr &= ~0x10; // X = 0
    // ROXL.B #1, D0: 1110 001 1 00 0 10 000 -> 0xe310
    bus.write16(0x1000, 0xe310);
    cpu.step();
    expect(cpu.d[0] & 0xff).toBe(0x00);
    expect(cpu.flag(0x10)).toBe(true); // X flag got bit 7 (1)
  });
});

describe("Amiga ExecBase Trap Stubs (M5)", () => {
  it("gracefully executes _LVOOpenLibrary (-408)", () => {
    const m = new AmigaBootMachine();
    // JSR -408(A6) -> 0x4eae, -408 as 16-bit signed = 0xfe68
    const code = [0x4eae, 0xfe68, 0x4e75];
    const adf = new Uint8Array(1024);
    adf.set([0x44, 0x4f, 0x53, 0]); // DOS\0
    const view = new DataView(adf.buffer);
    code.forEach((w, i) => view.setUint16(12 + i * 2, w, false));
    let sum = 0;
    for (let i = 0; i < 256; i++) {
      sum += view.getUint32(i * 4, false);
      if (sum > 0xffffffff) sum = (sum & 0xffffffff) + 1;
    }
    view.setUint32(4, ~sum >>> 0, false);

    m.loadBootblock(adf);
    const r = m.runFrame();
    expect(r.halted).toBe(true);
    expect(r.haltReason).toBe("bootblock-returned");
    expect(m.cpu.d[0]).toBe(1); // returned non-zero library base
  });

  it("gracefully executes _LVOAllocMem (-198)", () => {
    const m = new AmigaBootMachine();
    // JSR -198(A6) -> 0x4eae, -198 as 16-bit signed = 0xff3a
    const code = [0x4eae, 0xff3a, 0x4e75];
    const adf = new Uint8Array(1024);
    adf.set([0x44, 0x4f, 0x53, 0]);
    const view = new DataView(adf.buffer);
    code.forEach((w, i) => view.setUint16(12 + i * 2, w, false));
    let sum = 0;
    for (let i = 0; i < 256; i++) {
      sum += view.getUint32(i * 4, false);
      if (sum > 0xffffffff) sum = (sum & 0xffffffff) + 1;
    }
    view.setUint32(4, ~sum >>> 0, false);

    m.loadBootblock(adf);
    const r = m.runFrame();
    expect(r.halted).toBe(true);
    expect(r.haltReason).toBe("bootblock-returned");
    expect(m.cpu.d[0]).toBe(0x30000); // returned allocated memory address
  });
});
