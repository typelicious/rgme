import { useState, useRef, useEffect } from "react";
import type { RuntimeStatus } from "@rgme/core";
import type { RuntimeKind } from "../lib/runtime-factory";

export function BoingBall() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" role="img" aria-label="Boing ball">
      <circle cx="14" cy="14" r="13" fill="#fff" stroke="#242a3d" />
      <path d="M3 8h22M2 14h24M3 20h22" stroke="#ff334b" strokeWidth="3" fill="none" clipPath="circle(13px at 14px 14px)" />
      <path d="M9 2l6 12-4 12M19 2l-6 12 4 12" stroke="#ff334b" strokeWidth="3" fill="none" opacity="0.9" />
    </svg>
  );
}

export function Header({
  status,
  runtimeName,
  runtimeKind = "wasm",
  onSelectRuntimeKind,
  onToggleSidebar,
  onOpenPalette,
  onOpenShortcuts,
  onOpenCloudStream,
  driveSoundEnabled = true,
  onToggleDriveSound
}: {
  status: RuntimeStatus;
  runtimeName: string;
  runtimeKind?: RuntimeKind;
  onSelectRuntimeKind?: (kind: RuntimeKind) => void;
  onToggleSidebar?: () => void;
  onOpenPalette?: () => void;
  onOpenShortcuts?: () => void;
  onOpenCloudStream?: () => void;
  driveSoundEnabled?: boolean;
  onToggleDriveSound?: () => void;
}) {
  const [runtimeMenuOpen, setRuntimeMenuOpen] = useState(false);
  const runtimeMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (runtimeMenuRef.current && !runtimeMenuRef.current.contains(e.target as Node)) {
        setRuntimeMenuOpen(false);
      }
    };
    if (runtimeMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [runtimeMenuOpen]);

  const color =
    status.state === "RUNNING" ? "var(--rgme-accent-phosphor-green)" :
    status.state === "PAUSED" ? "var(--rgme-accent-phosphor-amber)" : "var(--rgme-fg-muted)";

  return (
    <header
      className="sticky top-0 z-40 flex items-center gap-3 px-4 py-2.5 border-b select-none backdrop-blur-md shadow-md"
      style={{ borderColor: "var(--rgme-border-subtle)", background: "rgba(17, 20, 29, 0.95)" }}
    >
      <div className="flex items-center gap-2">
        <BoingBall />
        <h1 className="text-xl font-semibold rgme-mono" style={{ fontSize: "1.25rem" }}>RGME</h1>
        <span className="text-xs hidden sm:inline" style={{ color: "var(--rgme-fg-secondary)" }}>Retro Game Modernization Engine</span>
      </div>

      <span className="flex-1" />

      {onToggleSidebar && (
        <button
          onClick={onToggleSidebar}
          data-testid="sidebar-toggle-btn"
          className="rgme-btn flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 hover:border-[#38bdf8] text-white cursor-pointer"
          title="Open Drives & System Tools Drawer"
        >
          <span>🎛️</span>
          <span>Drives & Tools</span>
        </button>
      )}

      {/* Runtime Dropdown in Header */}
      {onSelectRuntimeKind && (
        <div className="relative" ref={runtimeMenuRef}>
          <button
            onClick={() => setRuntimeMenuOpen(!runtimeMenuOpen)}
            data-testid="header-runtime-trigger"
            className="rgme-btn flex items-center gap-1.5 text-xs px-2.5 py-1 hover:border-emerald-400"
            title="Switch execution runtime"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono font-bold text-white">
              {runtimeKind === "wasm" ? "WASM Core" : runtimeKind === "m68k" ? "68000" : "Mock Arcade"}
            </span>
            <span className="text-[10px] text-[#94a3b8]">▾</span>
          </button>

          <div
            data-testid="header-runtime-menu"
            className={
              runtimeMenuOpen
                ? "absolute right-0 top-9 z-50 w-64 bg-[#13141c]/95 border border-[#232734] shadow-2xl rounded-xl p-2 flex flex-col gap-1 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
                : "hidden"
            }
          >
            <div className="text-[10px] uppercase font-mono px-2 py-1 text-[#64748b]">Select Runtime Engine</div>
            <button
              data-testid="runtime-wasm"
              onClick={() => { onSelectRuntimeKind("wasm"); setRuntimeMenuOpen(false); }}
              className={`flex flex-col text-left px-2.5 py-2 rounded-lg text-xs font-mono transition-colors cursor-pointer ${
                runtimeKind === "wasm" ? "bg-emerald-950/40 text-emerald-300 border border-emerald-600/50" : "text-[#cbd5e1] hover:bg-[#1e2332]"
              }`}
            >
              <span className="font-bold">⚡ WebAssembly Core</span>
              <span className="text-[10px] text-[#94a3b8]">Full Amiga 68000 hardware core + AROS ROM</span>
            </button>
            <button
              data-testid="runtime-mock"
              onClick={() => { onSelectRuntimeKind("mock"); setRuntimeMenuOpen(false); }}
              className={`flex flex-col text-left px-2.5 py-2 rounded-lg text-xs font-mono transition-colors cursor-pointer ${
                runtimeKind === "mock" ? "bg-blue-950/40 text-blue-300 border border-blue-600/50" : "text-[#cbd5e1] hover:bg-[#1e2332]"
              }`}
            >
              <span className="font-bold">🕹️ Mock Arcade</span>
              <span className="text-[10px] text-[#94a3b8]">Playable Boing Brick Buster game</span>
            </button>
            <button
              data-testid="runtime-m68k"
              onClick={() => { onSelectRuntimeKind("m68k"); setRuntimeMenuOpen(false); }}
              className={`flex flex-col text-left px-2.5 py-2 rounded-lg text-xs font-mono transition-colors cursor-pointer ${
                runtimeKind === "m68k" ? "bg-amber-950/40 text-amber-300 border border-amber-600/50" : "text-[#cbd5e1] hover:bg-[#1e2332]"
              }`}
            >
              <span className="font-bold">⚙️ 68000 (Partial)</span>
              <span className="text-[10px] text-[#94a3b8]">Bootblock diagnostic interpreter</span>
            </button>
            <span data-testid="runtime-note" className="hidden">
              {runtimeKind === "wasm"
                ? "WebAssembly Amiga 68000 reference core (OCS/ECS + AROS Kickstart; timing/integration test, not an emulator)"
                : runtimeKind === "m68k"
                  ? "partial 68000 interpreter runs the bootblock; no Kickstart, not a full Amiga"
                  : "mock test-pattern runtime"}
            </span>
          </div>
        </div>
      )}

      {onOpenCloudStream && (
        <button
          className="rgme-btn"
          data-testid="header-cloud-btn"
          onClick={onOpenCloudStream}
          style={{ fontSize: "11px", padding: "4px 8px" }}
          title="Stream games from Archive.org preservation collections"
        >
          🌐 Archive.org
        </button>
      )}

      {onToggleDriveSound && (
        <button
          className="rgme-btn"
          data-testid="drive-sound-toggle"
          onClick={onToggleDriveSound}
          style={{ fontSize: "11px", padding: "4px 8px" }}
          title="Toggle mechanical floppy drive seek sound"
        >
          Floppy Audio: {driveSoundEnabled ? "🔊 ON" : "🔇 OFF"}
        </button>
      )}

      {onOpenPalette && (
        <button
          className="rgme-btn"
          data-testid="header-palette-btn"
          onClick={onOpenPalette}
          style={{ fontSize: "11px", padding: "4px 8px" }}
          title="Open Command Palette (Cmd+K)"
        >
          <kbd className="rgme-mono">⌘K</kbd> Palette
        </button>
      )}

      {onOpenShortcuts && (
        <button
          className="rgme-btn"
          data-testid="header-shortcuts-btn"
          onClick={onOpenShortcuts}
          style={{ fontSize: "11px", padding: "4px 8px" }}
          title="Keyboard Shortcuts (?)"
        >
          <kbd className="rgme-mono">?</kbd> Help
        </button>
      )}

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
