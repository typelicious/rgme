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

  /** Finds all disk images in the archive (.adf, .ipf, .d64, .m3u). */
  getMediaEntries(): ZipEntry[] {
    const MEDIA_EXTS = [".adf", ".ipf", ".d64", ".m3u", ".mod", ".md"];
    return this.entries.filter((e) => {
      const lower = e.filename.toLowerCase();
      return MEDIA_EXTS.some((ext) => lower.endsWith(ext));
    });
  }
}
