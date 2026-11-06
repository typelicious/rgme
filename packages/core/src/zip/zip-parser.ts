/**
 * Pure TypeScript ZIP parser with zero external dependencies.
 * Extracts .adf, .ipf, .m3u and other disk image files using native DecompressionStream.
 */

export interface ZipEntry {
  filename: string;
  compressedSize: number;
  uncompressedSize: number;
  compressionMethod: number; // 0 = stored, 8 = deflate
  offset: number;
  dataOffset: number;
}

export class ZipParser {
  readonly entries: ZipEntry[] = [];

  constructor(private readonly buffer: Uint8Array) {
    this.parse();
  }

  static isZip(buffer: Uint8Array): boolean {
    if (buffer.length < 4) return false;
    return buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
  }

  private parse() {
    if (this.parseCentralDirectory()) {
      return;
    }
    this.parseLocalHeaders();
  }

  private parseCentralDirectory(): boolean {
    const len = this.buffer.length;
    if (len < 22) return false;
    const view = new DataView(this.buffer.buffer, this.buffer.byteOffset, this.buffer.byteLength);

    const searchLimit = Math.max(0, len - 65557);
    let eocdOffset = -1;
    for (let i = len - 22; i >= searchLimit; i--) {
      if (view.getUint32(i, true) === 0x06054b50) {
        eocdOffset = i;
        break;
      }
    }
    if (eocdOffset === -1) return false;

    const totalEntries = view.getUint16(eocdOffset + 10, true);
    const cdOffset = view.getUint32(eocdOffset + 16, true);
    if (cdOffset >= len) return false;

    let offset = cdOffset;
    for (let i = 0; i < totalEntries && offset + 46 <= len; i++) {
      const sig = view.getUint32(offset, true);
      if (sig !== 0x02014b50) break;

      const method = view.getUint16(offset + 10, true);
      const compSize = view.getUint32(offset + 20, true);
      const uncompSize = view.getUint32(offset + 24, true);
      const nameLen = view.getUint16(offset + 28, true);
      const extraLen = view.getUint16(offset + 30, true);
      const commentLen = view.getUint16(offset + 32, true);
      const localOffset = view.getUint32(offset + 42, true);

      const nameBytes = this.buffer.subarray(offset + 46, offset + 46 + nameLen);
      const filename = new TextDecoder().decode(nameBytes);

      if (localOffset + 30 <= len && view.getUint32(localOffset, true) === 0x04034b50) {
        const localNameLen = view.getUint16(localOffset + 26, true);
        const localExtraLen = view.getUint16(localOffset + 28, true);
        const dataOffset = localOffset + 30 + localNameLen + localExtraLen;

        if (!filename.endsWith("/")) {
          this.entries.push({
            filename,
            compressionMethod: method,
            compressedSize: compSize,
            uncompressedSize: uncompSize,
            offset: localOffset,
            dataOffset
          });
        }
      }

      offset += 46 + nameLen + extraLen + commentLen;
    }

    return this.entries.length > 0;
  }

  private parseLocalHeaders() {
    const view = new DataView(this.buffer.buffer, this.buffer.byteOffset, this.buffer.byteLength);
    let offset = 0;
    const len = this.buffer.length;

    while (offset + 30 <= len) {
      const sig = view.getUint32(offset, true);
      if (sig !== 0x04034b50) break; // Not a local file header

      const method = view.getUint16(offset + 8, true);
      const compSize = view.getUint32(offset + 18, true);
      const uncompSize = view.getUint32(offset + 22, true);
      const nameLen = view.getUint16(offset + 26, true);
      const extraLen = view.getUint16(offset + 28, true);

      const nameBytes = this.buffer.subarray(offset + 30, offset + 30 + nameLen);
      const filename = new TextDecoder().decode(nameBytes);
      const dataOffset = offset + 30 + nameLen + extraLen;

      if (!filename.endsWith("/")) {
        this.entries.push({
          filename,
          compressionMethod: method,
          compressedSize: compSize,
          uncompressedSize: uncompSize,
          offset,
          dataOffset
        });
      }

      offset = dataOffset + compSize;
    }
  }

  /** Extracts an entry by name or returns undefined. */
  async extract(filename: string): Promise<Uint8Array | undefined> {
    const entry = this.entries.find((e) => e.filename === filename || e.filename.endsWith("/" + filename));
    if (!entry) return undefined;
    return this.extractEntry(entry);
  }

  async extractEntry(entry: ZipEntry): Promise<Uint8Array> {
    const raw = this.buffer.subarray(entry.dataOffset, entry.dataOffset + entry.compressedSize);
    if (entry.compressionMethod === 0) {
      return raw.slice();
    }
    if (entry.compressionMethod === 8) {
      // Deflate decompression via standard Streams API
      const ds = new DecompressionStream("deflate-raw");
      const writer = ds.writable.getWriter();
      void writer.write(raw as unknown as BufferSource);
      void writer.close();
      const chunks: Uint8Array[] = [];
      const reader = ds.readable.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
      }
      const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
      const result = new Uint8Array(totalLen);
      let pos = 0;
      for (const chunk of chunks) {
        result.set(chunk, pos);
        pos += chunk.length;
      }
      return result;
    }
    throw new Error(`Unsupported ZIP compression method ${entry.compressionMethod}`);
  }

  /** Finds all disk images in the archive (.adf, .ipf, .d64, .m3u, etc.), prioritizing disk images over playlists. */
  getMediaEntries(): ZipEntry[] {
    const DISK_EXTS = [".adf", ".adz", ".dms", ".ipf", ".d64", ".md", ".mod"];
    const valid = this.entries.filter((e) => !e.filename.includes("__MACOSX"));
    const disks = valid.filter((e) => {
      const lower = e.filename.toLowerCase();
      return DISK_EXTS.some((ext) => lower.endsWith(ext));
    });
    if (disks.length > 0) {
      // Prioritize raw disk images (.adf, .adz, .dms) first, then .ipf, then others
      return disks.sort((a, b) => {
        const aLow = a.filename.toLowerCase();
        const bLow = b.filename.toLowerCase();
        const score = (f: string) =>
          f.endsWith(".adf") || f.endsWith(".adz") ? 0 : f.endsWith(".dms") ? 1 : f.endsWith(".ipf") ? 2 : 3;
        return score(aLow) - score(bLow);
      });
    }
    return valid.filter((e) => e.filename.toLowerCase().endsWith(".m3u"));
  }
}
