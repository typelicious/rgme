export interface ArchiveSource {
  id: string; // Archive.org identifier e.g. "Amiga-Arquivista"
  title: string;
  description: string;
  url: string;
  itemCount?: number;
  lastSyncedAt?: number;
  isDefault?: boolean;
}

export const DEFAULT_ARCHIVE_SOURCES: ArchiveSource[] = [
  {
    id: "Amiga-Arquivista",
    title: "Amiga Arquivista Collection",
    description: "Curated historical Amiga floppy disk preservation library (.adf / .zip)",
    url: "https://archive.org/details/Amiga-Arquivista",
    isDefault: true
  },
  {
    id: "Amiga_WHD_Games",
    title: "Amiga WHDLoad Games Preservation",
    description: "Curated collection of pre-installed WHDLoad Amiga game packages",
    url: "https://archive.org/details/Amiga_WHD_Games",
    isDefault: true
  },
  {
    id: "cdtv-amiga-preservation",
    title: "CDTV & CD32 Amiga Titles",
    description: "Commodore CDTV and Amiga CD32 interactive optical disc preservation library",
    url: "https://archive.org/details/cdtv-amiga-preservation",
    isDefault: false
  }
];

const STORAGE_KEY = "rgme:archive-sources:v1";

export class ArchiveSourceStore {
  private sources: Map<string, ArchiveSource> = new Map();

  constructor() {
    this.load();
  }

  private load(): void {
    this.sources.clear();
    // Pre-populate with defaults
    for (const src of DEFAULT_ARCHIVE_SOURCES) {
      this.sources.set(src.id, { ...src });
    }

    if (typeof localStorage !== "undefined") {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as ArchiveSource[];
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              if (item?.id && item?.title) {
                this.sources.set(item.id, item);
              }
            }
          }
        }
      } catch {
        /* ignore storage read error */
      }
    }
  }

  private save(): void {
    if (typeof localStorage !== "undefined") {
      try {
        const list = Array.from(this.sources.values());
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      } catch {
        /* ignore storage write error */
      }
    }
  }

  getSources(): ArchiveSource[] {
    return Array.from(this.sources.values());
  }

  getSource(id: string): ArchiveSource | undefined {
    return this.sources.get(id);
  }

  addSource(source: Omit<ArchiveSource, "isDefault">): ArchiveSource {
    const cleanId = source.id.trim().replace(/^https?:\/\/archive\.org\/(details|download)\//i, "").split("/")[0]!;
    if (!cleanId) throw new Error("Invalid Archive.org collection identifier");

    const newSource: ArchiveSource = {
      id: cleanId,
      title: source.title.trim() || cleanId,
      description: source.description?.trim() || `User added Archive.org collection (${cleanId})`,
      url: source.url?.trim() || `https://archive.org/details/${cleanId}`,
      itemCount: source.itemCount,
      lastSyncedAt: source.lastSyncedAt ?? Date.now(),
      isDefault: false
    };

    this.sources.set(cleanId, newSource);
    this.save();
    return newSource;
  }

  removeSource(id: string): boolean {
    const existing = this.sources.get(id);
    if (!existing) return false;
    this.sources.delete(id);
    this.save();
    return true;
  }

  updateSource(id: string, patch: Partial<ArchiveSource>): ArchiveSource | undefined {
    const existing = this.sources.get(id);
    if (!existing) return undefined;

    const updated: ArchiveSource = {
      ...existing,
      ...patch,
      id: existing.id // preserve ID
    };
    this.sources.set(id, updated);
    this.save();
    return updated;
  }
}
