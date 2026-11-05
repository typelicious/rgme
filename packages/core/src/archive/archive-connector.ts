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

export interface StreamProgressEvent {
  stage: "connecting" | "downloading" | "extracting" | "ready" | "fallback";
  message: string;
}

export interface ArchiveConnectorOptions {
  fetchFn?: typeof fetch;
  corsProxy?: string;
  localProxyPrefix?: string;
  disableLocalProxy?: boolean;
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
  private readonly localProxyPrefix?: string;
  private readonly disableLocalProxy: boolean;

  constructor(opts: ArchiveConnectorOptions = {}) {
    this.fetchFn = opts.fetchFn ?? globalThis.fetch?.bind(globalThis);
    this.corsProxy = opts.corsProxy;
    this.localProxyPrefix = opts.localProxyPrefix;
    this.disableLocalProxy = opts.disableLocalProxy ?? false;
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

    let res: Response;
    try {
      res = await this.fetchFn(url);
    } catch (directErr) {
      if (!this.corsProxy) {
        // Fallback to public CORS proxy if browser direct fetch is blocked
        const fallbackUrl = `https://corsproxy.io/?url=${encodeURIComponent(rawUrl)}`;
        try {
          res = await this.fetchFn(fallbackUrl);
        } catch {
          throw new Error(`Archive.org metadata fetch failed for "${cleanId}": ${directErr instanceof Error ? directErr.message : String(directErr)}`);
        }
      } else {
        throw directErr;
      }
    }

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
   * Uses local dev server proxy if available on localhost, direct fetch, or CORS proxy fallback.
   * If the file is a ZIP archive, extracts the primary retro image in-memory.
   */
  async streamFile(
    identifier: string,
    filename: string,
    onProgress?: (event: StreamProgressEvent) => void
  ): Promise<StreamedRetroMedia> {
    const cleanId = identifier.trim().replace(/^https?:\/\/archive\.org\/(details|download)\//i, "").split("/")[0]!;
    const directUrl = `https://archive.org/download/${encodeURIComponent(cleanId)}/${encodeURIComponent(filename)}`;

    // Build candidates in priority order
    const candidates: Array<{ url: string; label: string }> = [];

    // 1. In browser environment on localhost/127.0.0.1, use Vite dev proxy to avoid CORS
    const isLocalhost =
      typeof window !== "undefined" &&
      typeof window.location?.hostname === "string" &&
      (window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1" ||
        window.location.hostname === "[::1]");

    if (isLocalhost && !this.disableLocalProxy) {
      const prefix = this.localProxyPrefix ?? "/api/archive-download";
      candidates.push({
        url: `${prefix}/${encodeURIComponent(cleanId)}/${encodeURIComponent(filename)}`,
        label: "Local dev proxy"
      });
    }

    // 2. Direct Archive.org download or custom configured proxy
    if (!this.corsProxy) {
      candidates.push({
        url: directUrl,
        label: "Direct Archive.org stream"
      });
    } else {
      candidates.push({
        url: `${this.corsProxy}${encodeURIComponent(directUrl)}`,
        label: "Configured CORS proxy"
      });
    }

    // 3. Fallback public CORS relays if custom proxy not set
    if (!this.corsProxy) {
      candidates.push({
        url: `https://corsproxy.io/?url=${encodeURIComponent(directUrl)}`,
        label: "CORS relay (corsproxy.io)"
      });
      candidates.push({
        url: `https://api.allorigins.win/raw?url=${encodeURIComponent(directUrl)}`,
        label: "CORS relay (allorigins.win)"
      });
    }

    let lastError: Error | null = null;
    let res: Response | null = null;

    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i]!;
      try {
        onProgress?.({
          stage: i === 0 ? "downloading" : "fallback",
          message:
            i === 0
              ? `Streaming "${filename}" into memory (${candidate.label})...`
              : `Retrying via ${candidate.label}...`
        });
        const r = await this.fetchFn(candidate.url);
        if (r.ok) {
          res = r;
          break;
        } else {
          lastError = new Error(`HTTP ${r.status} from ${candidate.label}`);
        }
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }

    if (!res) {
      throw new Error(
        `Failed to stream "${filename}" from Archive.org (${lastError?.message ?? "Network error"}). ` +
          `Attempted: ${candidates.map((c) => c.label).join(", ")}.`
      );
    }

    onProgress?.({
      stage: "downloading",
      message: `Reading stream into memory...`
    });

    const buf = await res.arrayBuffer();
    const rawBytes = new Uint8Array(buf);

    if (ZipParser.isZip(rawBytes) || /\.zip$/i.test(filename)) {
      onProgress?.({
        stage: "extracting",
        message: `Extracting retro media from ZIP in RAM...`
      });

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

      onProgress?.({
        stage: "ready",
        message: `Mounted ${retroEntry.filename} (${Math.round(extractedBytes.length / 1024)} KB)`
      });

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

    onProgress?.({
      stage: "ready",
      message: `Mounted ${filename} (${Math.round(rawBytes.length / 1024)} KB)`
    });

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
