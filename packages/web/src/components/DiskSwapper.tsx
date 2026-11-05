import type { DiskSwapper as Swapper, DiskSet } from "../lib/m3u";

export function DiskSwapper({
  swapper,
  discs,
  currentIndex,
  label,
  set,
  onChange
}: {
  swapper: Swapper;
  discs: ReadonlyArray<{ id: string; label: string }>;
  currentIndex: number;
  label?: string;
  /** Optional grouped set, used to show gap/duplicate warnings. */
  set?: Pick<DiskSet, "missing" | "duplicates">;
  /** Called after a swap so the parent can re-render. */
  onChange?: (index: number) => void;
}) {
  const go = (fn: () => void) => { fn(); onChange?.(swapper.currentIndex); };
  if (discs.length === 0) return null;
  return (
    <section className="rgme-panel" aria-label="Disk swapper" data-testid="disk-swapper">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm">{label ?? "Disks"}</h3>
        <span className="text-sm font-mono" data-testid="disk-position">Disk {currentIndex + 1} of {discs.length}</span>
      </div>
      <div className="flex flex-wrap gap-1 mt-2" role="group" aria-label="Quick disk select">
        <button className="rgme-btn" data-testid="disk-prev" onClick={() => go(() => swapper.prev())} aria-label="Previous disk (hotkey [)">◀</button>
        {discs.slice(0, 9).map((d, i) => (
          <button
            key={d.id}
            className="rgme-btn"
            data-testid={`disk-btn-${i + 1}`}
            aria-pressed={i === currentIndex}
            title={`${d.label} (key ${i + 1})`}
            onClick={() => go(() => swapper.insertNth(i + 1))}
          >
            {i + 1}
          </button>
        ))}
        <button className="rgme-btn" data-testid="disk-next" onClick={() => go(() => swapper.next())} aria-label="Next disk (hotkey ])">▶</button>
      </div>
      <select
        className="mt-2"
        aria-label="Select disk"
        data-testid="disk-select"
        value={currentIndex}
        onChange={(e) => go(() => swapper.insertNth(Number(e.target.value) + 1))}
      >
        {discs.map((d, i) => <option key={d.id} value={i}>{`${i + 1}. ${d.label}`}</option>)}
      </select>
      {set && set.missing.length > 0 && <p role="alert" className="text-sm mt-2" data-testid="disk-gaps" style={{ color: "var(--rgme-status-localonly-fg)" }}>Missing disk(s): {set.missing.join(", ")}</p>}
      {set && set.duplicates.length > 0 && <p className="text-sm mt-1" data-testid="disk-dupes" style={{ color: "var(--rgme-status-localonly-fg)" }}>Duplicate disk number(s): {set.duplicates.join(", ")}</p>}
    </section>
  );
}
