import type { PolicyDecisionKind, RightsAction } from "@rgme/core";
import { badgeText, toneFor } from "../lib/rights-ui";

export function RightsBadge({ action, decision }: { action: RightsAction; decision: PolicyDecisionKind }) {
  return (
    <span className="rgme-badge" data-tone={toneFor(decision)} data-testid={`badge-${action}`}>
      {badgeText(action, decision)}
    </span>
  );
}
