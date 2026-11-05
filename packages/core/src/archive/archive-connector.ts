import { ZipParser } from "../zip/zip-parser.js";
import { sha256Hex } from "../export/build-export.js";

export interface ArchiveOrgFile {
  name: string;
  size?: number;
  format?: string;
  mtime?: string;
}

export interface ArchiveOrgMetadata {
  identifier: string;
  title: string;
  description?: string;
  files: ArchiveOrgFile[];
}

export interface StreamedRetroMedia {
  identifier: string;
  sourceFilename: string;
  diskFilename: string;
  bytes: Uint8Array;
  sha256: string;
  size: number;
  format: "adf" | "ipf" | "d64" | "md" | "zip" | "unknown";
  allFiles?: string[];
}

export interface ArchiveConnectorOptions {
  fetchFn?: typeof fetch;
  corsProxy?: string;
}

export const ARCHIVE_COLLECTION_PRESETS = [
  {
    id: "Amiga-Arquivista",
    title: "Amiga Arquivista Collection",
    description: "Curated historical Amiga disk preservation library (.adf / .zip)"
  },
  {
    id: "Amiga_WHD_Games",
    title: "Amiga WHD Games Preservation",
    description: "Curated collection of pre-installed WHDLoad Amiga game packages"
  }
];

export class ArchiveOrgConnector {
  private readonly fetchFn: typeof fetch;
  private readonly corsProxy?: string;

  constructor(opts: ArchiveConnectorOptions = {}) {
    this.fetchFn = opts.fetchFn ?? globalThis.fetch?.bind(globalThis);
    this.corsProxy = opts.corsProxy;
  }

  private buildUrl(url: string): string {
    if (!this.corsProxy) return url;
    return `${this.corsProxy}${encodeURIComponent(url)}`;
  }

  /**
   * Queries metadata for an archive.org identifier and returns matching retro disk/rom files.
   */
  async fetchMetadata(identifier: string): Promise<ArchiveOrgMetadata> {
    const cleanId = identifier.trim().replace(/^https?:\/\/archive\.org\/(details|download)\//i, "").split("/")[0]!;
    const rawUrl = `https://archive.org/metadata/${encodeURIComponent(cleanId)}`;
    const url = this.buildUrl(rawUrl);
    const res = await this.fetchFn(url);
    if (!res.ok) {
      throw new Error(`Archive.org metadata fetch failed with HTTP ${res.status} for "${cleanId}"`);
    }
    const json = (await res.json()) as {
      metadata?: { title?: string; description?: string };
      files?: Array<{ name: string; size?: string | number; format?: string; mtime?: string }>;
    };

    const files: ArchiveOrgFile[] = (json.files ?? [])
      .filter((f) => /\.(adf|ipf|d64|md|zip|m3u)$/i.test(f.name))
      .map((f) => ({
        name: f.name,
        size: typeof f.size === "string" ? parseInt(f.size, 10) : f.size,
        format: f.format,
        mtime: f.mtime
      }));

    return {
      identifier: cleanId,
      title: json.metadata?.title ?? cleanId,
      description: json.metadata?.description,
      files
    };
  }

  /**
   * Streams a file from Archive.org directly into browser RAM.
   * If the file is a ZIP archive, extracts the primary retro image in-memory.
   */
  async streamFile(identifier: string, filename: string): Promise<StreamedRetroMedia> {
    const cleanId = identifier.trim().replace(/^https?:\/\/archive\.org\/(details|download)\//i, "").split("/")[0]!;
    const rawUrl = `https://archive.org/download/${encodeURIComponent(cleanId)}/${encodeURIComponent(filename)}`;
    const url = this.buildUrl(rawUrl);
    const res = await this.fetchFn(url);
    if (!res.ok) {
      throw new Error(`Archive.org file stream failed with HTTP ${res.status} for "${filename}"`);
    }
    const buf = await res.arrayBuffer();
    const rawBytes = new Uint8Array(buf);

    if (ZipParser.isZip(rawBytes) || /\.zip$/i.test(filename)) {
      const zip = new ZipParser(rawBytes);
      const retroEntry = zip.entries.find((e) => /\.(adf|ipf|d64|md)$/i.test(e.filename)) ?? zip.entries[0];
      if (!retroEntry) {
        throw new Error(`ZIP archive "${filename}" does not contain any playable retro media files`);
      }
      const extractedBytes = await zip.extract(retroEntry.filename);
      if (!extractedBytes) {
        throw new Error(`Failed to extract "${retroEntry.filename}" from archive "${filename}"`);
      }
      const sha = await sha256Hex(extractedBytes);
      const ext = retroEntry.filename.split(".").pop()?.toLowerCase();
      const format = ext === "adf" || ext === "ipf" || ext === "d64" || ext === "md" ? ext : "unknown";

      return {
        identifier: cleanId,
        sourceFilename: filename,
        diskFilename: retroEntry.filename,
        bytes: extractedBytes,
        sha256: sha,
        size: extractedBytes.length,
        format,
        allFiles: zip.entries.map((e) => e.filename)
      };
    }

    const sha = await sha256Hex(rawBytes);
    const ext = filename.split(".").pop()?.toLowerCase();
    const format = ext === "adf" || ext === "ipf" || ext === "d64" || ext === "md" ? ext : "unknown";

    return {
      identifier: cleanId,
      sourceFilename: filename,
      diskFilename: filename,
      bytes: rawBytes,
      sha256: sha,
      size: rawBytes.length,
      format
    };
  }
}
