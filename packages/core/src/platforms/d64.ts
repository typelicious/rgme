/**
 * Commodore 1541 D64 disk-image parser (read-only).
 * Handles 35-track images (174,848 bytes) with or without the 683 trailing error bytes.
 */

export class D64Error extends Error {}

export const D64_SIZE = 174848;
export const D64_SIZE_WITH_ERRORS = D64_SIZE + 683;
export const D64_TRACKS = 35;

/** Sectors per track: 1-17 => 21, 18-24 => 19, 25-30 => 18, 31-35 => 17. */
export function sectorsInTrack(track: number): number {
  if (!Number.isInteger(track) || track < 1 || track > D64_TRACKS) throw new D64Error(`Invalid track ${track}`);
  return track <= 17 ? 21 : track <= 24 ? 19 : track <= 30 ? 18 : 17;
}

export function sectorOffset(track: number, sector: number): number {
  const n = sectorsInTrack(track);
  if (!Number.isInteger(sector) || sector < 0 || sector >= n) throw new D64Error(`Invalid sector ${track}/${sector}`);
  let sum = 0;
  for (let t = 1; t < track; t++) sum += sectorsInTrack(t);
  return (sum + sector) * 256;
}

export type D64FileType = "DEL" | "SEQ" | "PRG" | "USR" | "REL";
const TYPES: D64FileType[] = ["DEL", "SEQ", "PRG", "USR", "REL"];

export interface D64Entry {
  name: string;
  type: D64FileType;
  closed: boolean;
  locked: boolean;
  track: number;
  sector: number;
  blocks: number;
}

export interface D64Disk {
  name: string;
  id: string;
  dosVersion: number;
  hasErrorBytes: boolean;
  /** Free blocks as shown by a CBM directory listing (track 18 excluded). */
  freeBlocks: number;
  /** True when every BAM free-count matches its bitmap. */
  bamConsistent: boolean;
  entries: D64Entry[];
}

/** PETSCII-ish to ASCII: strips 0xA0 padding, maps 0xC1-0xDA to A-Z. */
export function petsciiToAscii(bytes: Uint8Array): string {
  let end = bytes.length;
  while (end > 0 && bytes[end - 1] === 0xa0) end--;
  let s = "";
  for (let i = 0; i < end; i++) {
    const b = bytes[i]!;
    s += b >= 0xc1 && b <= 0xda ? String.fromCharCode(b - 0x80) : b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : "?";
  }
  return s;
}

export class D64Parser {
  readonly hasErrorBytes: boolean;

  constructor(private readonly data: Uint8Array) {
    if (data.length !== D64_SIZE && data.length !== D64_SIZE_WITH_ERRORS) {
      throw new D64Error(`Unsupported D64 size ${data.length} (expected ${D64_SIZE} or ${D64_SIZE_WITH_ERRORS})`);
    }
    this.hasErrorBytes = data.length === D64_SIZE_WITH_ERRORS;
  }

  readSector(track: number, sector: number): Uint8Array {
    const o = sectorOffset(track, sector);
    return this.data.subarray(o, o + 256);
  }

  parse(): D64Disk {
    const bam = this.readSector(18, 0);
    let free = 0;
    let consistent = true;
    for (let t = 1; t <= D64_TRACKS; t++) {
      const p = 4 * t;
      const count = bam[p]!;
      let bits = 0;
      for (let s = 0; s < sectorsInTrack(t); s++) if (bam[p + 1 + (s >> 3)]! & (1 << (s & 7))) bits++;
      if (bits !== count) consistent = false;
      if (t !== 18) free += count;
    }
    return {
      name: petsciiToAscii(bam.subarray(144, 160)),
      id: petsciiToAscii(bam.subarray(162, 164)),
      dosVersion: bam[2]!,
      hasErrorBytes: this.hasErrorBytes,
      freeBlocks: free,
      bamConsistent: consistent,
      entries: this.readDirectory(bam[0]!, bam[1]!)
    };
  }

  private readDirectory(startTrack: number, startSector: number): D64Entry[] {
    const entries: D64Entry[] = [];
    const seen = new Set<number>();
    let t = startTrack;
    let s = startSector;
    while (t !== 0) {
      const key = t * 256 + s;
      if (seen.has(key)) throw new D64Error("Directory chain loop");
      seen.add(key);
      const sec = this.readSector(t, s);
      for (let i = 0; i < 8; i++) {
        const e = sec.subarray(i * 32, i * 32 + 32);
        const typeByte = e[2]!;
        if (typeByte === 0) continue;
        entries.push({
          name: petsciiToAscii(e.subarray(5, 21)),
          type: TYPES[typeByte & 7] ?? "DEL",
          closed: (typeByte & 0x80) !== 0,
          locked: (typeByte & 0x40) !== 0,
          track: e[3]!,
          sector: e[4]!,
          blocks: e[28]! | (e[29]! << 8)
        });
      }
      t = sec[0]!;
      s = sec[1]!;
    }
    return entries;
  }

  /** Follows the sector chain (loop guarded) and returns the raw file bytes (PRG: first two bytes = load address). */
  readFile(entry: Pick<D64Entry, "track" | "sector">): Uint8Array {
    const chunks: Uint8Array[] = [];
    const seen = new Set<number>();
    let t = entry.track;
    let s = entry.sector;
    while (true) {
      const key = t * 256 + s;
      if (seen.has(key)) throw new D64Error("File chain loop");
      seen.add(key);
      const sec = this.readSector(t, s);
      const nt = sec[0]!;
      const ns = sec[1]!;
      if (nt === 0) {
        chunks.push(sec.subarray(2, Math.max(2, ns + 1)));
        break;
      }
      chunks.push(sec.subarray(2, 256));
      t = nt;
      s = ns;
    }
    const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
    let o = 0;
    for (const c of chunks) {
      out.set(c, o);
      o += c.length;
    }
    return out;
  }

  /** Finds a file by (case-insensitive) name. */
  findFile(disk: D64Disk, name: string): D64Entry | undefined {
    return disk.entries.find((e) => e.name.toUpperCase() === name.toUpperCase());
  }
}

export function prgLoadAddress(bytes: Uint8Array): number {
  if (bytes.length < 2) throw new D64Error("PRG too short");
  return bytes[0]! | (bytes[1]! << 8);
}

/** Lines of a classic `LOAD"$",8 / LIST` directory listing. */
export function c64DirectoryListing(disk: D64Disk): string[] {
  const lines = [`0 "${disk.name.padEnd(16)}" ${disk.id} 2A`];
  for (const e of disk.entries) {
    const quoted = `"${e.name}"`.padEnd(18);
    lines.push(`${String(e.blocks).padEnd(5)}${quoted} ${e.type}${e.closed ? " " : "*"}${e.locked ? "<" : ""}`.trimEnd());
  }
  lines.push(`${disk.freeBlocks} BLOCKS FREE.`);
  return lines;
}
