import { useMemo, useState } from "react";
import { evaluateExportGate, type GameProfile, type RightsRecord } from "@rgme/core";
import { exportFromBrowser, type DownloadFn } from "../lib/export/export";

export interface ExportPanelProps {
  profile?: GameProfile;
  rights?: RightsRecord;
  /** Original disk bytes, if this session has them. Only requested when the rights gate allows a cleared player. */
  getMedia: () => Promise<Uint8Array | undefined>;
  /** Test hook; defaults to an anchor download. */
  download?: DownloadFn;
}

export function ExportPanel({ profile, rights, getMedia, download }: ExportPanelProps) {
  const gate = useMemo(() => (rights ? evaluateExportGate(rights) : undefined), [rights]);
  const [msg, setMsg] = useState<string>();
  const [busy, setBusy] = useState(false);
  const cleared = gate?.mode === "player";

  const run = async () => {
    if (!profile || !rights) return;
    setBusy(true);
    setMsg(undefined);
    try {
      const { files } = await exportFromBrowser(profile, rights, getMedia, download);
      setMsg(`Exported: ${files.join(", ")}`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rgme-panel" data-testid="export-panel">
      <h3 className="text-lg mb-2">Export</h3>
      {!gate || !profile ? (
        <p className="text-sm" style={{ color: "var(--rgme-fg-secondary)" }}>Load a game first.</p>
      ) : (
        <>
          <span className="rgme-badge" data-testid="export-mode" data-tone={cleared ? "cleared" : "local-only"}>
            {cleared ? "Portable player (cleared)" : "BYOG package (no game data)"}
          </span>
          <p className="text-sm mt-2" style={{ color: "var(--rgme-fg-secondary)" }} data-testid="export-gate-reason">{gate.reason}</p>
          <button className="rgme-btn mt-2" data-testid="export-run" disabled={busy} onClick={() => void run()}>
            {cleared ? "Export portable player" : "Export BYOG package"}
          </button>
        </>
      )}
      {msg && <p className="text-sm mt-2" role="status" data-testid="export-msg">{msg}</p>}
    </section>
  );
}
