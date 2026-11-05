import { parseGameProfile, DEFAULT_DISPLAY_PROFILE, DEFAULT_INPUT_MAPPING, type GameProfile } from "./profile.js";
import type { AssertionStatus, EvidenceRecord, RightsAction, RightsAssertion, RightsRecord, RightsStatus } from "./rights.js";

/** Entry of concept/fixtures/freeware-games.json (hash-identified, rights-evidenced titles). */
export interface FreewareEntry {
  id: string;
  canonical_title: string;
  filename: string;
  sha256: string;
  /** Defaults to 'amiga'. */
  platform?: string;
  machine: { model: string; chipset: string; video: string; ram_chip_kb: number; ram_fast_kb: number };
  rights: {
    rights_class: string;
    status: string;
    opportunity: string;
    rightsholder: string;
    license: string;
    actions: Record<string, string>;
    provenance_note?: string;
  };
}

/** SHA-256 of zero bytes. A placeholder hash must never identify (and thereby authorize) anything. */
export const EMPTY_SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

/** Profiles whose runtime should render a dedicated scene instead of the generic test pattern. */
const SCENES: Record<string, string> = { "rgme-scene-intro": "intro" };

const ACTIONS: RightsAction[] = [
  "private_execution", "binary_redistribution", "browser_hosting", "reverse_engineering",
  "patch_distribution", "modification", "derivative_distribution", "commercial_use"
];

function mapAction(v: string | undefined): AssertionStatus {
  if (v === "allow") return "permitted";
  if (v?.startsWith("deny")) return "prohibited";
  if (v?.startsWith("review")) return "restricted";
  return "unknown";
}

/** Hash lookup only. Titles/filenames are guessable and never grant permission. */
export function findFreewareByHash(entries: readonly FreewareEntry[], sha256: string): FreewareEntry | undefined {
  const h = sha256.toLowerCase();
  if (h === EMPTY_SHA256) return undefined;
  return entries.find((e) => e.sha256.toLowerCase() === h && e.sha256.toLowerCase() !== EMPTY_SHA256);
}

export function freewareEntryToRights(e: FreewareEntry, now = "2026-11-05T00:00:00Z"): { record: RightsRecord; evidence: EvidenceRecord[] } {
  const evId = `ev:${e.id}:fixture-registry`;
  const cls = e.rights.rights_class;
  const status: RightsStatus =
    e.rights.status.includes("public_domain") ? "public_domain" : e.rights.status.includes("freeware") ? "freeware" : "unknown";
  const evidence: EvidenceRecord[] = [
    {
      schema: "rgme.evidence/v0.2",
      id: evId,
      subject: { type: "game", id: e.id },
      claim: e.rights.provenance_note ?? `${e.rights.license} (${e.rights.rightsholder})`,
      source: { type: cls === "A" ? "author" : "license", title: `${e.rights.license} — ${e.rights.rightsholder}` },
      scope: e.sha256,
      confidence: cls === "A" ? "high" : "medium",
      createdAt: now
    }
  ];
  const assertions: RightsAssertion[] = ACTIONS.filter((a) => e.rights.actions[a] !== undefined).map((action) => ({
    action,
    component: "game_binary" as const,
    status: mapAction(e.rights.actions[action]),
    scope: e.rights.actions[action],
    evidenceIds: [evId],
    confidence: cls === "A" ? ("high" as const) : ("medium" as const)
  }));
  return {
    evidence,
    record: {
      schema: "rgme.rights/v0.2",
      id: `rights:${e.id}`,
      gameId: e.id,
      status,
      classification: (["A", "B", "C", "D", "E"].includes(cls) ? cls : "D") as RightsRecord["classification"],
      opportunity: (["GREEN", "LIGHT_GREEN", "YELLOW", "ORANGE", "RED", "GREY"].includes(e.rights.opportunity) ? e.rights.opportunity : "GREY") as RightsRecord["opportunity"],
      copyright: { status: status === "public_domain" ? "public_domain" : "active", currentHolder: e.rights.rightsholder, confidence: cls === "A" ? "high" : "medium" },
      assertions,
      reviewedAt: now,
      notes: [`${e.rights.license}`]
    }
  };
}

const KINDS = ["adf", "d64", "t64", "g64", "st", "msa", "rom", "bin", "md", "sfc", "smc", "nes", "img", "iso"];
function mediaKind(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return KINDS.includes(ext) ? ext : "bin";
}

export function freewareEntryToProfile(e: FreewareEntry): GameProfile {
  const scene = SCENES[e.id];
  return parseGameProfile({
    schema: "rgme.game/v0.2",
    id: e.id,
    title: e.canonical_title,
    platform: e.platform ?? "amiga",
    machine: {
      model: e.machine.model,
      chipset: e.machine.chipset,
      video: e.machine.video,
      ram: { chipKb: e.machine.ram_chip_kb, fastKb: e.machine.ram_fast_kb }
    },
    media: [{ id: "df0", kind: mediaKind(e.filename), filename: e.filename, label: e.canonical_title, sha256: e.sha256 }],
    runtime: { preferredAdapter: "mock", ...(scene ? { options: { scene } } : {}) },
    launch: { bootMediaId: "df0", autoStart: Boolean(scene) },
    input: DEFAULT_INPUT_MAPPING,
    display: { ...DEFAULT_DISPLAY_PROFILE, crt: Boolean(scene) },
    rights: { recordId: `rights:${e.id}` }
  });
}
