import { useState } from "react";
import type { GameProfile, PolicyDecision, RightsAction } from "@rgme/core";
import { RightsBadge } from "./RightsBadge";

export interface InspectorDecisions {
  private_execution: PolicyDecision;
  binary_redistribution: PolicyDecision;
}

const PLATFORM_LABEL: Record<string, string> = { amiga: "Amiga", c64: "Commodore 64", megadrive: "Mega Drive", atari_st: "Atari ST", dos: "DOS", snes: "SNES", nes: "NES" };

export function GameProfileInspector({ profile, decisions }: { profile?: GameProfile; decisions?: InspectorDecisions }) {
  const [open, setOpen] = useState(false);
  if (!profile || !decisions) {
    return <section className="rgme-panel text-sm" style={{ color: "var(--rgme-fg-muted)" }}>No game loaded.</section>;
  }
  const m = profile.machine;
  const actions: RightsAction[] = ["private_execution", "binary_redistribution"];
  return (
    <section className="rgme-panel" data-testid="inspector">
      <h2 className="text-lg mb-2" style={{ fontSize: "1.125rem" }}>{profile.title}</h2>
      <p className="text-sm" data-testid="machine-summary">
        {PLATFORM_LABEL[profile.platform] ?? profile.platform} {m.model}{m.chipset ? ` · ${m.chipset}` : ""} · {m.video} {m.video === "PAL" ? "50Hz" : "60Hz"}{m.ram?.chipKb !== undefined ? ` · ${m.ram.chipKb}K chip` : ""}{m.ram?.fastKb !== undefined ? ` / ${m.ram.fastKb}K fast` : ""}
      </p>
      <div className="flex flex-col items-start gap-2 mt-3">
        {actions.map((a) => (
          <RightsBadge key={a} action={a} decision={decisions[a as keyof InspectorDecisions].decision} />
        ))}
      </div>
      <button className="rgme-btn mt-3" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? "Hide details" : "Show details"}
      </button>
      {open && (
        <div className="rgme-mono mt-2 grid gap-1" data-testid="inspector-details">
          <div>id: {profile.id}</div>
          <div>schema: {profile.schema}</div>
          <div>media: {profile.media.map((x) => `${x.filename} (${x.sha256.slice(0, 16)}…)`).join(", ")}</div>
          <div>rights record: {profile.rights.recordId}</div>
          <div>reasons: {decisions.private_execution.reasonCodes.join(", ")}</div>
        </div>
      )}
    </section>
  );
}
