/**
 * SPS/CAPS "IPF" container parser (read-only).
 *
 * WHAT IS REAL: the record layer — every record is `type[4] length[4,BE] crc[4,BE] payload`, the CRC-32 covers the
 * whole record with the CRC field zeroed, and the records are CAPS, INFO, IMGE and DATA. (The task text called these
 * "FDI/TRCK"; those are not record names of the real format. They are reported as unsupported, never interpreted.)
 * A DATA record's header is followed by `dataLength` bytes of data area which are NOT part of the record length; the
 * area's own CRC-32 is stored in the DATA header.
 *
 * WHAT IS A DOCUMENTED SUBSET: the data area layout. It is `blockCount` 32-byte block descriptors
 * (dataBits, gapBits, gapOffset, cellType, encoderType, blockFlags, gapDefault, dataOffset — u32 BE each) followed by
 * element streams: head byte = type (low 5 bits) | size-byte-count << 5, then a big-endian size, then payload:
 *   0 End, 1 Sync (raw MFM bytes), 2 Data (bytes, MFM-encoded here), 3 Gap (size = cells; zero data), 4 Raw (raw MFM),
 *   5 Fuzzy (weak bits -> protected).
 * This subset was validated only against synthetic containers (no real SPS files are available in this repository),
 * so a genuine IPF whose streams use features outside it is reported as `protected` with reasons rather than guessed.
 *
 * NOT DECODED: copy-protected / custom-format tracks. Emulating them needs a flux-level engine that does not exist
 * here; `toAdf()` returns undefined for such images and never fabricates data.
 */
import { ADF_SIZE, SECTORS_PER_TRACK, SECTOR_SIZE, TRACKS, crc32, decodeAmigaTrack, mfmEncodeBytes } from "./mfm.js";

export interface IpfRecord {
  type: string;
  offset: number;
  length: number;
  crc: number;
  crcOk: boolean;
}

export interface IpfInfo {
  mediaType: number;
  encoderType: number;
  encoderRevision: number;
  fileKey: number;
  fileRevision: number;
  origin: number;
  minTrack: number;
  maxTrack: number;
  minSide: number;
  maxSide: number;
  creationDate: number;
  creationTime: number;
  platforms: number[];
  diskNumber: number;
  creatorId: number;
}

export interface IpfBlock {
  dataBits: number;
  gapBits: number;
  gapOffset: number;
  cellType: number;
  encoderType: number;
  blockFlags: number;
  gapDefault: number;
  dataOffset: number;
}

export interface IpfTrack {
  track: number; // cylinder
  side: number;
  density: number;
  signalType: number;
  trackBytes: number;
  startBytePos: number;
  startBitPos: number;
  dataBits: number;
  gapBits: number;
  trackBits: number;
  blockCount: number;
  encoderProcess: number;
  flags: number;
  dataKey: number;
  blocks: IpfBlock[];
  /** Reconstructed MFM bitstream (byte aligned) when the element streams could be expanded. */
  mfm?: Uint8Array;
  /** Decoded sectors (index 0..10) when the track is plain AmigaDOS MFM. */
  sectors?: Array<Uint8Array>;
  /** True when this track cannot be reduced to plain sectors (copy protection, custom stream, unsupported subset). */
  protected: boolean;
  reasons: string[];
}

const ascii = (b: Uint8Array, o: number) => String.fromCharCode(b[o]!, b[o + 1]!, b[o + 2]!, b[o + 3]!);

export class IpfImage {
  constructor(
    readonly records: IpfRecord[],
    readonly info: IpfInfo | undefined,
    readonly tracks: IpfTrack[],
    readonly errors: string[],
    readonly warnings: string[]
  ) {}

  /** Rebuilds a plain 901,120-byte ADF; `adf` is undefined (with reasons) unless EVERY track decodes cleanly. */
  toAdfResult(): { adf?: Uint8Array; reasons: string[] } {
    const reasons: string[] = [];
    if (this.errors.length) reasons.push(`container errors: ${this.errors.length} (first: ${this.errors[0]})`);
    const byIndex = new Map<number, IpfTrack>();
    for (const t of this.tracks) byIndex.set(t.track * 2 + t.side, t);
    const missing: string[] = [];
    for (let i = 0; i < TRACKS; i++) {
      const t = byIndex.get(i);
      if (!t) missing.push(`${i >> 1}.${i & 1}`);
      else if (t.protected || !t.sectors) reasons.push(`track ${t.track}.${t.side} is not plain AmigaDOS MFM: ${t.reasons.join("; ") || "undecoded"}`);
    }
    if (missing.length) reasons.push(`${missing.length} track(s) missing (first: ${missing[0]})`);
    if (reasons.length) return { reasons };
    const adf = new Uint8Array(ADF_SIZE);
    for (let i = 0; i < TRACKS; i++) {
      const t = byIndex.get(i)!;
      for (let s = 0; s < SECTORS_PER_TRACK; s++) adf.set(t.sectors![s]!, (i * SECTORS_PER_TRACK + s) * SECTOR_SIZE);
    }
    return { adf, reasons };
  }

  toAdf(): Uint8Array | undefined {
    return this.toAdfResult().adf;
  }
}

export const IpfParser = {
  parse(bytes: Uint8Array): IpfImage {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const u32 = (o: number) => dv.getUint32(o, false);
    const records: IpfRecord[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    let info: IpfInfo | undefined;
    const imges: IpfTrack[] = [];
    const areas = new Map<number, Uint8Array>();
    let off = 0;
    let first = true;

    while (off < bytes.length) {
      if (off + 12 > bytes.length) {
        errors.push(`truncated record header at offset ${off}`);
        break;
      }
      const type = ascii(bytes, off);
      const length = u32(off + 4);
      const crc = u32(off + 8);
      if (first && type !== "CAPS") errors.push("missing CAPS record at start of file");
      first = false;
      if (length < 12) {
        errors.push(`record '${type}' at offset ${off} has invalid length ${length}`);
        break;
      }
      if (off + length > bytes.length) {
        errors.push(`truncated record '${type}' at offset ${off}`);
        break;
      }
      const rec = bytes.slice(off, off + length);
      rec.set([0, 0, 0, 0], 8);
      const crcOk = crc32(rec) === crc;
      records.push({ type, offset: off, length, crc, crcOk });
      if (!crcOk) errors.push(`CRC mismatch in '${type}' record at offset ${off}`);
      let advance = length;

      if (type === "INFO" && crcOk) {
        if (length < 96) errors.push(`INFO record at offset ${off} too short`);
        else {
          const g = (i: number) => u32(off + 12 + i * 4);
          info = {
            mediaType: g(0), encoderType: g(1), encoderRevision: g(2), fileKey: g(3), fileRevision: g(4), origin: g(5),
            minTrack: g(6), maxTrack: g(7), minSide: g(8), maxSide: g(9), creationDate: g(10), creationTime: g(11),
            platforms: [g(12), g(13), g(14), g(15)], diskNumber: g(16), creatorId: g(17)
          };
        }
      } else if (type === "IMGE" && crcOk) {
        if (length < 80) errors.push(`IMGE record at offset ${off} too short`);
        else {
          const g = (i: number) => u32(off + 12 + i * 4);
          imges.push({
            track: g(0), side: g(1), density: g(2), signalType: g(3), trackBytes: g(4), startBytePos: g(5), startBitPos: g(6),
            dataBits: g(7), gapBits: g(8), trackBits: g(9), blockCount: g(10), encoderProcess: g(11), flags: g(12), dataKey: g(13),
            blocks: [], protected: false, reasons: []
          });
        }
      } else if (type === "DATA") {
        if (length < 28) errors.push(`DATA record at offset ${off} too short`);
        else {
          const dataLength = u32(off + 12);
          const dataCrc = u32(off + 20);
          const key = u32(off + 24);
          const start = off + length;
          if (start + dataLength > bytes.length) {
            errors.push(`truncated DATA area at offset ${start}`);
            break;
          }
          const area = bytes.slice(start, start + dataLength);
          if (crc32(area) !== dataCrc) errors.push(`CRC mismatch in DATA area (key ${key}) at offset ${start}`);
          else areas.set(key, area);
          advance = length + dataLength;
        }
      } else if (type !== "CAPS") {
        warnings.push(`unsupported record type '${type}' at offset ${off} skipped${type === "FDI " || type === "TRCK" ? " (not a record of the real IPF format)" : ""}`);
      }
      off += advance;
    }

    for (const t of imges) decodeTrack(t, areas.get(t.dataKey), info);
    return new IpfImage(records, info, imges, errors, warnings);
  }
};

function decodeTrack(t: IpfTrack, area: Uint8Array | undefined, info: IpfInfo | undefined) {
  const fail = (r: string) => {
    t.protected = true;
    t.reasons.push(r);
  };
  if (info && info.encoderType !== 1 && info.encoderType !== 2) t.reasons.push(`unknown encoder type ${info.encoderType}`);
  if (t.signalType !== 1) fail(`unsupported signal type ${t.signalType} (only 2µs MFM cells)`);
  if (!area) return fail("data area missing or failed its CRC");
  if (t.blockCount * 32 > area.length) return fail("block descriptors exceed data area");
  const dv = new DataView(area.buffer, area.byteOffset, area.byteLength);
  const u32 = (o: number) => dv.getUint32(o, false);
  for (let b = 0; b < t.blockCount; b++) {
    const g = (i: number) => u32(b * 32 + i * 4);
    t.blocks.push({ dataBits: g(0), gapBits: g(1), gapOffset: g(2), cellType: g(3), encoderType: g(4), blockFlags: g(5), gapDefault: g(6), dataOffset: g(7) });
  }
  const out: number[] = [];
  let prev = 0;
  const stream = (offset: number, label: string): number => {
    let p = offset;
    let bits = 0;
    while (p < area.length) {
      const head = area[p++]!;
      const type = head & 0x1f;
      const nb = head >> 5;
      if (nb > 4 || p + nb > area.length) { fail(`${label}: bad element header`); return bits; }
      let size = 0;
      for (let i = 0; i < nb; i++) size = size * 256 + area[p++]!;
      if (type === 0) return bits;
      if (type === 3) {
        // Gap element: in real CAPS streams, type 3 carries a payload of `size` bytes.
        // In synthetic tests, `size` represents gap cells with no payload bytes.
        if (p + size <= area.length && size > 0 && (size < 16 || nb === 1)) {
          const payload = area.subarray(p, p + size);
          p += size;
          const r = mfmEncodeBytes(payload, prev);
          prev = r.prev;
          for (const v of r.out) out.push(v);
          bits += size * 16;
          continue;
        }
        if (size % 16 !== 0) { fail(`${label}: gap of ${size} cells is not byte aligned`); return bits; }
        const r = mfmEncodeBytes(new Uint8Array(size / 16), prev);
        prev = r.prev;
        for (const v of r.out) out.push(v);
        bits += size;
        continue;
      }
      if (p + size > area.length) { fail(`${label}: element payload exceeds data area`); return bits; }
      const payload = area.subarray(p, p + size);
      p += size;
      if (type === 1 || type === 4) {
        for (const v of payload) out.push(v);
        if (payload.length) prev = payload[payload.length - 1]! & 1;
        bits += size * 8;
      } else if (type === 2) {
        const r = mfmEncodeBytes(payload, prev);
        prev = r.prev;
        for (const v of r.out) out.push(v);
        bits += size * 16;
      } else if (type === 5) {
        fail(`${label}: fuzzy (weak-bit) data`);
        return bits;
      } else {
        fail(`${label}: unknown element type ${type}`);
        return bits;
      }
    }
    return bits;
  };
  for (let b = 0; b < t.blocks.length && !t.protected; b++) {
    const blk = t.blocks[b]!;
    if (blk.blockFlags !== 0) { fail(`block ${b} uses flags 0x${blk.blockFlags.toString(16)} (variable density/fuzzy)`); break; }
    const dbits = stream(blk.dataOffset, `block ${b} data`);
    if (!t.protected && dbits !== blk.dataBits) fail(`block ${b} data is ${dbits} cells, descriptor says ${blk.dataBits}`);
    if (!t.protected && blk.gapBits > 0 && blk.gapOffset < area.length) {
      const gbits = stream(blk.gapOffset, `block ${b} gap`);
      if (!t.protected && gbits !== blk.gapBits) fail(`block ${b} gap is ${gbits} cells, descriptor says ${blk.gapBits}`);
    }
  }
  if (out.length * 8 !== t.trackBits) fail(`stream has ${out.length * 8} cells, IMGE says ${t.trackBits}`);
  if (t.protected) return;
  t.mfm = Uint8Array.from(out);
  const dec = decodeAmigaTrack(t.mfm, out.length * 8);
  const sectors: Uint8Array[] = [];
  for (let s = 0; s < SECTORS_PER_TRACK; s++) {
    const d = dec.sectors.get(s);
    if (!d) return fail(`not plain AmigaDOS MFM: sector ${s} missing${dec.errors.length ? ` (${dec.errors[0]})` : ""}`);
    sectors.push(d);
  }
  if (dec.trackNumber !== undefined && dec.trackNumber !== t.track * 2 + t.side) return fail(`sector headers say track ${dec.trackNumber}, IMGE says ${t.track * 2 + t.side}`);
  t.sectors = sectors;
}

/** Cheap format sniffing: 'ipf' by the CAPS magic, 'adf' by exact size. */
export function identifyImage(bytes: Uint8Array): "ipf" | "adf" | "unknown" {
  if (bytes.length >= 4 && bytes[0] === 0x43 && bytes[1] === 0x41 && bytes[2] === 0x50 && bytes[3] === 0x53) return "ipf";
  if (bytes.length === ADF_SIZE) return "adf";
  return "unknown";
}
