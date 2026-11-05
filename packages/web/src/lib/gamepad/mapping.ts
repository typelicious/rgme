export type AmigaAction = "up" | "down" | "left" | "right" | "fire" | "fire2";
export const AMIGA_ACTIONS: readonly AmigaAction[] = ["up", "down", "left", "right", "fire", "fire2"];

export interface GamepadMapping {
  /** Physical button index (Standard Gamepad layout) per Amiga action. */
  buttons: Record<AmigaAction, number>;
  /** Left stick acts as the joystick. */
  stick: boolean;
  deadzone: number;
  /** Hold-to-repeat fire. */
  autofire: boolean;
  /** Button that toggles autofire when pressed (null = none). Default X/Square (2). */
  autofireToggleButton: number | null;
}

export const DEFAULT_GAMEPAD_MAPPING: GamepadMapping = {
  buttons: { up: 12, down: 13, left: 14, right: 15, fire: 0, fire2: 1 },
  stick: true,
  deadzone: 0.4,
  autofire: false,
  autofireToggleButton: 2
};

const KEY = "rgme.gamepad.mapping";

function isMapping(v: unknown): v is GamepadMapping {
  if (!v || typeof v !== "object") return false;
  const m = v as GamepadMapping;
  return (
    !!m.buttons &&
    AMIGA_ACTIONS.every((a) => Number.isInteger(m.buttons[a]) && m.buttons[a] >= 0 && m.buttons[a] < 64) &&
    typeof m.stick === "boolean" &&
    typeof m.deadzone === "number" && m.deadzone >= 0 && m.deadzone < 1 &&
    typeof m.autofire === "boolean" &&
    (m.autofireToggleButton === null || Number.isInteger(m.autofireToggleButton))
  );
}

export function loadMapping(storage: Pick<Storage, "getItem"> | undefined = safeStorage()): GamepadMapping {
  try {
    const raw = storage?.getItem(KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isMapping(parsed)) return parsed;
    }
  } catch { /* corrupt or unavailable storage: fall back to defaults */ }
  return { ...DEFAULT_GAMEPAD_MAPPING, buttons: { ...DEFAULT_GAMEPAD_MAPPING.buttons } };
}

export function saveMapping(m: GamepadMapping, storage: Pick<Storage, "setItem"> | undefined = safeStorage()): void {
  try { storage?.setItem(KEY, JSON.stringify(m)); } catch { /* ignore */ }
}

function safeStorage(): Storage | undefined {
  try { return typeof localStorage === "undefined" ? undefined : localStorage; } catch { return undefined; }
}
