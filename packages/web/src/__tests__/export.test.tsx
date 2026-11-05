import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { freewareEntryToProfile, freewareEntryToRights, matrixRecordToRights, unknownRightsRecord, buildExport, type FreewareEntry } from "@rgme/core";
import { ExportPanel } from "../components/ExportPanel";
import { downloadExport } from "../lib/export/export";

const entries = JSON.parse(readFileSync(resolve(process.cwd(), "../../concept/fixtures/freeware-games.json"), "utf8")) as FreewareEntry[];
const scene = entries.find((e) => e.id === "rgme-scene-intro")!;
const adf = new Uint8Array(readFileSync(resolve(process.cwd(), "../../concept/fixtures/rgme-scene-intro.adf")));

describe("ExportPanel", () => {
  it("cleared title: exports a single-file player with the disk embedded", async () => {
    const download = vi.fn();
    const getMedia = vi.fn(async () => adf);
    render(<ExportPanel profile={freewareEntryToProfile(scene)} rights={freewareEntryToRights(scene).record} getMedia={getMedia} download={download} />);
    expect(screen.getByTestId("export-mode")).toHaveTextContent("Portable player (cleared)");
    fireEvent.click(screen.getByTestId("export-run"));
    await waitFor(() => expect(download).toHaveBeenCalledTimes(1), { timeout: 5000 });
    expect(download.mock.calls[0]![0]).toBe("rgme-scene-intro.html");
    expect(String(download.mock.calls[0]![2])).toContain(Buffer.from(adf).toString("base64").slice(0, 200));
  });

  it("restricted title: BYOG package, media is never requested", async () => {
    const download = vi.fn();
    const getMedia = vi.fn(async () => adf);
    const profile = freewareEntryToProfile({ ...scene, id: "lemmings", canonical_title: "Lemmings", filename: "l.adf", sha256: "a".repeat(64) });
    const rights = matrixRecordToRights({ canonical_key: "lemmings", canonical_title: "Lemmings", rights_class: "D", opportunity: "RED", actions: { binary_redistribution: "deny_without_license", browser_hosting: "deny_without_license" } }).record;
    render(<ExportPanel profile={profile} rights={rights} getMedia={getMedia} download={download} />);
    expect(screen.getByTestId("export-mode")).toHaveTextContent("BYOG package (no game data)");
    fireEvent.click(screen.getByTestId("export-run"));
    await waitFor(() => expect(download).toHaveBeenCalledTimes(2), { timeout: 5000 });
    expect(getMedia).not.toHaveBeenCalled();
    expect(download.mock.calls.map((c) => c[0])).toEqual(["lemmings-byog-player.html", "lemmings.byog.json"]);
    for (const c of download.mock.calls) expect(String(c[2])).not.toContain(Buffer.from(adf).toString("base64").slice(0, 200));
  });

  it("unknown rights never export a player; missing disk reports a clear error for cleared titles", async () => {
    const { rerender } = render(<ExportPanel profile={freewareEntryToProfile(scene)} rights={unknownRightsRecord("x")} getMedia={async () => adf} download={() => {}} />);
    expect(screen.getByTestId("export-mode")).toHaveTextContent("BYOG");
    rerender(<ExportPanel profile={freewareEntryToProfile(scene)} rights={freewareEntryToRights(scene).record} getMedia={async () => undefined} download={() => {}} />);
    fireEvent.click(screen.getByTestId("export-run"));
    await waitFor(() => expect(screen.getByTestId("export-msg")).toHaveTextContent(/not available/));
  });

  it("downloadExport bundles byog support files without game data", async () => {
    const profile = freewareEntryToProfile({ ...scene, id: "x", sha256: "b".repeat(64) });
    const r = await buildExport({ profile, rights: unknownRightsRecord("x") });
    const calls: string[][] = [];
    downloadExport(r, (n, _m, d) => calls.push([n, String(d)]));
    const bundle = JSON.parse(calls[1]![1]!);
    expect(bundle.files.map((f: { path: string }) => f.path)).toContain("x.byog/README.txt");
  });
});
