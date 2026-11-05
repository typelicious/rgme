import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { basename, join, extname } from "node:path";
import { stringify } from "yaml";
import {
  DEFAULT_DISPLAY_PROFILE,
  DEFAULT_INPUT_MAPPING,
  GameProfileSchema,
  findFreewareByHash,
  freewareEntryToProfile,
  freewareEntryToRights,
  type FreewareEntry,
  MasterMatrixIndex,
  RightsPolicyEngine,
  matrixRecordToRights,
  normalizeTitle,
  unknownRightsRecord,
  type GameProfile,
  type MatrixFile,
  type PolicyDecisionKind,
  type RightsRecord,
  type RightsStatus
} from "@rgme/core";
import matrixSubset from "./data/matrix-subset.json" with { type: "json" };
import freewareData from "./data/freeware-games.json" with { type: "json" };
import { FIXTURE_REGISTRY } from "./registry.js";

export interface ScanEntry {
  path: string;
  filename: string;
  sha256: string;
  title: string;
  identified: boolean;
  matchedBy: "hash" | "title" | "none";
  /** Set when the exact SHA-256 is in the freeware/public-domain registry. */
  freeware?: FreewareEntry;
  rightsClass: string;
  chipset: string;
  rightsStatus: RightsStatus;
  localPlay: PolicyDecisionKind;
  redistribution: PolicyDecisionKind;
  rights: RightsRecord;
}

export interface ScanOptions {
  registry?: Readonly<Record<string, string>>;
  matrix?: MatrixFile;
  freeware?: readonly FreewareEntry[];
}

/** Streaming SHA-256; the file is opened read-only and never modified. */
export function hashFile(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const h = createHash("sha256");
    createReadStream(path)
      .on("data", (c) => h.update(c))
      .on("error", reject)
      .on("end", () => resolve(h.digest("hex")));
  });
}

export async function findAdfFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await findAdfFiles(p)));
    else if (e.isFile() && extname(e.name).toLowerCase() === ".adf") out.push(p);
  }
  return out;
}

export async function scanDirectory(dir: string, opts: ScanOptions = {}): Promise<ScanEntry[]> {
  const registry = opts.registry ?? FIXTURE_REGISTRY;
  const index = new MasterMatrixIndex(opts.matrix ?? (matrixSubset as MatrixFile));
  const freewareEntries = opts.freeware ?? (freewareData as unknown as FreewareEntry[]);
  const engine = new RightsPolicyEngine();
  const results: ScanEntry[] = [];

  for (const path of await findAdfFiles(dir)) {
    const filename = basename(path);
    const sha256 = await hashFile(path);
    const freeware = findFreewareByHash(freewareEntries, sha256);
    const hashTitle = freeware?.canonical_title ?? registry[sha256];
    const record = freeware ? undefined : index.match(hashTitle ?? filename);
    const matchedBy: ScanEntry["matchedBy"] = freeware || hashTitle ? "hash" : record ? "title" : "none";

    let rights: RightsRecord;
    let title: string;
    if (freeware) {
      // Exact-hash identity with evidenced rights. Title matches alone never reach this branch.
      rights = freewareEntryToRights(freeware).record;
      title = freeware.canonical_title;
    } else if (record) {
      rights = matrixRecordToRights(record).record;
      title = record.canonical_title;
    } else {
      title = hashTitle ?? (normalizeTitle(filename) || filename);
      rights = unknownRightsRecord(title.replace(/\s+/g, "-"));
    }
    results.push({
      path,
      filename,
      sha256,
      title,
      identified: Boolean(record || freeware),
      freeware,
      rightsClass: rights.classification,
      matchedBy,
      chipset: freeware?.machine.chipset ?? "OCS",
      rightsStatus: rights.status,
      localPlay: engine.evaluateAction(rights, { action: "private_execution" }).decision,
      redistribution: engine.evaluateAction(rights, { action: "binary_redistribution" }).decision,
      rights
    });
  }
  return results;
}

export function slugify(title: string): string {
  return normalizeTitle(title).replace(/\s+/g, "-") || "untitled";
}

export function buildProfile(entry: ScanEntry): GameProfile {
  if (entry.freeware) return freewareEntryToProfile(entry.freeware);
  const slug = slugify(entry.title);
  return GameProfileSchema.parse({
    schema: "rgme.game/v0.2",
    id: slug,
    title: entry.title,
    platform: "amiga",
    machine: { model: "A500", chipset: "OCS", video: "PAL", ram: { chipKb: 512, fastKb: 512 } },
    media: [{ id: "df0", kind: "adf", filename: entry.filename, label: entry.title, sha256: entry.sha256 }],
    runtime: { preferredAdapter: "mock" },
    launch: { bootMediaId: "df0", autoStart: false },
    input: DEFAULT_INPUT_MAPPING,
    display: DEFAULT_DISPLAY_PROFILE,
    rights: { recordId: entry.rights.id }
  });
}

export async function writeProfiles(entries: ScanEntry[], outDir: string, includeUnknown = false): Promise<string[]> {
  await mkdir(outDir, { recursive: true });
  const written: string[] = [];
  for (const e of entries) {
    if (!e.identified && !includeUnknown) continue;
    const file = join(outDir, `${slugify(e.title)}.game-profile.yaml`);
    await writeFile(file, stringify(buildProfile(e)), "utf8");
    written.push(file);
  }
  return written;
}

const STATUS_LABEL: Record<PolicyDecisionKind, string> = {
  allow: "allowed",
  local_only: "local only",
  review: "review",
  deny: "denied"
};

export function formatTable(entries: ScanEntry[]): string {
  const rows = [
    ["Title", "Chipset", "Class", "Rights Status", "Local / Redistribution", "SHA-256"],
    ...entries.map((e) => [
      e.title,
      e.chipset,
      e.identified ? e.rightsClass : "-",
      e.rightsStatus,
      `${STATUS_LABEL[e.localPlay]} / ${STATUS_LABEL[e.redistribution]}`,
      e.sha256.slice(0, 12)
    ])
  ];
  const widths = rows[0]!.map((_, i) => Math.max(...rows.map((r) => r[i]!.length)));
  const line = (r: string[]) => r.map((c, i) => c.padEnd(widths[i]!)).join("  ").trimEnd();
  return [line(rows[0]!), widths.map((w) => "-".repeat(w)).join("  "), ...rows.slice(1).map(line)].join("\n");
}
