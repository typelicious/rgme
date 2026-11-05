const DIRS = [
  { id: "up", label: "▲", col: 2, row: 1 },
  { id: "left", label: "◀", col: 1, row: 2 },
  { id: "right", label: "▶", col: 3, row: 2 },
  { id: "down", label: "▼", col: 2, row: 3 }
] as const;

export function ControllerHUD({
  active,
  press,
  physical,
  gamepadName
}: {
  active: ReadonlySet<string>;
  press: (action: string, down: boolean) => void;
  /** Amiga actions currently held on a real gamepad (shown as an extra ring). */
  physical?: ReadonlySet<string>;
  gamepadName?: string;
}) {
  const key = (id: string, label: string, aria: string) => (
    <button
      key={id}
      type="button"
      aria-label={aria}
      data-testid={`hud-${id}`}
      data-active={active.has(id)}
      data-physical={physical?.has(id) ?? false}
      style={physical?.has(id) ? { boxShadow: "0 0 0 2px var(--rgme-accent-phosphor-green)" } : undefined}
      className="rgme-hud-key"
      onPointerDown={() => press(id, true)}
      onPointerUp={() => press(id, false)}
      onPointerLeave={() => active.has(id) && press(id, false)}
    >
      {label}
    </button>
  );
  return (
    <div className="flex items-center justify-center gap-10 mt-4" data-testid="hud" aria-label="Virtual Amiga joystick">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 40px)", gap: 4 }}>
        {DIRS.map((d) => (
          <div key={d.id} style={{ gridColumn: d.col, gridRow: d.row }}>{key(d.id, d.label, d.id)}</div>
        ))}
      </div>
      <div className="flex gap-3">
        {key("fire", "1", "fire")}
        {key("fire2", "2", "fire 2")}
      </div>
      {gamepadName && <span className="text-sm" data-testid="hud-gamepad" style={{ color: "var(--rgme-accent-phosphor-green)" }}>🎮 {gamepadName}</span>}
    </div>
  );
}
