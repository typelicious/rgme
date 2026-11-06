import { describe, it, expect } from "vitest";
import { generateBootableAdfFallback } from "../lib/runtime-factory.js";

describe("Milestone 14 (Web): Fallback ADF Generator Zero-Crash & Amiga Integrity", () => {
  it("generates an 880 KB ADF with valid Amiga DOS header and end-around carry checksum", () => {
    const adf = generateBootableAdfFallback({
      filename: "Flight of the Amazon Queen (Disk 1 of 11).adf",
      label: "Disk 1 of 11"
    });

    expect(adf.length).toBe(901120);
    // Header DOS\0
    expect(adf[0]).toBe(0x44); // 'D'
    expect(adf[1]).toBe(0x4f); // 'O'
    expect(adf[2]).toBe(0x53); // 'S'
    expect(adf[3]).toBe(0x00);

    // Sum of all 256 32-bit words in the bootblock must equal 0xffffffff
    const v = new DataView(adf.buffer, adf.byteOffset, 1024);
    let sum = 0;
    for (let i = 0; i < 256; i++) {
      sum += v.getUint32(i * 4, false);
      if (sum > 0xffffffff) sum = (sum & 0xffffffff) + 1;
    }
    expect(sum).toBe(0xffffffff);
  });

  it("preserves 68000 opcodes intact at offsets 12..73 and prevents opcode collision with titles", () => {
    const title = "Flight of the Amazon Queen (Disk 1 of 11).adf";
    const adf = generateBootableAdfFallback({ filename: title });

    // 12..17: lea $dff000, a0
    expect(Array.from(adf.subarray(12, 18))).toEqual([0x41, 0xf9, 0x00, 0xdf, 0xf0, 0x00]);

    // 18..21: lea 60(pc), a1
    expect(Array.from(adf.subarray(18, 22))).toEqual([0x43, 0xfa, 0x00, 0x3c]);

    // 22..25: move.l a1, $a0(a0) (AUD0LCH)
    expect(Array.from(adf.subarray(22, 26))).toEqual([0x21, 0x49, 0x00, 0xa0]);

    // 44..49: move.w #$8201, $96(a0) (DMACON = AUD0 enable)
    expect(Array.from(adf.subarray(44, 50))).toEqual([0x31, 0x7c, 0x82, 0x01, 0x00, 0x96]);

    // 68..73: bne.s loop; moveq #0, d0; rts
    expect(Array.from(adf.subarray(68, 74))).toEqual([0x66, 0xec, 0x70, 0x00, 0x4e, 0x75]);

    // Audio sample intact at offset 80
    expect(adf[80]).toBe((120 + 256) & 0xff);

    // Title string written at offset 96 (never at offset 32 where it caused Guru #80000004)
    const storedTitle = String.fromCharCode(...adf.subarray(96, 96 + 26));
    expect(storedTitle).toBe("Flight of the Amazon Queen");
  });
});
