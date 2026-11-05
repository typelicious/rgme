import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { parse } from "yaml";
import {
  GameProfileSchema,
  MasterMatrixIndex,
  buildExport,
  findFreewareByHash,
  freewareEntryToRights,
  matrixRecordToRights,
  evaluateExportGate,
  unknownRightsRecord,
  type ExportResult,
  type FreewareEntry,
  type GameProfile,
  type MatrixFile,
  type RightsRecord
} from "@rgme/core";
import freewareData from "./data/freeware-games.json" with { type: "json" };
import matrixSubset from "./data/matrix-subset.json" with { type: "json" };

export interface ExportOptions {
  media?: string;
  out?: string;
  /** Freeware-registry entry id, or path to a freeware-games.json-format file. The entry must match the profile's media hash. */
  rights?: string;
}

export async function loadProfile(path: string): Promise<GameProfile> {
  return GameProfileSchema.parse(parse(await readFile(path, "utf8")));
}

/** Rights are resolved by exact hash first; a title match against the master matrix can only restrict, never clear. */
export async function resolveRightsForProfile(profile: GameProfile, rightsOpt?: string): Promise<{ rights: RightsRecord; source: string }> {
  const boot = profile.media.find((m) => m.id === profile.launch.bootMediaId) ?? profile.media[0]!;
  let entries = freewareData as unknown as FreewareEntry[];
  if (rightsOpt && existsSync(rightsOpt)) entries = JSON.parse(await readFile(rightsOpt, "utf8")) as FreewareEntry[];
  const known = findFreewareByHash(entries, boot.sha256);
  if (rightsOpt && !existsSync(rightsOpt)) {
    const byId = entries.find((e) => e.id === rightsOpt);
    if (!byId) throw new Error(`Unknown rights entry "${rightsOpt}"`);
    if (known?.id !== byId.id) throw new Error(`Rights entry "${rightsOpt}" does not match the media hash of this profile`);
  }
  if (known) return { rights: freewareEntryToRights(known).record, source: `hash match: ${known.canonical_title}` };
  const rec = new MasterMatrixIndex(matrixSubset as MatrixFile).match(profile.title) ?? new MasterMatrixIndex(matrixSubset as MatrixFile).match(boot.filename);
  if (rec) return { rights: matrixRecordToRights(rec).record, source: `master matrix title match: ${rec.canonical_title}` };
  return { rights: unknownRightsRecord(profile.id), source: "no rights evidence (unknown)" };
}

export interface ExportRun {
  result: ExportResult;
  source: string;
  written: string[];
}

export async function runExport(profilePath: string, opts: ExportOptions = {}): Promise<ExportRun> {
  const profile = await loadProfile(profilePath);
  const { rights, source } = await resolveRightsForProfile(profile, opts.rights);
  const gate = evaluateExportGate(rights);
  const boot = profile.media.find((m) => m.id === profile.launch.bootMediaId) ?? profile.media[0]!;

  let media: Uint8Array | undefined;
  if (gate.mode === "player") {
    const candidates = [opts.media, join(dirname(resolve(profilePath)), boot.filename), join(process.cwd(), boot.filename)].filter(Boolean) as string[];
    const found = candidates.find((c) => existsSync(c));
    if (!found) throw new Error(`Media "${boot.filename}" not found (use --media <file>)`);
    media = new Uint8Array(await readFile(found)); // read-only
  }
  const result = await buildExport({ profile, rights, media });
  const out = resolve(opts.out ?? "./export");
  const written: string[] = [];
  for (const f of result.files) {
    const target = join(out, f.path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, f.data);
    written.push(target);
  }
  return { result, source, written };
}

export function describeExport(run: ExportRun): string {
  const label = run.result.mode === "player" ? "Portable player (cleared)" : "BYOG package (no game data)";
  return [`Mode   : ${label}`, `Rights : ${run.source}`, `Reason : ${run.result.reason}`, ...run.written.map((w) => `Wrote  : ${w}`)].join("\n");
}
