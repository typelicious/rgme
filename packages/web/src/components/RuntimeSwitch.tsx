import type { RuntimeKind } from "../lib/runtime-factory";

const OPTIONS: Array<{ kind: RuntimeKind; label: string }> = [
  { kind: "mock", label: "Mock" },
  { kind: "wasm", label: "WASM core" }
];

export function RuntimeSwitch({
  kind,
  onChange,
  disabledWasmReason
}: {
  kind: RuntimeKind;
  onChange: (kind: RuntimeKind) => void;
  /** When set, the WASM option is disabled and this text explains why. */
  disabledWasmReason?: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm" data-testid="runtime-switch">
      <div role="radiogroup" aria-label="Runtime" className="flex">
        {OPTIONS.map((o) => {
          const disabled = o.kind === "wasm" && Boolean(disabledWasmReason);
          return (
            <button
              key={o.kind}
              type="button"
              role="radio"
              aria-checked={kind === o.kind}
              data-testid={`runtime-${o.kind}`}
              disabled={disabled}
              title={disabled ? disabledWasmReason : undefined}
              className="rgme-btn"
              style={kind === o.kind ? { borderColor: "var(--rgme-border-focus)", boxShadow: "0 0 0 1px var(--rgme-border-glow)" } : undefined}
              onClick={() => kind !== o.kind && onChange(o.kind)}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      <span style={{ color: "var(--rgme-fg-secondary)" }} data-testid="runtime-note">
        {kind === "wasm" ? "reference core (timing/integration test, not an emulator)" : "mock test-pattern runtime"}
      </span>
    </div>
  );
}
