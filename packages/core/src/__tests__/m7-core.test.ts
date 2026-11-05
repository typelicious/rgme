import { describe, it, expect } from "vitest";
import { AmigaBootMachine, hex12ToRgba32, DISPLAY_FIRST_LINE, CHIP_RAM_SIZE } from "../cpu/amiga-boot.js";

describe("Milestone 7: Amiga OCS Copper & Bitplane Engine", () => {
  it("hex12ToRgba32 converts Amiga 12-bit RGB to 32-bit packed RGBA correctly", () => {
    // Amiga 0x000 (black) -> RGBA full alpha black
    expect(hex12ToRgba32(0x000)).toBe(0xff000000 >>> 0);
    // Amiga 0xf00 (red): r=255, g=0, b=0, a=255 -> 0xff0000ff
    expect(hex12ToRgba32(0xf00)).toBe(0xff0000ff >>> 0);
    // Amiga 0x0f0 (green): r=0, g=255, b=0, a=255 -> 0xff00ff00
    expect(hex12ToRgba32(0x0f0)).toBe(0xff00ff00 >>> 0);
    // Amiga 0x00f (blue): r=0, g=0, b=255, a=255 -> 0xffff0000
    expect(hex12ToRgba32(0x00f)).toBe(0xffff0000 >>> 0);
    // Amiga 0xfff (white): 0xffffffff
    expect(hex12ToRgba32(0xfff)).toBe(0xffffffff >>> 0);
  });

  it("Copper engine executes MOVE and WAIT instructions in synchrony with scanlines", () => {
    const machine = new AmigaBootMachine();
    const bus = machine.bus;

    // Build a copper list at $1000 in Chip RAM:
    // 1. MOVE #$0F00, $DFF180  (COLOR00 = Red at start)
    // 2. WAIT for line 50: $3201, $FFFE
    // 3. MOVE #$00F0, $DFF180  (COLOR00 = Green at line 50)
    // 4. WAIT for unattainable line: $FFFF, $FFFE (end)
    const copAddr = 0x1000;
    bus.write16(copAddr + 0, 0x0180); // MOVE COLOR00
    bus.write16(copAddr + 2, 0x0f00); // Red
    bus.write16(copAddr + 4, 0x3201); // WAIT line 50 ($32)
    bus.write16(copAddr + 6, 0xfffe);
    bus.write16(copAddr + 8, 0x0180); // MOVE COLOR00
    bus.write16(copAddr + 10, 0x00f0); // Green
    bus.write16(copAddr + 12, 0xffff); // END
    bus.write16(copAddr + 14, 0xfffe);

    // Set COP1LC to $1000 and strobe COPJMP1 ($DFF088)
    bus.write32(0xdff080, copAddr);
    expect(bus.cop1lc).toBe(copAddr);
    bus.write16(0xdff088, 0); // Strobe COPJMP1
    expect(bus.copActive).toBe(true);
    expect(bus.copPc).toBe(copAddr);

    // Execute at line 10: MOVE should fire, COLOR00 becomes Red, WAIT line 50 blocks
    bus.executeCopper(10);
    expect(bus.colors[0]).toBe(0x0f00);
    expect(bus.copPc).toBe(copAddr + 4); // Stopped at WAIT line 50

    // Execute at line 49: Still before line 50
    bus.executeCopper(49);
    expect(bus.colors[0]).toBe(0x0f00);

    // Execute at line 50: WAIT satisfied, MOVE #$00F0 fires, COLOR00 becomes Green!
    bus.executeCopper(50);
    expect(bus.colors[0]).toBe(0x00f0);
    expect(bus.copActive).toBe(false); // End reached
  });

  it("Bitplane engine converts planar bitplanes into chunky 320x256 RGBA pixels", () => {
    const machine = new AmigaBootMachine();
    const bus = machine.bus;

    // Palette: Color 0 = Black (#000), Color 1 = Red (#F00), Color 2 = Blue (#00F), Color 3 = Yellow (#FF0)
    bus.colors[0] = 0x000;
    bus.colors[1] = 0xf00;
    bus.colors[2] = 0x00f;
    bus.colors[3] = 0xff0;

    // Enable 2 bitplanes (BPLCON0 = 0x2200 -> bits 12-14 = 2)
    bus.write16(0xdff100, 0x2200);

    // Place Plane 1 at $2000, Plane 2 at $3000
    const bpl1 = 0x2000;
    const bpl2 = 0x3000;
    bus.write32(0xdff0e0, bpl1);
    bus.write32(0xdff0e4, bpl2);

    // Scanline 0 of visible display (DISPLAY_FIRST_LINE):
    // Word 0 of Plane 1: 0x8000 (first pixel has bit0 = 1)
    // Word 0 of Plane 2: 0x8000 (first pixel has bit1 = 1) -> Color index = 3 (Yellow)
    // Second pixel: Plane 1 = 0, Plane 2 = 1 (0x4000) -> Color index = 2 (Blue)
    bus.write16(bpl1, 0x8000);
    bus.write16(bpl2, 0xc000); // bits: 1100_0000_0000_0000

    const target = new Uint32Array(320);
    bus.renderScanline(DISPLAY_FIRST_LINE, target, 0);

    // Pixel 0: bit0=1, bit1=1 -> Color 3 (Yellow)
    expect(target[0]).toBe(hex12ToRgba32(0xff0));
    // Pixel 1: bit0=0, bit1=1 -> Color 2 (Blue)
    expect(target[1]).toBe(hex12ToRgba32(0x00f));
    // Pixel 2..15: bit0=0, bit1=0 -> Color 0 (Black)
    expect(target[2]).toBe(hex12ToRgba32(0x000));
  });

  it("ExecBase Kickstart vectors return graceful success stubs", () => {
    const machine = new AmigaBootMachine();
    // Load a synthetic bootblock to install ExecBase
    const adf = new Uint8Array(1024);
    adf.set([0x44, 0x4f, 0x53, 0]); // DOS\0
    // Fill with NOPs so checksum is computed
    const view = new DataView(adf.buffer);
    view.setUint16(12, 0x4e71, false);
    let sum = 0;
    for (let i = 0; i < 256; i++) {
      sum += view.getUint32(i * 4, false);
      if (sum > 0xffffffff) sum = (sum & 0xffffffff) + 1;
    }
    view.setUint32(4, ~sum >>> 0, false);

    machine.loadBootblock(adf);

    // ExecBase is at $400
    expect(machine.bus.read32(4)).toBe(0x400);

    // LVO AllocMem (-198): Returns a non-zero address in D0
    // LVO FreeMem (-210): Returns 0 in D0
    // LVO FindTask (-294): Returns 1 in D0
    // LVO OpenLibrary (-408): Returns 1 in D0
    // LVO DoIO (-456): Returns 0 in D0
    expect(machine.bus.read16(0x400 - 198)).toBe(0x4ef9); // JMP
    expect(machine.bus.read16(0x400 - 210)).toBe(0x7000); // MOVEQ #0, D0
    expect(machine.bus.read16(0x400 - 294)).toBe(0x7001); // MOVEQ #1, D0
    expect(machine.bus.read16(0x400 - 408)).toBe(0x7001); // MOVEQ #1, D0
    expect(machine.bus.read16(0x400 - 456)).toBe(0x7000); // MOVEQ #0, D0
  });
});
