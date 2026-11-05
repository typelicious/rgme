/** Read-only Amiga Disk File (OFS/FFS) parser. Pure TypeScript, never mutates the input buffer. */

export const ADF_SIZE = 901120;
export const BLOCK_SIZE = 512;
export const BLOCK_COUNT = 1760;
export const ROOT_BLOCK = 880;
const HT_SIZE = 72;

const T_HEADER = 2;
const T_DATA = 8;
const T_LIST = 16;
const ST_ROOT = 1;
const ST_DIR = 2;
const ST_FILE = -3 >>> 0; // 0xFFFFFFFD

export class AdfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdfError";
  }
}

export type AdfVariant = "OFS" | "FFS";

export interface DirEntry {
  name: string;
  /** Slash-separated path from the root, e.g. "s/startup-sequence". */
  path: string;
  type: "file" | "dir";
  /** File size in bytes (0 for directories). */
  size: number;
  headerBlock: number;
  modified: Date;
  comment: string;
  protection: number;
  checksumValid: boolean;
  children?: DirEntry[];
}

export interface AdfInfo {
  label: string;
  variant: AdfVariant;
  /** Raw flags byte of the DOS magic (bit0 FFS, bit1 international, bit2 dir cache). */
  flags: number;
  international: boolean;
  dirCache: boolean;
  bootable: boolean;
  bootChecksumValid: boolean;
  rootChecksumValid: boolean;
  created: Date;
  modified: Date;
  hashTable: number[];
  root: DirEntry;
}

/** Amiga name hash (case-insensitive, optionally international). */
export function hashName(name: string, international = false): number {
  let h = name.length;
  for (let i = 0; i < name.length; i++) {
    let c = name.charCodeAt(i) & 0xff;
    if (international ? (c >= 0x61 && c <= 0x7a) || (c >= 0xe0 && c <= 0xfe && c !== 0xf7) : c >= 0x61 && c <= 0x7a) c -= 32;
    h = (h * 13 + c) & 0x7ff;
  }
  return h % HT_SIZE;
}

/** Convert Amiga days/minutes/ticks (since 1978-01-01) to a Date (UTC). */
export function amigaDate(days: number, mins: number, ticks: number): Date {
  return new Date(Date.UTC(1978, 0, 1) + days * 86400000 + mins * 60000 + (ticks / 50) * 1000);
}

export class AdfParser {
  private readonly view: DataView;
  private info?: AdfInfo;

  constructor(private readonly data: Uint8Array) {
    if (data.length !== ADF_SIZE) throw new AdfError(`ADF must be ${ADF_SIZE} bytes, got ${data.length}`);
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  }

  private long(block: number, index: number): number {
    return this.view.getUint32(block * BLOCK_SIZE + index * 4, false);
  }
  private slong(block: number, index: number): number {
    return this.view.getInt32(block * BLOCK_SIZE + index * 4, false);
  }
  private checkBlock(block: number) {
    if (!Number.isInteger(block) || block < 2 || block >= BLOCK_COUNT) throw new AdfError(`Block ${block} out of range`);
  }

  /** Block checksum: sum of all 128 longs (checksum field included) wraps to 0. */
  private blockSumValid(block: number): boolean {
    let sum = 0;
    for (let i = 0; i < 128; i++) sum = (sum + this.long(block, i)) >>> 0;
    return sum === 0;
  }

  /** Bootblock checksum: 32-bit sum over 1024 bytes with end-around carry equals 0xFFFFFFFF. */
  private bootSumValid(): boolean {
    let sum = 0;
    for (let i = 0; i < 256; i++) {
      sum += this.view.getUint32(i * 4, false);
      if (sum > 0xffffffff) sum = (sum & 0xffffffff) + 1;
    }
    return sum >>> 0 === 0xffffffff;
  }

  private str(block: number, lenIndex: number, max: number): string {
    const off = block * BLOCK_SIZE + lenIndex * 4;
    const len = Math.min(this.data[off]!, max);
    let s = "";
    for (let i = 0; i < len; i++) s += String.fromCharCode(this.data[off + 1 + i]!);
    return s;
  }

  private date(block: number, firstIndex: number): Date {
    return amigaDate(this.long(block, firstIndex), this.long(block, firstIndex + 1), this.long(block, firstIndex + 2));
  }

  parse(): AdfInfo {
    if (this.info) return this.info;
    const d = this.data;
    if (d[0] !== 0x44 || d[1] !== 0x4f || d[2] !== 0x53) throw new AdfError("Not a DOS disk (missing 'DOS' bootblock magic)");
    const flags = d[3]!;
    const bootChecksumValid = this.bootSumValid();
    if (this.long(ROOT_BLOCK, 0) !== T_HEADER || this.long(ROOT_BLOCK, 127) !== ST_ROOT) throw new AdfError("Root block (sector 880) is invalid");

    const hashTable: number[] = [];
    for (let i = 0; i < HT_SIZE; i++) hashTable.push(this.long(ROOT_BLOCK, 6 + i));
    const international = (flags & 2) !== 0 || (flags & 4) !== 0;

    const root: DirEntry = {
      name: this.str(ROOT_BLOCK, 108, 30),
      path: "",
      type: "dir",
      size: 0,
      headerBlock: ROOT_BLOCK,
      modified: this.date(ROOT_BLOCK, 105),
      comment: "",
      protection: 0,
      checksumValid: this.blockSumValid(ROOT_BLOCK),
      children: this.readDir(hashTable, "", international, new Set([ROOT_BLOCK]))
    };
    this.info = {
      label: root.name,
      variant: flags & 1 ? "FFS" : "OFS",
      flags,
      international: (flags & 2) !== 0,
      dirCache: (flags & 4) !== 0,
      bootable: bootChecksumValid,
      bootChecksumValid,
      rootChecksumValid: root.checksumValid,
      created: this.date(ROOT_BLOCK, 121),
      modified: this.date(ROOT_BLOCK, 118),
      hashTable,
      root
    };
    return this.info;
  }

  private readDir(table: number[], parentPath: string, intl: boolean, seen: Set<number>): DirEntry[] {
    const out: DirEntry[] = [];
    for (const first of table) {
      let block = first;
      while (block !== 0) {
        if (block < 2 || block >= BLOCK_COUNT || seen.has(block)) break; // bounds + cycle guard
        seen.add(block);
        if (this.long(block, 0) !== T_HEADER) break;
        const sec = this.long(block, 127);
        const name = this.str(block, 108, 30);
        const path = parentPath ? `${parentPath}/${name}` : name;
        const base = {
          name, path, headerBlock: block,
          modified: this.date(block, 105),
          comment: this.str(block, 82, 79)
        };
        const checksumValid = this.blockSumValid(block);
        const prot = this.long(block, 80);
        if (sec === ST_FILE) {
          out.push({ ...base, protection: prot, type: "file", size: this.long(block, 81), checksumValid });
        } else if (sec === ST_DIR) {
          const ht: number[] = [];
          for (let i = 0; i < HT_SIZE; i++) ht.push(this.long(block, 6 + i));
          out.push({ ...base, protection: prot, type: "dir", size: 0, checksumValid, children: this.readDir(ht, path, intl, seen) });
        }
        block = this.long(block, 124); // next in hash chain
      }
    }
    return out.sort((a, b) => a.path.localeCompare(b.path));
  }

  /** All files (not directories), depth-first. */
  listFiles(): DirEntry[] {
    const out: DirEntry[] = [];
    const walk = (e: DirEntry) => {
      for (const c of e.children ?? []) {
        if (c.type === "file") out.push(c);
        else walk(c);
      }
    };
    walk(this.parse().root);
    return out;
  }

  find(path: string): DirEntry | undefined {
    let cur: DirEntry = this.parse().root;
    for (const part of path.split("/").filter(Boolean)) {
      const next: DirEntry | undefined = cur.children?.find((c) => c.name.toLowerCase() === part.toLowerCase());
      if (!next) return undefined;
      cur = next;
    }
    return cur;
  }

  readFile(path: string): Uint8Array {
    const entry = this.find(path);
    if (!entry || entry.type !== "file") throw new AdfError(`File not found: ${path}`);
    const ffs = this.parse().variant === "FFS";
    const size = entry.size;

    // gather data block pointers from the header and its extension chain
    const pointers: number[] = [];
    let block = entry.headerBlock;
    const seen = new Set<number>();
    while (block !== 0) {
      this.checkBlock(block);
      if (seen.has(block)) throw new AdfError("Extension chain loop");
      seen.add(block);
      const type = this.long(block, 0);
      if (type !== T_HEADER && type !== T_LIST) throw new AdfError(`Bad file block ${block}`);
      const count = Math.min(this.long(block, 2), HT_SIZE);
      for (let i = 0; i < count; i++) pointers.push(this.long(block, 77 - i));
      block = this.long(block, 126);
    }

    const out = new Uint8Array(size);
    let pos = 0;
    for (const p of pointers) {
      if (pos >= size) break;
      this.checkBlock(p);
      if (ffs) {
        const n = Math.min(BLOCK_SIZE, size - pos);
        out.set(this.data.subarray(p * BLOCK_SIZE, p * BLOCK_SIZE + n), pos);
        pos += n;
      } else {
        if (this.long(p, 0) !== T_DATA) throw new AdfError(`Block ${p} is not an OFS data block`);
        const n = this.long(p, 3);
        if (n > 488) throw new AdfError(`Bad OFS data size in block ${p}`);
        const take = Math.min(n, size - pos);
        out.set(this.data.subarray(p * BLOCK_SIZE + 24, p * BLOCK_SIZE + 24 + take), pos);
        pos += take;
      }
    }
    if (pos < size) throw new AdfError(`File ${path} truncated (${pos}/${size} bytes)`);
    return out;
  }
}
