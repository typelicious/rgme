import { useCallback, useEffect, useState } from "react";
import type { RuntimeAdapter } from "@rgme/core";
import type { SaveStateManager } from "../lib/save/manager";
import type { SaveRecord } from "../lib/save/types";

export interface SaveDrawerProps {
  manager: SaveStateManager;
  adapter: RuntimeAdapter | undefined;
  getCanvas: () => { toDataURL?(type?: string): string } | null;
  title: string;
  sha256: string;
  open: boolean;
  onClose: () => void;
}

export function SaveDrawer({ manager, adapter, getCanvas, title, sha256, open, onClose }: SaveDrawerProps) {
  const [slots, setSlots] = useState<Array<SaveRecord | null>>(Array(10).fill(null));
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => setSlots(await manager.list()), [manager]);
  useEffect(() => {
    if (open) void refresh().catch((e) => setMessage(String(e.message ?? e)));
  }, [open, refresh]);

  if (!open) return null;

  const run = (label: string, fn: () => Promise<unknown>) => async () => {
    try {
      await fn();
      setMessage(label);
      await refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    }
  };

  const download = async (slot: number) => {
    const bytes = await manager.exportSlot(slot);
    const url = URL.createObjectURL(new Blob([bytes as unknown as BlobPart], { type: "application/octet-stream" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/\W+/g, "-")}-slot${slot}.rgmesave`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importInto = async (file: File, slot: number) => {
    const buf = new Uint8Array(await file.arrayBuffer());
    await manager.importSave(buf, slot);
  };

  return (
    <aside className="rgme-panel" data-testid="save-drawer" aria-label="Save states">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-lg">Save states</h2>
        <button className="rgme-btn" onClick={onClose}>Close</button>
      </div>
      <div className="grid gap-2 grid-cols-2">
        {slots.map((rec, i) => {
          const slot = i + 1;
          return (
            <div key={slot} className="rgme-panel" data-testid={`slot-${slot}`} data-empty={!rec}>
              <div className="text-sm">Slot {slot}</div>
              {rec ? (
                <>
                  {rec.thumbnail ? <img src={rec.thumbnail} alt={`Slot ${slot} preview`} style={{ width: "100%", imageRendering: "pixelated" }} /> : <div className="text-xs" style={{ color: "var(--rgme-fg-muted)" }}>No preview</div>}
                  <span className="text-xs" data-testid={`slot-${slot}-time`}>{new Date(rec.savedAt).toLocaleString()}</span>
                </>
              ) : (
                <div className="text-xs" style={{ color: "var(--rgme-fg-muted)" }}>Empty</div>
              )}
              <div className="flex flex-wrap gap-1 mt-1">
                <button className="rgme-btn" disabled={!adapter} onClick={run(`Saved to slot ${slot}`, () => manager.save(slot, { adapter: adapter!, canvas: getCanvas(), title, sha256 }))}>Save</button>
                <button className="rgme-btn" disabled={!adapter || !rec} onClick={run(`Restored slot ${slot}`, () => manager.load(slot, adapter!, { sha256 }))}>Restore</button>
                <button className="rgme-btn" disabled={!rec} onClick={run(`Deleted slot ${slot}`, () => manager.delete(slot))}>Delete</button>
                <button className="rgme-btn" disabled={!rec} onClick={run(`Exported slot ${slot}`, () => download(slot))}>Export</button>
                <label className="rgme-btn" style={{ cursor: "pointer" }}>
                  Import
                  <input
                    type="file"
                    accept=".rgmesave"
                    hidden
                    data-testid={`import-${slot}`}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (f) void run(`Imported into slot ${slot}`, () => importInto(f, slot))();
                    }}
                  />
                </label>
              </div>
            </div>
          );
        })}
      </div>
      <p role="status" className="text-sm mt-2" data-testid="save-message">{message}</p>
    </aside>
  );
}
