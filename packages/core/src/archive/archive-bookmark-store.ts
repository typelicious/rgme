import type { RetroGameMetadata, RetroGameVersion } from "./archive-metadata-parser.js";

export interface BookmarkedGame {
  id: string; // Unique ID, e.g. sourceId:canonicalTitle
  canonicalTitle: string;
  genre: string;
  year?: number;
  studio?: string;
  sourceId: string;
  sourceTitle: string;
  filename: string;
  format: string;
  bookmarkedAt: number;
  versions: RetroGameVersion[];
  totalDisks?: number;
}

export interface HistoryItem {
  id: string; // timestamp or unique key
  title: string;
  sourceId: string;
  filename: string;
  format: string;
  playedAt: number;
  diskLabel?: string;
}

const BOOKMARKS_STORAGE_KEY = "rgme:bookmarked-games:v1";
const HISTORY_STORAGE_KEY = "rgme:played-history:v1";

export class ArchiveBookmarkStore {
  private bookmarks: Map<string, BookmarkedGame> = new Map();
  private history: HistoryItem[] = [];

  constructor() {
    this.load();
  }

  private load(): void {
    if (typeof localStorage === "undefined") return;

    try {
      const bRaw = localStorage.getItem(BOOKMARKS_STORAGE_KEY);
      if (bRaw) {
        const parsed = JSON.parse(bRaw) as BookmarkedGame[];
        if (Array.isArray(parsed)) {
          for (const b of parsed) {
            if (b?.id && b?.canonicalTitle) {
              this.bookmarks.set(b.id, b);
            }
          }
        }
      }
    } catch {
      /* ignore */
    }

    try {
      const hRaw = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (hRaw) {
        const parsed = JSON.parse(hRaw) as HistoryItem[];
        if (Array.isArray(parsed)) {
          this.history = parsed;
        }
      }
    } catch {
      /* ignore */
    }
  }

  private saveBookmarks(): void {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(Array.from(this.bookmarks.values())));
    } catch {
      /* ignore */
    }
  }

  private saveHistory(): void {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(this.history.slice(0, 50)));
    } catch {
      /* ignore */
    }
  }

  getBookmarks(): BookmarkedGame[] {
    return Array.from(this.bookmarks.values()).sort((a, b) => b.bookmarkedAt - a.bookmarkedAt);
  }

  isBookmarked(id: string): boolean {
    return this.bookmarks.has(id);
  }

  toggleBookmark(item: RetroGameMetadata): boolean {
    if (this.bookmarks.has(item.id)) {
      this.bookmarks.delete(item.id);
      this.saveBookmarks();
      return false;
    } else {
      const b: BookmarkedGame = {
        id: item.id,
        canonicalTitle: item.canonicalTitle,
        genre: item.genre,
        year: item.year,
        studio: item.studio,
        sourceId: item.sourceId,
        sourceTitle: item.sourceTitle,
        filename: item.defaultVersion.filename,
        format: item.defaultVersion.format,
        bookmarkedAt: Date.now(),
        versions: item.versions,
        totalDisks: item.totalDisks
      };
      this.bookmarks.set(item.id, b);
      this.saveBookmarks();
      return true;
    }
  }

  removeBookmark(id: string): void {
    this.bookmarks.delete(id);
    this.saveBookmarks();
  }

  addHistory(entry: Omit<HistoryItem, "id" | "playedAt">): HistoryItem {
    const item: HistoryItem = {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      playedAt: Date.now()
    };

    // Remove duplicates of same title & source to keep history clean
    this.history = [item, ...this.history.filter((h) => h.title !== entry.title || h.sourceId !== entry.sourceId)].slice(
      0,
      30
    );
    this.saveHistory();
    return item;
  }

  getHistory(): HistoryItem[] {
    return [...this.history];
  }

  clearHistory(): void {
    this.history = [];
    this.saveHistory();
  }
}
