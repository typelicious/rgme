import { useMemo, useState } from "react";
import type { RightsRecord } from "@rgme/core";
import { actionStatus, classInfo, evidenceFor, findChain, parseChain, searchTitles, type ChainRecord } from "../lib/chain/chain";

const ACTION_LABELS: Record<string, string> = {
  private_execution: "Local execution",
  binary_redistribution: "Binary redistribution",
  browser_hosting: "Browser hosting",
  reverse_engineering: "Reverse engineering",
  patch_distribution: "Patch distribution",
  modification: "Modification",
  derivative_distribution: "Derivative distribution",
  commercial_use: "Commercial use"
};

function Timeline({ rec }: { rec: ChainRecord }) {
  const nodes = parseChain(rec);
  return (
    <ol aria-label="Chain of title" data-testid="chain-timeline" className="flex flex-wrap items-stretch gap-2 list-none p-0 m-0">
      {nodes.map((n, i) => (
        <li key={n.name + i} className="flex items-center gap-2" data-testid="chain-node" data-role={n.role}>
          {i > 0 && (
            <span aria-label={n.link === "documented" ? "transferred to" : "unverified link (audit family label)"} data-testid="chain-link" data-link={n.link} style={{ color: n.link === "documented" ? "var(--rgme-accent-workbench-orange)" : "var(--rgme-fg-muted)", fontSize: "1.25rem" }}>
              {n.link === "documented" ? "➔" : "⇢"}
            </span>
          )}
          <div className="rgme-panel" style={{ minWidth: 180, maxWidth: 320, borderStyle: n.role === "unverified" ? "dashed" : "solid" }}>
            <div className="text-sm" style={{ color: "var(--rgme-fg-muted)" }}>{n.role === "original" ? "Original" : n.role === "current" ? "Current holder" : n.role === "intermediate" ? "Intermediate" : "Unverified"}</div>
            <strong>{n.name}</strong>
            {n.link === "family-label" && <div className="text-xs" style={{ color: "var(--rgme-status-localonly-fg)" }}>link unverified (audit family label)</div>}
            <ul className="text-xs mt-1" style={{ color: "var(--rgme-fg-secondary)", paddingLeft: 16 }} aria-label={`Evidence for ${n.name}`}>
              {n.evidence.map((e, j) => <li key={j}>{e}</li>)}
            </ul>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Detail({ rec }: { rec: ChainRecord }) {
  const ci = classInfo(rec.rights_class);
  const ev = evidenceFor(rec);
  return (
    <div data-testid="chain-detail" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-lg m-0">{rec.canonical_title}</h3>
        <span className="rgme-badge" data-tone={ci.tone} data-testid="chain-class">Class {rec.rights_class}</span>
        <span className="text-sm" style={{ color: "var(--rgme-fg-secondary)" }}>{ci.title}</span>
      </div>
      <p className="text-sm m-0">{ci.text}{ci.uncertain ? " The audit marks this class as uncertain." : ""}</p>
      <Timeline rec={rec} />
      <section aria-label="Evidence">
        <h4 className="text-sm m-0">Evidence</h4>
        <div className="flex items-center gap-2 text-xs my-1">
          <span>Confidence: {ev.label}</span>
          <meter min={0} max={1} value={ev.confidence} aria-label="Confidence" data-testid="chain-confidence" />
          <span>{Math.round(ev.confidence * 100)}%</span>
        </div>
        <ul className="text-sm" style={{ paddingLeft: 16 }}>
          {ev.entries.map((e, i) => <li key={i}><span className="rgme-mono">{e.source}</span> ({e.confidence}): {e.text}</li>)}
        </ul>
      </section>
      <section aria-label="Action matrix">
        <h4 className="text-sm m-0">Allowed actions</h4>
        <table className="text-sm" data-testid="chain-actions">
          <tbody>
            {Object.keys(ACTION_LABELS).filter((k) => k in rec.actions).map((k) => {
              const s = actionStatus(rec.actions[k]);
              return (
                <tr key={k}>
                  <td style={{ paddingRight: 12 }}>{ACTION_LABELS[k]}</td>
                  <td><span className="rgme-badge" data-tone={s.tone === "unknown" ? "local-only" : s.tone} data-testid={`chain-action-${k}`}>{s.label}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Unknown({ title, rights }: { title?: string; rights?: RightsRecord }) {
  const ci = classInfo(rights && rights.status !== "unknown" ? rights.classification : undefined);
  return (
    <div data-testid="chain-unknown" role="status">
      <h3 className="text-lg m-0">{title ?? "Unknown title"}</h3>
      <p className="text-sm">No chain of title on record: local play only.</p>
      <p className="text-xs" style={{ color: "var(--rgme-fg-secondary)" }}>{ci.text}</p>
    </div>
  );
}

export function ChainOfTitle({ title, rights }: { title?: string; rights?: RightsRecord }) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<ChainRecord>();
  const matches = useMemo(() => searchTitles(query), [query]);
  const rec = title ? findChain(title) : picked;

  return (
    <section className="rgme-panel" aria-labelledby="chain-heading" data-testid="chain-of-title">
      <h2 id="chain-heading" className="text-lg mt-0">Chain of Title</h2>
      {!title && (
        <div className="mb-3">
          <label className="text-sm flex flex-col gap-1">
            Search titles
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} data-testid="chain-search" placeholder="e.g. Lemmings" />
          </label>
          <ul className="list-none p-0 m-0 mt-2 flex flex-wrap gap-2" aria-label="Titles" data-testid="chain-picker" style={{ maxHeight: 120, overflowY: "auto" }}>
            {matches.map((r) => (
              <li key={r.canonical_key}>
                <button type="button" className="rgme-btn" aria-pressed={picked?.canonical_key === r.canonical_key} onClick={() => setPicked(r)}>{r.canonical_title}</button>
              </li>
            ))}
            {matches.length === 0 && <li className="text-sm">No titles match.</li>}
          </ul>
        </div>
      )}
      {rec ? <Detail rec={rec} /> : title ? <Unknown title={title} rights={rights} /> : <p className="text-sm">Pick a title to see its chain of title.</p>}
    </section>
  );
}
