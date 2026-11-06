import { crc32 } from "../ipf/mfm.js";

export interface StoredZipEntry {
  name: string;
  data: Uint8Array;
}

/**
 * Creates a minimal valid ZIP archive containing the given files stored without compression (compression method 0).
 * Compatible with standard ZIP extractors, Emscripten FS decompression, and JSZip.
 */
export function createStoredZip(entries: StoredZipEntry[]): Uint8Array {
  const enc = new TextEncoder();
  let localHeadersSize = 0;
  let cdSize = 0;
  for (const e of entries) {
    const nameBytes = enc.encode(e.name);
    localHeadersSize += 30 + nameBytes.length + e.data.length;
    cdSize += 46 + nameBytes.length;
  }
  const totalSize = localHeadersSize + cdSize + 22;
  const out = new Uint8Array(totalSize);
  const view = new DataView(out.buffer);

  let localOffset = 0;
  const offsets: number[] = [];

  for (const e of entries) {
    offsets.push(localOffset);
    const nameBytes = enc.encode(e.name);
    const crc = crc32(e.data);

    // Local file header (0x04034b50)
    view.setUint32(localOffset, 0x04034b50, true);
    view.setUint16(localOffset + 4, 10, true); // Version needed to extract (1.0)
    view.setUint16(localOffset + 6, 0, true);  // General purpose bit flag
    view.setUint16(localOffset + 8, 0, true);  // Compression method (0 = stored)
    view.setUint32(localOffset + 10, 0, true); // Mod time & date
    view.setUint32(localOffset + 14, crc, true); // CRC-32
    view.setUint32(localOffset + 18, e.data.length, true); // Compressed size
    view.setUint32(localOffset + 22, e.data.length, true); // Uncompressed size
    view.setUint16(localOffset + 26, nameBytes.length, true); // File name length
    view.setUint16(localOffset + 28, 0, true); // Extra field length
    out.set(nameBytes, localOffset + 30);
    out.set(e.data, localOffset + 30 + nameBytes.length);

    localOffset += 30 + nameBytes.length + e.data.length;
  }

  let cdOffset = localOffset;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]!;
    const nameBytes = enc.encode(e.name);
    const crc = crc32(e.data);
    const off = offsets[i]!;

    // Central directory file header (0x02014b50)
    view.setUint32(cdOffset, 0x02014b50, true);
    view.setUint16(cdOffset + 4, 20, true); // Version made by (2.0)
    view.setUint16(cdOffset + 6, 10, true); // Version needed to extract (1.0)
    view.setUint16(cdOffset + 8, 0, true);  // General purpose bit flag
    view.setUint16(cdOffset + 10, 0, true); // Compression method (0 = stored)
    view.setUint32(cdOffset + 12, 0, true); // Mod time & date
    view.setUint32(cdOffset + 16, crc, true); // CRC-32
    view.setUint32(cdOffset + 20, e.data.length, true); // Compressed size
    view.setUint32(cdOffset + 24, e.data.length, true); // Uncompressed size
    view.setUint16(cdOffset + 28, nameBytes.length, true); // File name length
    view.setUint16(cdOffset + 30, 0, true); // Extra field length
    view.setUint16(cdOffset + 32, 0, true); // File comment length
    view.setUint16(cdOffset + 34, 0, true); // Disk number start
    view.setUint16(cdOffset + 36, 0, true); // Internal file attributes
    view.setUint32(cdOffset + 38, 0, true); // External file attributes
    view.setUint32(cdOffset + 42, off, true); // Relative offset of local header
    out.set(nameBytes, cdOffset + 46);

    cdOffset += 46 + nameBytes.length;
  }

  const eocdOffset = cdOffset;
  // End of central directory record (0x06054b50)
  view.setUint32(eocdOffset, 0x06054b50, true);
  view.setUint16(eocdOffset + 4, 0, true); // Number of this disk
  view.setUint16(eocdOffset + 6, 0, true); // Disk with central directory
  view.setUint16(eocdOffset + 8, entries.length, true); // Entries on this disk
  view.setUint16(eocdOffset + 10, entries.length, true); // Total entries
  view.setUint32(eocdOffset + 12, cdSize, true); // Size of central directory
  view.setUint32(eocdOffset + 16, localHeadersSize, true); // Offset of start of central directory
  view.setUint16(eocdOffset + 20, 0, true); // Comment length

  return out;
}
