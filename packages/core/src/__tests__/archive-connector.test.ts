import { describe, it, expect, vi } from "vitest";
import { ArchiveOrgConnector, ARCHIVE_COLLECTION_PRESETS } from "../archive/archive-connector.js";

describe("Milestone 7: ArchiveOrgConnector", () => {
  it("provides preset collections", () => {
    expect(ARCHIVE_COLLECTION_PRESETS.length).toBeGreaterThanOrEqual(2);
    expect(ARCHIVE_COLLECTION_PRESETS.map((p) => p.id)).toContain("Amiga-Arquivista");
  });

  it("fetchMetadata extracts retro disk files from Archive.org metadata API", async () => {
    const mockFiles = [
      { name: "game_disk1.adf", size: 901120, format: "Amiga Disk File" },
      { name: "readme.txt", size: 1024, format: "Text" },
      { name: "manual.pdf", size: 50000, format: "PDF" },
      { name: "bonus_pack.zip", size: 1500000, format: "ZIP" }
    ];

    const mockFetch = vi.fn(async (url: string | URL | Request) => {
      const urlStr = String(url);
      expect(urlStr).toContain("https://archive.org/metadata/Amiga-Arquivista");
      return new Response(JSON.stringify({
        metadata: { title: "Amiga Arquivista", description: "Preservation items" },
        files: mockFiles
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    });

    const connector = new ArchiveOrgConnector({ fetchFn: mockFetch as unknown as typeof fetch });
    const meta = await connector.fetchMetadata("https://archive.org/details/Amiga-Arquivista");

    expect(meta.identifier).toBe("Amiga-Arquivista");
    expect(meta.title).toBe("Amiga Arquivista");
    // Only retro media files (.adf, .zip) should be retained
    expect(meta.files.map((f) => f.name)).toEqual(["game_disk1.adf", "bonus_pack.zip"]);
    expect(meta.files[0]?.size).toBe(901120);
  });

  it("streamFile downloads raw disk image into RAM and computes SHA-256", async () => {
    const fakeAdfBytes = new Uint8Array(1024);
    fakeAdfBytes.set([0x44, 0x4f, 0x53, 0]); // DOS\0

    const mockFetch = vi.fn(async (url: string | URL | Request) => {
      const urlStr = String(url);
      expect(urlStr).toContain("https://archive.org/download/Amiga-Arquivista/game.adf");
      return new Response(fakeAdfBytes, { status: 200 });
    });

    const connector = new ArchiveOrgConnector({ fetchFn: mockFetch as unknown as typeof fetch });
    const media = await connector.streamFile("Amiga-Arquivista", "game.adf");

    expect(media.identifier).toBe("Amiga-Arquivista");
    expect(media.diskFilename).toBe("game.adf");
    expect(media.format).toBe("adf");
    expect(media.bytes.length).toBe(1024);
    expect(media.sha256).toMatch(/^[0-9a-f]{64}$/);
  });
});
