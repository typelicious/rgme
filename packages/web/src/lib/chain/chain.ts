import { normalizeTitle } from "@rgme/core";
import raw from "./data.json";

export interface Provenance { batch: string; family: string; assessment: string; confidence: string; licensing_route: string }
export interface ChainRecord {
  canonical_title: string;
  canonical_key: string;
  rights_class: string;
  opportunity: string;
  confidence_label: string;
  confidence_score: number;
  current_rights_assessment: string;
  licensing_route: string;
  source_families: string[];
  rights_layers: unknown[];
  provenance: Provenance[];
  actions: Record<string, string>;
}

export type NodeRole = "original" | "intermediate" | "current" | "unverified";
export interface ChainNode {
  name: string;
  role: NodeRole;
  /** How this node connects to the previous (older) one. */
  link: "start" | "documented" | "family-label";
  evidence: string[];
}

export const CHAIN_DATA = raw as unknown as ChainRecord[];

const split = (s: string, sep: string) => s.split(sep).map((x) => x.trim()).filter(Boolean);

/**
 * Ordered chain from original (oldest) to current holder. Links are only created from
 * explicit data: `licensing_route` ("current ← … ← original") or an arrow family ("A → B → C").
 * A "A / B" audit family label is used only when B is named in the assessment, and is marked
 * 'family-label' (unverified link). Otherwise: one 'unverified' node. Links are never invented.
 */
export function parseChain(rec: ChainRecord): ChainNode[] {
  const evidence = [rec.current_rights_assessment, ...rec.provenance.map((p) => p.assessment)].filter(Boolean);
  const uniq = (a: string[]) => [...new Set(a)];
  const mk = (names: string[], link: ChainNode["link"]): ChainNode[] =>
    names.map((name, i) => ({
      name,
      role: names.length === 1 ? "current" : i === 0 ? "original" : i === names.length - 1 ? "current" : "intermediate",
      link: i === 0 ? "start" : link,
      evidence: i === names.length - 1 ? uniq(evidence) : [`Named in the audited route as holder #${i + 1} of ${names.length}.`]
    }));

  const route = split(rec.licensing_route ?? "", "←");
  if (route.length > 1) return mk(route.reverse(), "documented");

  const fam = rec.source_families?.[0] ?? "";
  const arrow = split(fam, "→");
  if (arrow.length > 1) return mk(arrow, "documented");

  const slash = split(fam, "/");
  const last = slash[slash.length - 1];
  const firstWord = last?.split(" ")[0] ?? "";
  if (slash.length > 1 && firstWord && rec.current_rights_assessment.includes(firstWord)) {
    return mk([slash[0]!, last!], "family-label");
  }

  const single = route[0] ?? fam;
  if (single && rec.licensing_route) return mk([single], "documented");
  return [{ name: single || "Unknown rightsholder", role: "unverified", link: "start", evidence: uniq(evidence) }];
}

export interface ClassInfo { letter: string; title: string; tone: "cleared" | "local-only" | "restricted"; text: string; uncertain: boolean }

export function classInfo(cls: string | undefined): ClassInfo {
  const raw = (cls ?? "").trim();
  const letter = raw.charAt(0).toUpperCase();
  const uncertain = raw.includes("?") || raw.includes("/");
  const base = { uncertain };
  switch (letter) {
    case "A": return { ...base, letter, title: "Class A — public domain / verified", tone: "cleared", text: "Verified public domain or open licence with evidence. Local play and redistribution are evidenced." };
    case "C": return { ...base, letter, title: "Class C — explicit freeware / authorization", tone: "cleared", text: "The rightsholder explicitly authorized free distribution. Scope is limited to what the licence states (e.g. no modification)." };
    case "D": return { ...base, letter, title: "Class D — commercial, chain established, no permission", tone: "restricted", text: "A commercial title with a known rights chain but no licence for us. Local play with your own copy only; redistribution is denied." };
    case "E": return { ...base, letter, title: "Class E — commercial, ownership unclear or disputed", tone: "restricted", text: "Ownership is unclear or contested. Treated as restricted: local play with your own copy only." };
    default: return { ...base, letter: "?", title: "Unknown — no rights on record", tone: "local-only", text: "No rights evidence. Unknown rights never become permission: local play only, no export or distribution." };
  }
}

export interface Evidence { source: string; text: string; confidence: string }
export function evidenceFor(rec: ChainRecord): { entries: Evidence[]; confidence: number; label: string } {
  const entries = rec.provenance.map((p) => ({ source: `Audit batch ${p.batch} — ${p.family}`, text: p.assessment, confidence: p.confidence }));
  return { entries, confidence: rec.confidence_score, label: rec.confidence_label };
}

export type ActionTone = "cleared" | "local-only" | "restricted" | "unknown";
export function actionStatus(value: string | undefined): { label: string; tone: ActionTone } {
  if (!value) return { label: "not assessed", tone: "unknown" };
  if (value === "allow") return { label: "permitted", tone: "cleared" };
  if (value === "allow_local_byog") return { label: "local only (bring your own game)", tone: "local-only" };
  if (value.startsWith("deny")) return { label: "denied", tone: "restricted" };
  if (value.startsWith("review")) return { label: "needs review", tone: "local-only" };
  return { label: value.replace(/_/g, " "), tone: "unknown" };
}

let index: Map<string, ChainRecord> | undefined;
function idx() {
  if (!index) {
    index = new Map();
    for (const r of CHAIN_DATA) {
      index.set(normalizeTitle(r.canonical_title), r);
      index.set(normalizeTitle(r.canonical_key), r);
    }
  }
  return index;
}

export function findChain(title: string): ChainRecord | undefined {
  return idx().get(normalizeTitle(title));
}

export function searchTitles(query: string): ChainRecord[] {
  const q = normalizeTitle(query);
  return CHAIN_DATA.filter((r) => !q || normalizeTitle(r.canonical_title).includes(q));
}
