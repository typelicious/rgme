import type { RuntimeKind } from "../lib/runtime-factory";

export interface CoreTelemetryHUDProps {
  runtimeKind: RuntimeKind;
  state: string;
  frame: number;
  activeRomName?: string;
  onOpenRomSettings?: () => void;
  phase?: string;
  message?: string;
}

export function CoreTelemetryHUD({
  runtimeKind,
  state,
  frame,
  activeRomName,
  onOpenRomSettings,
  phase,
  message
}: CoreTelemetryHUDProps) {
  const isAmigaCore = runtimeKind === "vamiga" || runtimeKind === "puae" || runtimeKind === "copperline" || runtimeKind === "preview" || runtimeKind === "wasm";

  return (
    <div
      data-testid="core-telemetry-hud"
      className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 bg-[#12131b] border border-[#232734] rounded-lg text-xs font-mono text-[#cbd5e1] mt-2 shadow-inner"
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${
              phase === "error"
                ? "bg-red-500 shadow-[0_0_8px_#ef4444]"
                : phase === "loading"
                ? "bg-amber-400 animate-spin"
                : state === "RUNNING"
                ? "bg-emerald-400 animate-pulse shadow-[0_0_8px_#10b981]"
                : state === "LOADED"
                ? "bg-blue-400"
                : state === "PAUSED"
                ? "bg-amber-400"
                : "bg-gray-500"
            }`}
          />
          <span className="font-bold text-white tracking-wider">
            {runtimeKind === "vamiga"
              ? "VAMIGA AMIGA EMULATOR"
              : runtimeKind === "puae"
              ? "PUAE AMIGA EMULATOR"
              : runtimeKind === "copperline"
              ? "COPPERLINE RUST/WASM"
              : runtimeKind === "preview"
              ? "PREVIEW (MOCK)"
              : runtimeKind === "wasm"
              ? "WASM 68000 CORE"
              : runtimeKind === "m68k"
              ? "68000 PARTIAL"
              : "MOCK ARCADE"}
          </span>
        </div>

        <span className="text-[#64748b]">|</span>

        <span className="text-[#94a3b8]">
          STATE: <strong className="text-white">{state}</strong>
        </span>

        {message && (
          <>
            <span className="text-[#64748b]">|</span>
            <span className={`text-[11px] truncate max-w-sm ${phase === "error" ? "text-red-400 font-bold" : "text-amber-300"}`} title={message}>
              {message}
            </span>
          </>
        )}

        <span className="text-[#64748b]">|</span>

        <span className="text-[#94a3b8]">
          FRAME: <strong className="text-[#38bdf8]">{frame}</strong>
        </span>
      </div>

      <div className="flex items-center gap-2">
        {isAmigaCore && (
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-[#064e3b]/80 border border-emerald-600/50 text-[11px] text-emerald-200">
              {activeRomName ?? "AROS 68k"}
            </span>
            <button
              onClick={onOpenRomSettings}
              className="rgme-btn text-[11px] px-2 py-0.5 flex items-center gap-1 hover:border-emerald-400"
              data-testid="open-rom-modal-btn"
              title="Configure Kickstart ROM"
            >
              <span>⚙️</span> ROM Settings
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
