import type { RuntimeStatus } from "@rgme/core";

export function BoingBall() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" role="img" aria-label="Boing ball">
      <circle cx="14" cy="14" r="13" fill="#fff" stroke="#242a3d" />
      <path d="M3 8h22M2 14h24M3 20h22" stroke="#ff334b" strokeWidth="3" fill="none" clipPath="circle(13px at 14px 14px)" />
      <path d="M9 2l6 12-4 12M19 2l-6 12 4 12" stroke="#ff334b" strokeWidth="3" fill="none" opacity="0.9" />
    </svg>
  );
}

export function Header({ status, runtimeName }: { status: RuntimeStatus; runtimeName: string }) {
  const color =
    status.state === "RUNNING" ? "var(--rgme-accent-phosphor-green)" :
    status.state === "PAUSED" ? "var(--rgme-accent-phosphor-amber)" : "var(--rgme-fg-muted)";
  return (
    <header className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: "var(--rgme-border-subtle)", background: "var(--rgme-bg-surface-base)" }}>
      <BoingBall />
      <h1 className="text-xl font-semibold rgme-mono" style={{ fontSize: "1.25rem" }}>RGME</h1>
      <span className="text-sm" style={{ color: "var(--rgme-fg-secondary)" }}>Retro Game Modernization Engine</span>
      <span className="flex-1" />
      <span
        data-testid="runtime-pill"
        className="rgme-badge rgme-mono"
        style={{ color, borderColor: color }}
      >
        {runtimeName} · {status.state}
        {status.diskActivity ? " · DF0 ●" : ""}
      </span>
    </header>
  );
}
