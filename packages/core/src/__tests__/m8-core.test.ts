import { describe, it, expect, beforeEach } from "vitest";
import {
  ArchiveSourceStore,
  DEFAULT_ARCHIVE_SOURCES,
  extractCanonicalTitle,
  extractGenre,
  extractYear,
  extractStudio,
  parseArchiveFilesToCatalog,
  filterCatalog,
  ArchiveBookmarkStore,
  type RetroGameMetadata
} from "../index.js";

describe("Milestone 8 Core: Source Store, Metadata Parser & Bookmark Engine", () => {
  beforeEach(() => {
    if (typeof localStorage !== "undefined") {
      localStorage.clear();
    }
  });

  describe("M8-SOURCES-001: ArchiveSourceStore", () => {
    it("initializes with default Archive.org preservation sources", () => {
      const store = new ArchiveSourceStore();
      const sources = store.getSources();
      expect(sources.length).toBeGreaterThanOrEqual(DEFAULT_ARCHIVE_SOURCES.length);
      expect(sources.map((s) => s.id)).toContain("Amiga-Arquivista");
      expect(sources.map((s) => s.id)).toContain("Amiga_WHD_Games");
    });

    it("adds a custom Archive.org source, cleans identifier, and updates/removes it", () => {
      const store = new ArchiveSourceStore();
      const added = store.addSource({
        id: "https://archive.org/details/custom-amiga-collection",
        title: "Custom Amiga Collection",
        description: "User submitted collection",
        url: "https://archive.org/details/custom-amiga-collection"
      });

      expect(added.id).toBe("custom-amiga-collection");
      expect(store.getSource("custom-amiga-collection")).toBeDefined();

      // Update
      store.updateSource("custom-amiga-collection", { itemCount: 42 });
      expect(store.getSource("custom-amiga-collection")?.itemCount).toBe(42);

      // Remove
      expect(store.removeSource("custom-amiga-collection")).toBe(true);
      expect(store.getSource("custom-amiga-collection")).toBeUndefined();
    });
  });

  describe("M8-DISCOVERY-001: Metadata Parser & Grouping Engine", () => {
    it("extracts canonical title, year, studio and genre accurately", () => {
      const filename = "Monkey Island 2 - LeChuck's Revenge (LucasArts) (1991) (Disk 1 of 11) (EU).adf";
      const canonical = extractCanonicalTitle(filename);
      expect(canonical).toContain("Monkey Island 2 - LeChuck's Revenge");
      expect(extractYear(filename)).toBe(1991);
      expect(extractStudio(filename)).toBe("LucasArts");
      expect(extractGenre(filename)).toBe("Point & Click Adventure");
    });

    it("groups multi-disk files into a single game metadata entity with multiple versions", () => {
      const files = [
        { name: "Oil Imperium (EU).zip", size: 1065000 },
        { name: "Oil Imperium (GE).zip", size: 1062000 },
        { name: "Turrican II (1991) (Disk 1 of 2).adf", size: 901120 },
        { name: "Turrican II (1991) (Disk 2 of 2).adf", size: 901120 }
      ];

      const catalog = parseArchiveFilesToCatalog("Amiga-Arquivista", "Amiga Arquivista", files);
      expect(catalog.length).toBe(2);

      const oil = catalog.find((g) => g.canonicalTitle.includes("Oil Imperium"));
      expect(oil).toBeDefined();
      expect(oil?.versions.length).toBe(2);
      expect(oil?.versions.map((v) => v.filename)).toContain("Oil Imperium (EU).zip");
      expect(oil?.versions.map((v) => v.filename)).toContain("Oil Imperium (GE).zip");

      const turrican = catalog.find((g) => g.canonicalTitle.includes("Turrican II"));
      expect(turrican).toBeDefined();
      expect(turrican?.totalDisks).toBe(2);
      expect(turrican?.versions.length).toBe(2);
      expect(turrican?.genre).toBe("Shoot 'Em Up");
      expect(turrican?.year).toBe(1991);
    });

    it("filterCatalog correctly matches by query, genre, studio and source", () => {
      const items: RetroGameMetadata[] = [
        {
          id: "s1:fotaq",
          canonicalTitle: "Flight of the Amazon Queen",
          genre: "Point & Click Adventure",
          year: 1995,
          studio: "Revolution Software",
          platform: "amiga",
          versions: [{ filename: "fotaq.adf", label: "Disk 1", format: "adf", sourceId: "s1" }],
          defaultVersion: { filename: "fotaq.adf", label: "Disk 1", format: "adf", sourceId: "s1" },
          sourceId: "s1",
          sourceTitle: "Source 1"
        },
        {
          id: "s1:turrican",
          canonicalTitle: "Turrican",
          genre: "Shoot 'Em Up",
          year: 1990,
          studio: "Rainbow Arts",
          platform: "amiga",
          versions: [{ filename: "turrican.adf", label: "Disk 1", format: "adf", sourceId: "s1" }],
          defaultVersion: { filename: "turrican.adf", label: "Disk 1", format: "adf", sourceId: "s1" },
          sourceId: "s1",
          sourceTitle: "Source 1"
        }
      ];

      expect(filterCatalog(items, { query: "amazon" })).toHaveLength(1);
      expect(filterCatalog(items, { genre: "Shoot 'Em Up" })).toHaveLength(1);
      expect(filterCatalog(items, { year: 1995 })).toHaveLength(1);
      expect(filterCatalog(items, { studio: "Rainbow Arts" })).toHaveLength(1);
      expect(filterCatalog(items, { genre: "Strategy & Simulation" })).toHaveLength(0);
    });
  });

  describe("M8-CARDS-001 / M8-LIBRARY-001: Bookmark and History Store", () => {
    it("toggles bookmarks and retrieves them", () => {
      const store = new ArchiveBookmarkStore();
      const mockGame: RetroGameMetadata = {
        id: "source:speedball2",
        canonicalTitle: "Speedball 2: Brutal Deluxe",
        genre: "Racing & Sports",
        year: 1990,
        studio: "Bitmap Brothers",
        platform: "amiga",
        versions: [{ filename: "speedball2.adf", label: "Disk 1", format: "adf", sourceId: "source" }],
        defaultVersion: { filename: "speedball2.adf", label: "Disk 1", format: "adf", sourceId: "source" },
        sourceId: "source",
        sourceTitle: "Source Collection"
      };

      expect(store.isBookmarked("source:speedball2")).toBe(false);
      const added = store.toggleBookmark(mockGame);
      expect(added).toBe(true);
      expect(store.isBookmarked("source:speedball2")).toBe(true);
      expect(store.getBookmarks()).toHaveLength(1);

      // Toggle off
      const removed = store.toggleBookmark(mockGame);
      expect(removed).toBe(false);
      expect(store.isBookmarked("source:speedball2")).toBe(false);
    });

    it("records played history items and limits to recent entries", () => {
      const store = new ArchiveBookmarkStore();
      store.addHistory({
        title: "Speedball 2",
        sourceId: "Amiga-Arquivista",
        filename: "speedball2.adf",
        format: "adf"
      });
      store.addHistory({
        title: "Turrican II",
        sourceId: "Amiga-Arquivista",
        filename: "turrican2.adf",
        format: "adf"
      });

      const history = store.getHistory();
      expect(history.length).toBe(2);
      expect(history[0]?.title).toBe("Turrican II");
      expect(history[1]?.title).toBe("Speedball 2");
    });
  });
});
