import { useEffect, useMemo, useState } from "react";
import { filterLibrary, isCleared, type GameLibraryStore, type LibraryRecord } from "../lib/library";
import { FREEWARE_CLASSICS, type FreewareClassic } from "@rgme/core";

type Group = "all" | "cleared" | "local-only";

export function LibraryShelf({
  store,
  onMount,
  onLaunchClassic,
  refreshKey = 0
}: {
  store: GameLibraryStore;
  onMount: (record: LibraryRecord) => void;
  onLaunchClassic?: (classic: FreewareClassic) => void;
  refreshKey?: number;
}) {
  const [records, setRecords] = useState<LibraryRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<Group>("all");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let live = true;
    void store.list().then((r) => { if (live) { setRecords(r); setLoaded(true); } });
    return () => { live = false; };
  }, [store, refreshKey, version]);

  const shown = useMemo(() => filterLibrary(records, { query, rightsGroup: group }), [records, query, group]);

  return (
    <section className="rgme-panel" aria-label="Game library" data-testid="library-shelf">
      <h2 className="text-lg mb-2">Library</h2>

      <div className="mb-4" data-testid="freeware-classics-showcase">
        <h3 className="text-xs uppercase tracking-wider mb-2" style={{ color: "#ff8800", fontWeight: 600 }}>
          ★ Freeware Classics (Multi-Disk Showcase)
        </h3>
        <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
          {FREEWARE_CLASSICS.map((classic) => (
            <div
              key={classic.id}
              className="rgme-panel"
              style={{ padding: "10px", background: "#0b0f19", border: "1px solid var(--rgme-border-subtle)" }}
              data-testid={`classic-${classic.id}`}
            >
              <div className="font-semibold text-sm" style={{ color: "var(--rgme-fg-primary)" }}>{classic.title}</div>
              <div className="text-xs" style={{ color: "var(--rgme-fg-muted)" }}>{classic.developer} ({classic.year})</div>
              <div className="flex gap-1 my-2 flex-wrap">
                <span className="rgme-badge" data-tone="cleared">Class C: Authorized</span>
                <span className="rgme-badge" style={{ borderColor: "#3b82f6", color: "#38bdf8" }}>{classic.totalDisks} Disks</span>
              </div>
              <button
                className="rgme-btn w-full"
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

      <div className="flex gap-2 mb-3 flex-wrap">
        <input
          type="search" placeholder="Search title…" aria-label="Search library" value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ background: "var(--rgme-bg-surface-base)", color: "var(--rgme-fg-primary)", border: "1px solid var(--rgme-border-subtle)", borderRadius: 4, padding: "6px 8px" }}
        />
        {(["all", "cleared", "local-only"] as const).map((g) => (
          <button key={g} className="rgme-btn" aria-pressed={group === g} data-testid={`filter-${g}`} onClick={() => setGroup(g)}>
            {g === "all" ? "All" : g === "cleared" ? "Cleared (A/C)" : "Local-only (D/E)"}
          </button>
        ))}
      </div>
      {loaded && shown.length === 0 && (
        <p className="text-sm" style={{ color: "var(--rgme-fg-secondary)" }} data-testid="library-empty">
          {records.length === 0 ? "Your library is empty. Drop an .adf to add it." : "No games match the filter."}
        </p>
      )}
      <ul className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", listStyle: "none", padding: 0 }}>
        {shown.map((r) => (
          <li key={r.id} className="rgme-panel" data-testid={`card-${r.id.slice(0, 8)}`}>
            <div className="text-base">{r.title}</div>
            <div className="flex gap-1 my-2 flex-wrap">
              <span className="rgme-badge" data-tone="cleared" style={{ color: "var(--rgme-fg-secondary)", background: "transparent", borderColor: "var(--rgme-border-subtle)" }}>{r.chipset}</span>
              <span className="rgme-badge" data-tone={isCleared(r) ? "cleared" : "local-only"} data-testid="class-badge">
                Class {r.rightsClass}{isCleared(r) ? "" : " · local only"}
              </span>
              {r.year !== undefined && <span className="rgme-badge" style={{ borderColor: "var(--rgme-border-subtle)" }}>{r.year}</span>}
            </div>
            <div className="text-xs mb-2" style={{ color: "var(--rgme-fg-muted)" }}>{(r.size / 1024).toFixed(0)} KB · {r.filename}</div>
            <div className="flex gap-2">
              <button className="rgme-btn" onClick={() => onMount(r)}>Mount in DF0: &amp; Play</button>
              <button className="rgme-btn" aria-label={`Remove ${r.title}`} onClick={() => void store.remove(r.id).then(() => setVersion((v) => v + 1))}>Remove</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
