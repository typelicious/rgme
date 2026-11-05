import { z } from "zod";

export const RightsActionSchema = z.enum([
  "private_execution",
  "binary_redistribution",
  "browser_hosting",
  "reverse_engineering",
  "patch_distribution",
  "modification",
  "derivative_distribution",
  "commercial_use"
]);
export const RightsComponentSchema = z.enum([
  "game_binary", "source_code", "graphics", "music_audio", "story_text", "manual_box_art", "trademark"
]);
export const AssertionStatusSchema = z.enum(["permitted", "prohibited", "restricted", "unknown", "not_applicable"]);
export const ConfidenceSchema = z.enum(["low", "medium", "high", "verified"]);
/** Public-facing rights status of a title (UI badge input). */
export const RightsStatusSchema = z.enum(["public_domain", "freeware", "authorized", "commercial_restricted", "unknown"]);

export const EvidenceRecordSchema = z
  .object({
    schema: z.literal("rgme.evidence/v0.2"),
    id: z.string().min(1),
    subject: z.object({ type: z.enum(["game", "release", "rights-holder", "rights-assertion"]), id: z.string() }),
    claim: z.string(),
    source: z.object({
      type: z.enum(["official-rightsholder", "author", "license", "authorized-distributor", "statute", "secondary-source", "local-observation"]),
      title: z.string(),
      uri: z.string().optional(),
      accessedAt: z.string().optional()
    }),
    excerpt: z.string().optional(),
    scope: z.string().optional(),
    confidence: ConfidenceSchema,
    contradicts: z.array(z.string()).optional(),
    createdAt: z.string()
  })
  .strict();

export const RightsAssertionSchema = z
  .object({
    action: RightsActionSchema,
    component: RightsComponentSchema,
    status: AssertionStatusSchema,
    scope: z.string().optional(),
    territory: z.array(z.string()).optional(),
    versionScope: z.array(z.string()).optional(),
    conditions: z.array(z.string()).optional(),
    evidenceIds: z.array(z.string()),
    confidence: ConfidenceSchema
  })
  .strict();

export const RightsRecordSchema = z
  .object({
    schema: z.literal("rgme.rights/v0.2"),
    id: z.string().min(1),
    gameId: z.string().min(1),
    status: RightsStatusSchema.default("unknown"),
    classification: z.enum(["A", "B", "C", "D", "E"]),
    opportunity: z.enum(["GREEN", "LIGHT_GREEN", "YELLOW", "ORANGE", "RED", "GREY"]),
    copyright: z
      .object({
        status: z.enum(["active", "expired", "public_domain", "unknown"]),
        currentHolder: z.string().optional(),
        confidence: ConfidenceSchema
      })
      .optional(),
    assertions: z.array(RightsAssertionSchema),
    reviewedAt: z.string(),
    notes: z.array(z.string()).optional()
  })
  .strict();

export const EvidenceStoreSchema = z.object({ records: z.array(EvidenceRecordSchema) }).strict();

export type RightsAction = z.infer<typeof RightsActionSchema>;
export type RightsComponent = z.infer<typeof RightsComponentSchema>;
export type AssertionStatus = z.infer<typeof AssertionStatusSchema>;
export type RightsStatus = z.infer<typeof RightsStatusSchema>;
export type EvidenceRecord = z.infer<typeof EvidenceRecordSchema>;
export type EvidenceStore = z.infer<typeof EvidenceStoreSchema>;
export type RightsAssertion = z.infer<typeof RightsAssertionSchema>;
export type RightsRecord = z.infer<typeof RightsRecordSchema>;

export interface RequestedAction {
  action: RightsAction;
  /** Defaults to ["game_binary"]. */
  components?: RightsComponent[];
}

export type PolicyDecisionKind = "allow" | "local_only" | "review" | "deny";

export interface PolicyDecision {
  decision: PolicyDecisionKind;
  reasonCodes: string[];
  matchedAssertions: number[];
  evidenceIds: string[];
}

const RANK: Record<PolicyDecisionKind, number> = { allow: 0, local_only: 1, review: 2, deny: 3 };

/**
 * Golden rule: unknown rights never become permission by inference.
 * Unknown / missing / unevidenced assertions allow at most local execution.
 */
export class RightsPolicyEngine {
  evaluateAction(record: RightsRecord | undefined, request: RequestedAction): PolicyDecision {
    const { action } = request;
    const components = request.components?.length ? request.components : (["game_binary"] as RightsComponent[]);
    const local = action === "private_execution";

    if (!record) {
      return this.fallback(local, "NO_RIGHTS_RECORD", [], []);
    }

    const decisions: PolicyDecision[] = components.map((component) => {
      const matched: number[] = [];
      record.assertions.forEach((a, i) => {
        if (a.action === action && a.component === component) matched.push(i);
      });
      const evidenceIds = [...new Set(matched.flatMap((i) => record.assertions[i]!.evidenceIds))];
      if (matched.length === 0) return this.fallback(local, `NO_ASSERTION:${component}`, matched, evidenceIds);

      const statuses = new Set(matched.map((i) => record.assertions[i]!.status));
      if (statuses.has("permitted") && statuses.has("prohibited")) {
        return { decision: "review", reasonCodes: [`CONFLICTING_ASSERTIONS:${component}`], matchedAssertions: matched, evidenceIds };
      }
      if (statuses.has("prohibited")) {
        return { decision: "deny", reasonCodes: [`PROHIBITED:${component}`], matchedAssertions: matched, evidenceIds };
      }
      if (statuses.has("restricted")) {
        return { decision: "review", reasonCodes: [`RESTRICTED:${component}`], matchedAssertions: matched, evidenceIds };
      }
      if (statuses.has("unknown")) {
        return this.fallback(local, `UNKNOWN:${component}`, matched, evidenceIds);
      }
      if (statuses.has("permitted")) {
        const evidenced = matched.every(
          (i) => record.assertions[i]!.status !== "permitted" || record.assertions[i]!.evidenceIds.length > 0
        );
        // Assertions require evidence; unevidenced permission is treated as unknown.
        if (!evidenced) return this.fallback(local, `PERMISSION_WITHOUT_EVIDENCE:${component}`, matched, evidenceIds);
        return { decision: "allow", reasonCodes: [`PERMITTED:${component}`], matchedAssertions: matched, evidenceIds };
      }
      // only not_applicable
      return { decision: "allow", reasonCodes: [`NOT_APPLICABLE:${component}`], matchedAssertions: matched, evidenceIds };
    });

    const worst = decisions.reduce((a, b) => (RANK[b.decision] > RANK[a.decision] ? b : a));
    return {
      decision: worst.decision,
      reasonCodes: decisions.flatMap((d) => d.reasonCodes),
      matchedAssertions: [...new Set(decisions.flatMap((d) => d.matchedAssertions))],
      evidenceIds: [...new Set(decisions.flatMap((d) => d.evidenceIds))]
    };
  }

  private fallback(local: boolean, code: string, matched: number[], evidenceIds: string[]): PolicyDecision {
    return local
      ? { decision: "local_only", reasonCodes: [code, "LOCAL_BYOG_ONLY"], matchedAssertions: matched, evidenceIds }
      : { decision: "deny", reasonCodes: [code, "UNKNOWN_NEVER_PERMITS_DISTRIBUTION"], matchedAssertions: matched, evidenceIds };
  }
}

/** Convenience: a record that knows nothing (used when no record exists for a hash). */
export function unknownRightsRecord(gameId: string, now = new Date().toISOString()): RightsRecord {
  return {
    schema: "rgme.rights/v0.2",
    id: `rights:${gameId}:unknown`,
    gameId,
    status: "unknown",
    classification: "D",
    opportunity: "GREY",
    assertions: [],
    reviewedAt: now,
    notes: ["No rights evidence available. Local play only."]
  };
}
