import type { RuntimeKind } from "../lib/runtime-factory";

export interface CoreTelemetryHUDProps {
  runtimeKind: RuntimeKind;
  state: string;
  frame: number;
  activeRomName?: string;
  onOpenRomSettings?: () => void;
}

export function CoreTelemetryHUD({
  runtimeKind,
  state,
  frame,
  activeRomName,
  onOpenRomSettings
}: CoreTelemetryHUDProps) {
  const isWasm = runtimeKind === "wasm";

  return (
    <div
      data-testid="core-telemetry-hud"
      className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 bg-[#12131b] border border-[#232734] rounded-lg text-xs font-mono text-[#cbd5e1] mt-2 shadow-inner"
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${
              state === "RUNNING"
                ? "bg-emerald-400 animate-pulse shadow-[0_0_8px_#10b981]"
                : state === "LOADED"
                ? "bg-blue-400"
                : state === "PAUSED"
                ? "bg-amber-400"
                : "bg-gray-500"
            }`}
          />
          <span className="font-bold text-white tracking-wider">
            {isWasm ? "WASM 68000 CORE" : runtimeKind === "m68k" ? "68000 PARTIAL" : "MOCK ARCADE"}
          </span>
        </div>

        <span className="text-[#64748b]">|</span>

        <span className="text-[#94a3b8]">
          STATE: <strong className="text-white">{state}</strong>
        </span>

        <span className="text-[#64748b]">|</span>

        <span className="text-[#94a3b8]">
          FRAME: <strong className="text-[#38bdf8]">{frame}</strong>
        </span>
      </div>

      <div className="flex items-center gap-2">
        {isWasm && (
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
