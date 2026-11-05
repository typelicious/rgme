import type { PolicyDecisionKind, RightsAction } from "@rgme/core";

export type BadgeTone = "cleared" | "local-only" | "restricted";

export function toneFor(decision: PolicyDecisionKind): BadgeTone {
  if (decision === "allow") return "cleared";
  if (decision === "local_only") return "local-only";
  return "restricted";
}

const ACTION_LABEL: Partial<Record<RightsAction, string>> = {
  private_execution: "Local execution",
  binary_redistribution: "Binary redistribution",
  browser_hosting: "Browser hosting",
  patch_distribution: "Patch distribution",
  modification: "Modification"
};

/** Action-specific wording; never a generic "legal" claim. */
export function badgeText(action: RightsAction, decision: PolicyDecisionKind): string {
  const label = ACTION_LABEL[action] ?? action.replace(/_/g, " ");
  switch (decision) {
    case "allow":
      return action === "private_execution" ? `${label}: allowed` : `${label}: authorized for this release`;
    case "local_only":
      return `${label}: allowed (BYOG)`;
    case "review":
      return `${label}: review required`;
    default:
      return action === "private_execution" ? `${label}: blocked` : `${label}: not verified`;
  }
}
