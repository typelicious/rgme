import { buildExport, evaluateExportGate, type ExportFile, type ExportResult, type GameProfile, type RightsRecord } from "@rgme/core";

export type DownloadFn = (filename: string, mime: string, data: Uint8Array | string) => void;

/** Default browser download via a temporary anchor. */
export const anchorDownload: DownloadFn = (filename, mime, data) => {
  const blob = new Blob([data as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const text = (f: ExportFile) => (typeof f.data === "string" ? f.data : new TextDecoder().decode(f.data));

/** Player mode: one .html. BYOG: the player .html plus one `.byog.json` bundle holding the remaining files (no game data). */
export function downloadExport(result: ExportResult, download: DownloadFn = anchorDownload): string[] {
  const names: string[] = [];
  if (result.mode === "player") {
    const f = result.files[0]!;
    download(f.path, f.mime, f.data);
    return [f.path];
  }
  const player = result.files.find((f) => f.path.endsWith("-byog-player.html"))!;
  const others = result.files.filter((f) => f !== player);
  const playerName = player.path.split("/").pop()!;
  download(playerName, player.mime, player.data);
  names.push(playerName);
  const bundleName = `${result.slug}.byog.json`;
  download(bundleName, "application/json", JSON.stringify({ schema: "rgme.byog-bundle/v0.1", files: others.map((f) => ({ path: f.path, mime: f.mime, text: text(f) })) }, null, 2));
  names.push(bundleName);
  return names;
}

/** Gate first; media bytes are only requested (and embedded) when the rights allow a cleared player. */
export async function exportFromBrowser(
  profile: GameProfile,
  rights: RightsRecord,
  getMedia: () => Promise<Uint8Array | undefined>,
  download?: DownloadFn
): Promise<{ result: ExportResult; files: string[] }> {
  const gate = evaluateExportGate(rights);
  const media = gate.mode === "player" ? await getMedia() : undefined;
  if (gate.mode === "player" && !media) throw new Error("The original disk is not available in this session. Drop or mount it first.");
  const result = await buildExport({ profile, rights, media });
  return { result, files: downloadExport(result, download) };
}
