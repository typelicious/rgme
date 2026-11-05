import type { RightsAction, RightsAssertion, RightsRecord, RightsStatus, EvidenceRecord } from "./rights.js";

/** Subset of a record from concept/RGME-Amiga-Master-Rights-Matrix-v0.2.json. */
export interface MatrixRecord {
  canonical_key: string;
  canonical_title: string;
  rights_class: string;
  opportunity: string;
  confidence_label?: string;
  current_rights_assessment?: string;
  source_batches?: string[];
  actions: Record<string, string>;
}

export interface MatrixFile {
  schema: string;
  records: MatrixRecord[];
}

const ACTIONS: RightsAction[] = [
  "private_execution", "binary_redistribution", "browser_hosting", "reverse_engineering",
  "patch_distribution", "modification", "derivative_distribution", "commercial_use"
];

/** Lowercase, strip diacritics/punctuation/disk suffixes so filenames match canonical titles. */
export function normalizeTitle(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\.(adf|lha|zip|dms)$/i, "")
    .replace(/[\[(][^\])]*[\])]/g, " ")
    .replace(/\b(disk|disc)\s*\d+\b/g, " ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function mapStatus(value: string | undefined): RightsAssertion["status"] {
  if (!value) return "unknown";
  if (value.startsWith("deny")) return "prohibited";
  if (value.startsWith("review")) return "restricted";
  // "allow_local_byog" is a *local policy*, not a rightsholder permission => stays unknown.
  return "unknown";
}

function deriveStatus(m: MatrixRecord): RightsStatus {
  if (/public.domain/i.test(m.current_rights_assessment ?? "")) return "public_domain";
  if (/freeware/i.test(m.current_rights_assessment ?? "")) return "freeware";
  if (m.actions.binary_redistribution?.startsWith("deny")) {
    return m.rights_class.startsWith("E") || m.rights_class.startsWith("D") || m.rights_class.startsWith("C")
      ? "commercial_restricted"
      : "unknown";
  }
  return "unknown";
}

export function matrixRecordToRights(m: MatrixRecord, now = "2026-10-28T00:00:00Z"): { record: RightsRecord; evidence: EvidenceRecord[] } {
  const gameId = m.canonical_key.replace(/\s+/g, "-");
  const evId = `ev:${gameId}:master-matrix`;
  const evidence: EvidenceRecord[] = [
    {
      schema: "rgme.evidence/v0.2",
      id: evId,
      subject: { type: "game", id: gameId },
      claim: m.current_rights_assessment || "Master Rights Matrix classification",
      source: { type: "secondary-source", title: `RGME Master Rights Matrix v0.2 (batches ${(m.source_batches ?? []).join(", ")})` },
      confidence: "low",
      createdAt: now
    }
  ];
  const assertions: RightsAssertion[] = ACTIONS.filter((a) => m.actions[a] !== undefined).map((action) => ({
    action,
    component: "game_binary" as const,
    status: mapStatus(m.actions[action]),
    scope: m.actions[action],
    evidenceIds: [evId],
    confidence: "low" as const
  }));
  const cls = m.rights_class.charAt(0);
  return {
    evidence,
    record: {
      schema: "rgme.rights/v0.2",
      id: `rights:${gameId}`,
      gameId,
      status: deriveStatus(m),
      classification: (["A", "B", "C", "D", "E"].includes(cls) ? cls : "D") as RightsRecord["classification"],
      opportunity: (["GREEN", "LIGHT_GREEN", "YELLOW", "ORANGE", "RED", "GREY"].includes(m.opportunity.split("/")[0] ?? "")
        ? m.opportunity.split("/")[0]
        : "GREY") as RightsRecord["opportunity"],
      assertions,
      reviewedAt: now,
      notes: m.current_rights_assessment ? [m.current_rights_assessment] : undefined
    }
  };
}

export class MasterMatrixIndex {
  private byTitle = new Map<string, MatrixRecord>();
  constructor(file: MatrixFile) {
    for (const r of file.records) {
      this.byTitle.set(normalizeTitle(r.canonical_title), r);
      this.byTitle.set(normalizeTitle(r.canonical_key), r);
    }
  }
  get size() {
    return this.byTitle.size;
  }
  match(nameOrFilename: string): MatrixRecord | undefined {
    return this.byTitle.get(normalizeTitle(nameOrFilename));
  }
}
