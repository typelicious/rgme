import { AMIGA_ACTIONS, DEFAULT_GAMEPAD_MAPPING, type AmigaAction, type GamepadMapping } from "../lib/gamepad/mapping";

const LABEL: Record<AmigaAction, string> = { up: "Up", down: "Down", left: "Left", right: "Right", fire: "Fire", fire2: "Fire 2" };
const BUTTONS = Array.from({ length: 17 }, (_, i) => i);

export function RemapModal({ open, mapping, onChange, onClose }: { open: boolean; mapping: GamepadMapping; onChange: (m: GamepadMapping) => void; onClose: () => void }) {
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label="Gamepad button mapping" data-testid="remap-modal" className="rgme-panel" style={{ position: "fixed", inset: "10% auto auto 50%", transform: "translateX(-50%)", zIndex: 50, minWidth: 280 }}>
      <h2 className="text-lg mb-2">Gamepad mapping</h2>
      <div className="grid gap-2" style={{ gridTemplateColumns: "1fr auto" }}>
        {AMIGA_ACTIONS.map((a) => (
          <label key={a} className="contents">
            <span>{LABEL[a]}</span>
            <select
              data-testid={`remap-${a}`}
              value={mapping.buttons[a]}
              onChange={(e) => onChange({ ...mapping, buttons: { ...mapping.buttons, [a]: Number(e.target.value) } })}
            >
              {BUTTONS.map((b) => <option key={b} value={b}>Button {b}</option>)}
            </select>
          </label>
        ))}
      </div>
      <label className="flex items-center gap-2 mt-3">
        <input type="checkbox" data-testid="remap-stick" checked={mapping.stick} onChange={(e) => onChange({ ...mapping, stick: e.target.checked })} />
        Left stick as joystick
      </label>
      <label className="flex items-center gap-2 mt-1">
        <input type="checkbox" data-testid="remap-autofire" checked={mapping.autofire} onChange={(e) => onChange({ ...mapping, autofire: e.target.checked })} />
        Auto-fire
      </label>
      <div className="flex gap-2 mt-3">
        <button type="button" className="rgme-btn" data-testid="remap-reset" onClick={() => onChange({ ...DEFAULT_GAMEPAD_MAPPING, buttons: { ...DEFAULT_GAMEPAD_MAPPING.buttons } })}>Reset</button>
        <button type="button" className="rgme-btn" data-testid="remap-close" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
