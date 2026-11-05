/**
 * Standard AmigaDOS MFM track codec (11 sectors x 512 bytes per track).
 *
 * Scope: only *plain* AmigaDOS-formatted tracks. Copy-protected / custom-format tracks are not decoded here;
 * emulating them needs a flux-level (cell timing) engine that does not exist in this repository.
 */

export const SECTORS_PER_TRACK = 11;
export const SECTOR_SIZE = 512;
export const TRACKS = 160; // 80 cylinders x 2 sides
export const ADF_SIZE = TRACKS * SECTORS_PER_TRACK * SECTOR_SIZE; // 901,120
/** Bytes of one encoded track as produced by `encodeAmigaTrack` (11 x 1088 sector bytes + trailing gap). */
export const TRACK_BYTES = 12668;
const M = 0x55555555;

let crcTable: Uint32Array | undefined;
/** Standard CRC-32 (IEEE 802.3, as used by IPF records). */
export function crc32(data: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = crcTable[(c ^ data[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** MFM-encode a 32-cell word whose data bits sit at the even bit positions; `prev` is the preceding data bit. */
function encLong(d: number, prev: number): [number, number] {
  const x = d >>> 0;
  const clock = ~(((x << 1) | (x >>> 1) | (prev << 31)) >>> 0) & 0xaaaaaaaa;
  return [(x | clock) >>> 0, x & 1];
}

/** Sequential MFM encoding of whole data bytes (2 MFM bytes per data byte, MSB first). Returns the new `prev` bit. */
export function mfmEncodeBytes(data: Uint8Array, prev: number): { out: Uint8Array; prev: number } {
  const out = new Uint8Array(data.length * 2);
  let p = prev;
  for (let i = 0; i < data.length; i++) {
    let w = 0;
    for (let b = 7; b >= 0; b--) {
      const d = (data[i]! >> b) & 1;
      const clock = p === 0 && d === 0 ? 1 : 0;
      w = (w << 2) | (clock << 1) | d;
      p = d;
    }
    out[2 * i] = (w >> 8) & 0xff;
    out[2 * i + 1] = w & 0xff;
  }
  return { out, prev: p };
}

class Out {
  buf: number[] = [];
  prev = 0;
  long(m: number) {
    this.buf.push((m >>> 24) & 255, (m >>> 16) & 255, (m >>> 8) & 255, m & 255);
  }
  enc(d: number) {
    const [m, p] = encLong(d, this.prev);
    this.prev = p;
    this.long(m);
  }
}

/** Encodes one track (11 sectors of 512 bytes each) into AmigaDOS MFM. `track` = cylinder*2 + side. */
export function encodeAmigaTrack(sectors: ReadonlyArray<Uint8Array>, track: number): Uint8Array {
  if (sectors.length !== SECTORS_PER_TRACK) throw new RangeError("A track needs 11 sectors");
  const o = new Out();
  for (let s = 0; s < SECTORS_PER_TRACK; s++) {
    const data = sectors[s]!;
    if (data.length !== SECTOR_SIZE) throw new RangeError("Sector must be 512 bytes");
    o.enc(0); // 4 gap bytes
    o.long(0x44894489);
    o.prev = 1;
    const info = (((0xff << 24) | (track << 16) | (s << 8) | (SECTORS_PER_TRACK - s)) >>> 0);
    const hd: number[] = [(info >>> 1) & M, info & M];
    for (let i = 0; i < 8; i++) hd.push(0); // 16-byte label (odd + even halves)
    let hsum = 0;
    for (const d of hd) {
      o.enc(d);
      hsum ^= d;
    }
    hsum = (hsum & M) >>> 0;
    o.enc((hsum >>> 1) & M);
    o.enc(hsum & M);
    const odd: number[] = [];
    const even: number[] = [];
    let dsum = 0;
    for (let i = 0; i < 128; i++) {
      const x = ((data[4 * i]! << 24) | (data[4 * i + 1]! << 16) | (data[4 * i + 2]! << 8) | data[4 * i + 3]!) >>> 0;
      odd.push((x >>> 1) & M);
      even.push(x & M);
      dsum ^= odd[i]! ^ even[i]!;
    }
    dsum = (dsum & M) >>> 0;
    o.enc((dsum >>> 1) & M);
    o.enc(dsum & M);
    for (const d of odd) o.enc(d);
    for (const d of even) o.enc(d);
  }
  while (o.buf.length < TRACK_BYTES) o.enc(0);
  return Uint8Array.from(o.buf.slice(0, TRACK_BYTES));
}

export interface DecodedTrack {
  /** Index = sector number 0..10; undefined when missing or failing a checksum. */
  sectors: Map<number, Uint8Array | undefined>;
  errors: string[];
  /** Track number found in the sector headers (cylinder*2+side), if any. */
  trackNumber?: number;
}

/**
 * Decodes an AmigaDOS MFM track. The bitstream is treated as circular and sync words (0x4489 0x4489) are found
 * at any bit offset, so rotated tracks decode. Both header and data checksums are verified.
 */
export function decodeAmigaTrack(mfm: Uint8Array, bitLength = mfm.length * 8): DecodedTrack {
  const sectors = new Map<number, Uint8Array | undefined>();
  for (let s = 0; s < SECTORS_PER_TRACK; s++) sectors.set(s, undefined);
  const errors: string[] = [];
  let trackNumber: number | undefined;
  const total = bitLength;
  const bit = (pos: number) => {
    const p = ((pos % total) + total) % total;
    return (mfm[p >> 3]! >> (7 - (p & 7))) & 1;
  };
  const long = (pos: number) => {
    let v = 0;
    for (let i = 0; i < 32; i++) v = ((v << 1) | bit(pos + i)) >>> 0;
    return v >>> 0;
  };
  let win = 0;
  for (let i = 0; i < total + 31; i++) {
    win = ((win << 1) | bit(i)) >>> 0;
    if (i < 31 || win !== 0x44894489) continue;
    let pos = i + 1;
    const next = () => {
      const v = long(pos);
      pos += 32;
      return v;
    };
    const iOdd = next(), iEven = next();
    const info = ((((iOdd & M) << 1) | (iEven & M)) >>> 0);
    const label: number[] = [];
    for (let k = 0; k < 8; k++) label.push(next());
    const hOdd = next(), hEven = next();
    let hcalc = (iOdd ^ iEven) >>> 0;
    for (const l of label) hcalc = (hcalc ^ l) >>> 0;
    hcalc = (hcalc & M) >>> 0;
    const hstored = ((((hOdd & M) << 1) | (hEven & M)) >>> 0);
    const where = `at bit ${i - 31}`;
    if (hcalc !== hstored) {
      errors.push(`header checksum mismatch ${where}`);
      continue;
    }
    if (info >>> 24 !== 0xff) {
      errors.push(`unexpected format byte ${where}`);
      continue;
    }
    const sec = (info >>> 8) & 0xff;
    const trk = (info >>> 16) & 0xff;
    if (sec >= SECTORS_PER_TRACK) {
      errors.push(`sector number ${sec} out of range ${where}`);
      continue;
    }
    const dOdd = next(), dEven = next();
    const dstored = ((((dOdd & M) << 1) | (dEven & M)) >>> 0);
    const odd: number[] = [], even: number[] = [];
    let dcalc = 0;
    for (let k = 0; k < 128; k++) {
      const v = next();
      odd.push(v);
      dcalc ^= v;
    }
    for (let k = 0; k < 128; k++) {
      const v = next();
      even.push(v);
      dcalc ^= v;
    }
    dcalc = (dcalc & M) >>> 0;
    if (dcalc !== dstored) {
      errors.push(`data checksum mismatch in sector ${sec} (track ${trk})`);
      continue;
    }
    if (sectors.get(sec)) continue; // duplicate
    const out = new Uint8Array(SECTOR_SIZE);
    for (let k = 0; k < 128; k++) {
      const x = ((((odd[k]! & M) << 1) | (even[k]! & M)) >>> 0);
      out[4 * k] = x >>> 24;
      out[4 * k + 1] = (x >>> 16) & 255;
      out[4 * k + 2] = (x >>> 8) & 255;
      out[4 * k + 3] = x & 255;
    }
    sectors.set(sec, out);
    trackNumber ??= trk;
  }
  return { sectors, errors, trackNumber };
}
