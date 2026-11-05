import { useEffect, useMemo, useState } from "react";
import { filterLibrary, isCleared, type GameLibraryStore, type LibraryRecord } from "../lib/library";
import {
  FREEWARE_CLASSICS,
  type FreewareClassic,
  ArchiveSourceStore,
  ArchiveBookmarkStore,
  ArchiveOrgConnector,
  parseArchiveFilesToCatalog,
  filterCatalog,
  type RetroGameMetadata,
  type RetroGameVersion,
  type BookmarkedGame,
  type HistoryItem
} from "@rgme/core";
import { GameCard } from "./GameCard";
import { SourceManagerModal } from "./SourceManagerModal";

type Group = "all" | "cleared" | "local-only";
type LibraryTab = "my-library" | "recent" | "discover";

export interface LibraryShelfProps {
  store: GameLibraryStore;
  onMount: (record: LibraryRecord) => void;
  onLaunchClassic?: (classic: FreewareClassic) => void;
  onStreamGame?: (game: RetroGameMetadata, version: RetroGameVersion) => Promise<void>;
  refreshKey?: number;
  sourceStore?: ArchiveSourceStore;
  bookmarkStore?: ArchiveBookmarkStore;
  connector?: ArchiveOrgConnector;
}

const defaultSourceStore = new ArchiveSourceStore();
const defaultBookmarkStore = new ArchiveBookmarkStore();
const defaultConnector = new ArchiveOrgConnector();

export function LibraryShelf({
  store,
  onMount,
  onLaunchClassic,
  onStreamGame,
  refreshKey = 0,
  sourceStore = defaultSourceStore,
  bookmarkStore = defaultBookmarkStore,
  connector = defaultConnector
}: LibraryShelfProps) {
  const [activeTab, setActiveTab] = useState<LibraryTab>("my-library");
  const [records, setRecords] = useState<LibraryRecord[]>([]);
  const [bookmarks, setBookmarks] = useState<BookmarkedGame[]>(() => bookmarkStore.getBookmarks());
  const [history, setHistory] = useState<HistoryItem[]>(() => bookmarkStore.getHistory());
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<Group>("all");
  const [version, setVersion] = useState(0);

  // Discover tab states
  const [sources, setSources] = useState(() => sourceStore.getSources());
  const [selectedSourceId, setSelectedSourceId] = useState<string>(sources[0]?.id ?? "Amiga-Arquivista");
  const [catalogItems, setCatalogItems] = useState<RetroGameMetadata[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [genreFilter, setGenreFilter] = useState("all");
  const [discoverQuery, setDiscoverQuery] = useState("");
  const [streamingGameId, setStreamingGameId] = useState<string | null>(null);
  const [sourcesModalOpen, setSourcesModalOpen] = useState(false);

  useEffect(() => {
    let live = true;
    void store.list().then((r) => {
      if (live) {
        setRecords(r);
        setLoaded(true);
      }
    });
    setBookmarks(bookmarkStore.getBookmarks());
    setHistory(bookmarkStore.getHistory());
    setSources(sourceStore.getSources());
    return () => {
      live = false;
    };
  }, [store, refreshKey, version, bookmarkStore, sourceStore]);

  // Load catalog when switching source in Discover tab
  useEffect(() => {
    if (activeTab !== "discover" || !selectedSourceId) return;
    let live = true;
    setCatalogLoading(true);
    setCatalogError(null);

    const source = sourceStore.getSource(selectedSourceId);
    const sourceTitle = source?.title ?? selectedSourceId;

    void connector
      .fetchMetadata(selectedSourceId)
      .then((meta) => {
        if (!live) return;
        const parsed = parseArchiveFilesToCatalog(selectedSourceId, sourceTitle, meta.files);
        setCatalogItems(parsed);
        sourceStore.updateSource(selectedSourceId, { itemCount: meta.files.length });
        setSources(sourceStore.getSources());
      })
      .catch((err) => {
        if (!live) return;
        setCatalogError(err instanceof Error ? err.message : String(err));
        setCatalogItems([]);
      })
      .finally(() => {
        if (live) setCatalogLoading(false);
      });

    return () => {
      live = false;
    };
  }, [activeTab, selectedSourceId, connector, sourceStore]);

  const shownLocal = useMemo(() => filterLibrary(records, { query, rightsGroup: group }), [records, query, group]);

  const shownCatalog = useMemo(() => {
    return filterCatalog(catalogItems, {
      query: discoverQuery,
      genre: genreFilter
    });
  }, [catalogItems, discoverQuery, genreFilter]);

  const handleToggleBookmark = (game: RetroGameMetadata) => {
    bookmarkStore.toggleBookmark(game);
    setBookmarks(bookmarkStore.getBookmarks());
  };

  const handleStreamAndLaunch = async (game: RetroGameMetadata, ver: RetroGameVersion) => {
    if (!onStreamGame) return;
    setStreamingGameId(`${game.id}:${ver.filename}`);
    try {
      bookmarkStore.addHistory({
        title: game.canonicalTitle,
        sourceId: game.sourceId,
        filename: ver.filename,
        format: ver.format,
        diskLabel: ver.label
      });
      setHistory(bookmarkStore.getHistory());
      await onStreamGame(game, ver);
    } finally {
      setStreamingGameId(null);
    }
  };

  return (
    <section className="rgme-panel" aria-label="Game library" data-testid="library-shelf">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold">Retro Game Library</h2>
          <p className="text-xs text-[var(--rgme-fg-muted,#94a3b8)]">
            Explore curated classics, bookmarked cloud titles, and connected preservation sources
          </p>
        </div>

        <div className="flex items-center gap-1 bg-[#101116] p-1 rounded border border-slate-800">
          <button
            className={`px-3 py-1 text-xs rounded transition-colors ${
              activeTab === "my-library"
                ? "bg-sky-500/20 text-sky-300 border border-sky-500/50 font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
            onClick={() => setActiveTab("my-library")}
            data-testid="tab-my-library"
          >
            ★ My Library ({records.length + bookmarks.length})
          </button>
          <button
            className={`px-3 py-1 text-xs rounded transition-colors ${
              activeTab === "recent"
                ? "bg-sky-500/20 text-sky-300 border border-sky-500/50 font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
            onClick={() => setActiveTab("recent")}
            data-testid="tab-recent"
          >
            🕒 Recently Played ({history.length})
          </button>
          <button
            className={`px-3 py-1 text-xs rounded transition-colors ${
              activeTab === "discover"
                ? "bg-sky-500/20 text-sky-300 border border-sky-500/50 font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
            onClick={() => setActiveTab("discover")}
            data-testid="tab-discover"
          >
            🌐 Discover &amp; Sources
          </button>
        </div>
      </div>

      {/* TAB 1: MY LIBRARY */}
      {activeTab === "my-library" && (
        <div className="flex flex-col gap-4">
          {/* Freeware Classics Multi-Disk Showcase */}
          <div data-testid="freeware-classics-showcase">
            <h3 className="text-xs uppercase tracking-wider mb-2 font-semibold text-amber-400 flex items-center gap-1.5">
              <span>★</span>
              <span>Freeware Classics (Multi-Disk Showcase)</span>
            </h3>
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
              {FREEWARE_CLASSICS.map((classic) => (
                <div
                  key={classic.id}
                  className="rgme-panel p-3 rounded border border-slate-800 bg-[#0e1017] hover:border-slate-700 transition-colors"
                  data-testid={`classic-${classic.id}`}
                >
                  <div className="font-semibold text-sm text-slate-100">{classic.title}</div>
                  <div className="text-xs text-slate-400 mb-2">
                    {classic.developer} ({classic.year})
                  </div>
                  <div className="flex gap-1 mb-3 flex-wrap">
                    <span className="rgme-badge" data-tone="cleared">
                      Class C: Authorized
                    </span>
                    <span className="rgme-badge text-sky-400 border-sky-600/40">{classic.totalDisks} Disks</span>
                  </div>
                  <button
                    className="rgme-btn w-full text-xs py-1.5 font-medium"
                    data-testid={`launch-${classic.id}`}
                    onClick={() => onLaunchClassic?.(classic)}
                    style={{ fontSize: "11px", padding: "4px 8px" }}
                  >
                    1-Click Mount &amp; Load
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Bookmarked Cloud Games Section */}
          {bookmarks.length > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-wider mb-2 font-semibold text-sky-400 flex items-center gap-1.5">
                <span>★</span>
                <span>Saved Cloud Games ({bookmarks.length})</span>
              </h3>
              <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
                {bookmarks.map((b) => {
                  const meta: RetroGameMetadata = {
                    id: b.id,
                    canonicalTitle: b.canonicalTitle,
                    genre: b.genre,
                    year: b.year,
                    studio: b.studio,
                    platform: "amiga",
                    versions: b.versions || [{ filename: b.filename, label: b.filename, format: b.format as any, sourceId: b.sourceId }],
                    defaultVersion: b.versions?.[0] || { filename: b.filename, label: b.filename, format: b.format as any, sourceId: b.sourceId },
                    sourceId: b.sourceId,
                    sourceTitle: b.sourceTitle,
                    totalDisks: b.totalDisks
                  };
                  return (
                    <GameCard
                      key={b.id}
                      game={meta}
                      isBookmarked={true}
                      onToggleBookmark={handleToggleBookmark}
                      onStreamAndMount={(g, v) => void handleStreamAndLaunch(g, v)}
                      isStreaming={streamingGameId?.startsWith(b.id)}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Local Dropped Games Section */}
          <div>
            <h3 className="text-xs uppercase tracking-wider mb-2 font-semibold text-slate-400">
              Local Ingested Media ({records.length})
            </h3>
            <div className="flex gap-2 mb-3 flex-wrap">
              <input
                type="search"
                placeholder="Search title…"
                aria-label="Search library"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="rgme-input p-1.5 text-xs rounded bg-[#101116] border border-slate-700 text-white"
              />
              {(["all", "cleared", "local-only"] as const).map((g) => (
                <button
                  key={g}
                  className="rgme-btn text-xs px-2.5 py-1"
                  aria-pressed={group === g}
                  data-testid={`filter-${g}`}
                  onClick={() => setGroup(g)}
                >
                  {g === "all" ? "All" : g === "cleared" ? "Cleared (A/C)" : "Local-only (D/E)"}
                </button>
              ))}
            </div>

            {loaded && shownLocal.length === 0 && (
              <p className="text-sm text-slate-400" data-testid="library-empty">
                {records.length === 0
                  ? "Your local library is empty. Drop an .adf / .ipf to add it, or browse Discover & Sources."
                  : "No games match the filter."}
              </p>
            )}

            <ul className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", listStyle: "none", padding: 0 }}>
              {shownLocal.map((r) => (
                <li key={r.id} className="rgme-panel p-3 rounded border border-slate-800 bg-[#0e1017]" data-testid={`card-${r.id.slice(0, 8)}`}>
                  <div className="text-sm font-semibold text-slate-100">{r.title}</div>
                  <div className="flex gap-1 my-2 flex-wrap">
                    <span className="rgme-badge" data-tone="cleared">
                      {r.chipset}
                    </span>
                    <span className="rgme-badge" data-tone={isCleared(r) ? "cleared" : "local-only"} data-testid="class-badge">
                      Class {r.rightsClass}
                      {isCleared(r) ? "" : " · local only"}
                    </span>
                    {r.year !== undefined && <span className="rgme-badge">{r.year}</span>}
                  </div>
                  <div className="text-xs mb-2 text-slate-400">
                    {(r.size / 1024).toFixed(0)} KB · {r.filename}
                  </div>
                  <div className="flex gap-2">
                    <button className="rgme-btn flex-1 text-xs py-1" onClick={() => onMount(r)}>
                      Mount in DF0: & Play
                    </button>
                    <button
                      className="rgme-btn text-xs px-2 py-1 text-slate-400 hover:text-red-300"
                      aria-label={`Remove ${r.title}`}
                      onClick={() => void store.remove(r.id).then(() => setVersion((v) => v + 1))}
                    >
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* TAB 2: RECENTLY PLAYED */}
      {activeTab === "recent" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-400">Chronological history of launched games and streamed media</span>
            {history.length > 0 && (
              <button
                className="rgme-btn text-xs text-slate-400 hover:text-red-300 px-2 py-0.5"
                onClick={() => {
                  bookmarkStore.clearHistory();
                  setHistory([]);
                }}
              >
                Clear History
              </button>
            )}
          </div>

          {history.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400 border border-dashed border-slate-800 rounded">
              No recently played games. Launch a showcase demo or stream a title to see it here!
            </div>
          ) : (
            <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
              {history.map((item) => (
                <div
                  key={item.id}
                  className="rgme-panel p-3 rounded border border-slate-800 bg-[#13141c] flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate text-slate-100">{item.title}</div>
                    <div className="text-xs text-slate-400 truncate">
                      {item.diskLabel ?? item.filename} • <span className="text-slate-500">{new Date(item.playedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <button
                    className="rgme-btn text-xs whitespace-nowrap px-2.5 py-1"
                    onClick={() => {
                      // Trigger re-mount
                      const syntheticGame: RetroGameMetadata = {
                        id: `${item.sourceId}:${item.title.toLowerCase()}`,
                        canonicalTitle: item.title,
                        genre: "Classic Retro",
                        platform: "amiga",
                        versions: [{ filename: item.filename, label: item.diskLabel ?? item.filename, format: item.format as any, sourceId: item.sourceId }],
                        defaultVersion: { filename: item.filename, label: item.diskLabel ?? item.filename, format: item.format as any, sourceId: item.sourceId },
                        sourceId: item.sourceId,
                        sourceTitle: item.sourceId
                      };
                      void handleStreamAndLaunch(syntheticGame, syntheticGame.defaultVersion);
                    }}
                    disabled={streamingGameId !== null}
                  >
                    Re-Mount
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: DISCOVER & SOURCES */}
      {activeTab === "discover" && (
        <div className="flex flex-col gap-4">
          {/* Controls Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded border border-slate-800 bg-[#101116]">
            {/* Source selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 whitespace-nowrap font-medium">Source:</span>
              <select
                className="rgme-input text-xs p-1.5 rounded bg-[#161822] border border-slate-700 text-white min-w-[200px]"
                value={selectedSourceId}
                onChange={(e) => setSelectedSourceId(e.target.value)}
              >
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} ({s.itemCount ?? "?"})
                  </option>
                ))}
              </select>
              <button
                className="rgme-btn text-xs px-2.5 py-1"
                onClick={() => setSourcesModalOpen(true)}
                title="Add or remove connected collections"
              >
                ⚙️ Sources
              </button>
            </div>

            {/* Filter controls */}
            <div className="flex items-center gap-2 flex-wrap flex-1 md:justify-end">
              <input
                type="text"
                placeholder="Search games, studios..."
                className="rgme-input text-xs p-1.5 rounded bg-[#161822] border border-slate-700 text-white w-44"
                value={discoverQuery}
                onChange={(e) => setDiscoverQuery(e.target.value)}
              />
              <select
                className="rgme-input text-xs p-1.5 rounded bg-[#161822] border border-slate-700 text-white"
                value={genreFilter}
                onChange={(e) => setGenreFilter(e.target.value)}
              >
                <option value="all">All Genres</option>
                <option value="Point & Click Adventure">Adventure</option>
                <option value="Cinematic Action">Action</option>
                <option value="Shoot 'Em Up">Shoot 'Em Up</option>
                <option value="Platformer">Platformer</option>
                <option value="Strategy & Simulation">Strategy</option>
                <option value="RPG & Dungeon Crawler">RPG</option>
                <option value="Racing & Sports">Sports / Racing</option>
                <option value="Puzzle & Arcade">Puzzle / Arcade</option>
                <option value="Demoscene & Music">Demoscene</option>
              </select>
            </div>
          </div>

          {/* Catalog State */}
          {catalogLoading && (
            <div className="p-8 text-center text-sm text-sky-400 flex items-center justify-center gap-2">
              <span className="animate-spin">⏳</span>
              <span>Scanning Archive.org collection and grouping titles...</span>
            </div>
          )}

          {catalogError && (
            <div className="text-xs p-3 rounded bg-red-950/50 border border-red-700 text-red-200">
              ⚠️ {catalogError}
            </div>
          )}

          {!catalogLoading && !catalogError && shownCatalog.length === 0 && (
            <div className="p-8 text-center text-sm text-slate-400 border border-dashed border-slate-800 rounded">
              No games match your current filter in this collection.
            </div>
          )}

          {/* Catalog Cards Grid */}
          {!catalogLoading && shownCatalog.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400 font-mono">
                  Displaying {shownCatalog.length} retro titles in <strong>{selectedSourceId}</strong>
                </span>
              </div>
              <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
                {shownCatalog.map((game) => (
                  <GameCard
                    key={game.id}
                    game={game}
                    isBookmarked={bookmarkStore.isBookmarked(game.id)}
                    onToggleBookmark={handleToggleBookmark}
                    onStreamAndMount={(g, v) => void handleStreamAndLaunch(g, v)}
                    isStreaming={streamingGameId?.startsWith(game.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sources Manager Dialog */}
      <SourceManagerModal
        open={sourcesModalOpen}
        onClose={() => setSourcesModalOpen(false)}
        sourceStore={sourceStore}
        connector={connector}
        onSourcesChanged={() => {
          setSources(sourceStore.getSources());
        }}
      />
    </section>
  );
}
