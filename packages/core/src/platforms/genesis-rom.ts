/** Sega Mega Drive / Genesis ROM header parser (read-only). Never executes or modifies ROM data. */

export class GenesisRomError extends Error {}

export interface GenesisRomInfo {
  format: "bin" | "smd-interleaved";
  /** false for formats this parser does not de-interleave (SMD). */
  supported: boolean;
  headerValid: boolean;
  consoleName: string;
  copyright: string;
  domesticTitle: string;
  overseasTitle: string;
  productType: string;
  serial: string;
  checksumField: number;
  checksumComputed: number;
  checksumValid: boolean;
  ioSupport: string;
  romStart: number;
  romEnd: number;
  romSizeDeclared: number;
  actualSize: number;
  ramStart: number;
  ramEnd: number;
  sramPresent: boolean;
  regions: string[];
  initialSp: number;
  initialPc: number;
}

const ascii = (d: Uint8Array, from: number, to: number) => {
  let s = "";
  for (let i = from; i < to; i++) {
    const b = d[i]!;
    s += b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : " ";
  }
  return s.replace(/\s+/g, " ").trim();
};
const u32 = (d: Uint8Array, o: number) => ((d[o]! << 24) | (d[o + 1]! << 16) | (d[o + 2]! << 8) | d[o + 3]!) >>> 0;
const u16 = (d: Uint8Array, o: number) => (d[o]! << 8) | d[o + 1]!;

/** Decodes old-style ("JUE") and new-style (hex bitfield) region codes. */
export function parseRegions(field: string): string[] {
  const f = field.trim().toUpperCase();
  if (/^[JUE]{1,3}$/.test(f)) return [...new Set(f.split(""))].map((c) => (c === "J" ? "Japan" : c === "U" ? "Americas" : "Europe"));
  if (/^[0-9A-F]$/.test(f)) {
    const v = parseInt(f, 16);
    const out: string[] = [];
    if (v & 1) out.push("Japan");
    if (v & 2) out.push("Asia");
    if (v & 4) out.push("Americas");
    if (v & 8) out.push("Europe");
    return out;
  }
  return [];
}

export function parseGenesisRom(data: Uint8Array): GenesisRomInfo {
  if (data.length < 0x200) throw new GenesisRomError(`ROM too small (${data.length} bytes)`);
  const smd = data.length % 0x4000 === 0x200 && data[8] === 0xaa && data[9] === 0xbb;
  if (smd) {
    return {
      format: "smd-interleaved", supported: false, headerValid: false, consoleName: "", copyright: "", domesticTitle: "", overseasTitle: "",
      productType: "", serial: "", checksumField: 0, checksumComputed: 0, checksumValid: false, ioSupport: "", romStart: 0, romEnd: 0,
      romSizeDeclared: 0, actualSize: data.length - 0x200, ramStart: 0, ramEnd: 0, sramPresent: false, regions: [], initialSp: 0, initialPc: 0
    };
  }
  const consoleName = ascii(data, 0x100, 0x110);
  const romStart = u32(data, 0x1a0);
  const romEnd = u32(data, 0x1a4);
  const end = Math.min(romEnd + 1, data.length);
  let sum = 0;
  for (let i = 0x200; i < end; i += 2) sum = (sum + ((data[i]! << 8) | (i + 1 < data.length ? data[i + 1]! : 0))) & 0xffff;
  const checksumField = u16(data, 0x18e);
  return {
    format: "bin",
    supported: true,
    headerValid: consoleName.startsWith("SEGA"),
    consoleName,
    copyright: ascii(data, 0x110, 0x120),
    domesticTitle: ascii(data, 0x120, 0x150),
    overseasTitle: ascii(data, 0x150, 0x180),
    productType: ascii(data, 0x180, 0x182),
    serial: ascii(data, 0x182, 0x18e),
    checksumField,
    checksumComputed: sum,
    checksumValid: sum === checksumField,
    ioSupport: ascii(data, 0x190, 0x1a0),
    romStart,
    romEnd,
    romSizeDeclared: romEnd - romStart + 1,
    actualSize: data.length,
    ramStart: u32(data, 0x1a8),
    ramEnd: u32(data, 0x1ac),
    sramPresent: data[0x1b0] === 0x52 && data[0x1b1] === 0x41,
    regions: parseRegions(ascii(data, 0x1f0, 0x200)),
    initialSp: u32(data, 0),
    initialPc: u32(data, 4)
  };
}
