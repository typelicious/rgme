import { AMIGA_ACTIONS, DEFAULT_GAMEPAD_MAPPING, type AmigaAction, type GamepadMapping } from "./mapping.js";

export type Vendor = "xbox" | "playstation" | "8bitdo" | "generic";

export function detectVendor(id: string): Vendor {
  const s = id.toLowerCase();
  if (/8bitdo|2dc8/.test(s)) return "8bitdo";
  if (/xbox|xinput|045e/.test(s)) return "xbox";
  if (/playstation|dualshock|dualsense|054c|sony|wireless controller/.test(s)) return "playstation";
  return "generic";
}

const VENDOR_LABEL: Record<Vendor, string> = { xbox: "Xbox", playstation: "PlayStation", "8bitdo": "8BitDo", generic: "Generic USB" };
export const vendorLabel = (id: string) => VENDOR_LABEL[detectVendor(id)];

export interface GamepadState {
  connected: boolean;
  name: string;
  /** Amiga actions currently held physically (before autofire shaping). */
  physical: ReadonlySet<string>;
  autofire: boolean;
}

export interface ManagerOptions {
  getGamepads?: () => ArrayLike<Gamepad | null>;
  target?: Pick<EventTarget, "addEventListener" | "removeEventListener">;
  onAction: (action: AmigaAction, down: boolean, source: string) => void;
  onChange?: (state: GamepadState) => void;
  mapping?: GamepadMapping;
  /** Poll ticks per autofire half-period (default 3 ≈ 10 Hz at 60 fps). */
  autofireHalfPeriod?: number;
}

interface Slot {
  prevButtons: boolean[];
  emitted: Set<AmigaAction>;
  fireTicks: number;
  id: string;
}

export class GamepadManager {
  private slots = new Map<number, Slot>();
  private mapping: GamepadMapping;
  private last: GamepadState = { connected: false, name: "", physical: new Set(), autofire: false };
  private running = false;
  private readonly getPads: () => ArrayLike<Gamepad | null>;
  private readonly target?: ManagerOptions["target"];

  constructor(private readonly opts: ManagerOptions) {
    this.mapping = opts.mapping ?? { ...DEFAULT_GAMEPAD_MAPPING, buttons: { ...DEFAULT_GAMEPAD_MAPPING.buttons } };
    this.getPads = opts.getGamepads ?? (() => (typeof navigator !== "undefined" && navigator.getGamepads ? navigator.getGamepads() : []));
    this.target = opts.target ?? (typeof window !== "undefined" ? window : undefined);
  }

  private onDisconnect = (e: Event) => {
    const idx = (e as GamepadEvent).gamepad?.index;
    if (idx !== undefined) this.release(idx);
    this.publish();
  };
  private onConnect = () => this.poll();

  start() {
    if (this.running) return;
    this.running = true;
    this.target?.addEventListener("gamepadconnected", this.onConnect);
    this.target?.addEventListener("gamepaddisconnected", this.onDisconnect);
  }
  stop() {
    this.running = false;
    this.target?.removeEventListener("gamepadconnected", this.onConnect);
    this.target?.removeEventListener("gamepaddisconnected", this.onDisconnect);
    for (const i of [...this.slots.keys()]) this.release(i);
    this.publish();
  }

  get state() { return this.last; }
  getMapping() { return this.mapping; }
  setMapping(m: GamepadMapping) { this.mapping = m; }

  /** Optional haptic pulse; silently ignored where unsupported. */
  rumble(durationMs = 80, magnitude = 0.6) {
    const pads = this.getPads();
    for (let i = 0; i < pads.length; i++) {
      const act = (pads[i] as (Gamepad & { vibrationActuator?: { playEffect?: (t: string, p: object) => Promise<unknown> } }) | null)?.vibrationActuator;
      try { void act?.playEffect?.("dual-rumble", { duration: durationMs, strongMagnitude: magnitude, weakMagnitude: magnitude }); } catch { /* unsupported */ }
    }
  }

  private release(index: number) {
    const s = this.slots.get(index);
    if (!s) return;
    for (const a of s.emitted) this.opts.onAction(a, false, s.id);
    this.slots.delete(index);
  }

  /** Read pads once, edge-detect against the previous poll and emit Amiga actions. */
  poll() {
    const pads = this.getPads();
    const seen = new Set<number>();
    const physicalAll = new Set<string>();
    let name = "";
    const half = this.opts.autofireHalfPeriod ?? 3;

    for (let i = 0; i < pads.length; i++) {
      const pad = pads[i];
      if (!pad || !pad.connected) continue;
      seen.add(pad.index);
      name = name || vendorLabel(pad.id);
      let slot = this.slots.get(pad.index);
      if (!slot) { slot = { prevButtons: [], emitted: new Set(), fireTicks: 0, id: pad.id }; this.slots.set(pad.index, slot); }

      const m = this.mapping;
      const pressed = pad.buttons.map((b) => b.pressed || b.value > 0.5);
      const edge = (n: number | null) => n !== null && pressed[n] === true && !slot!.prevButtons[n];
      if (edge(m.autofireToggleButton)) this.mapping = { ...m, autofire: !m.autofire };

      const want = new Set<AmigaAction>();
      for (const a of AMIGA_ACTIONS) if (pressed[this.mapping.buttons[a]]) want.add(a);
      if (this.mapping.stick) {
        const x = pad.axes[0] ?? 0, y = pad.axes[1] ?? 0, dz = this.mapping.deadzone;
        if (x < -dz) want.add("left"); else if (x > dz) want.add("right");
        if (y < -dz) want.add("up"); else if (y > dz) want.add("down");
      }
      for (const a of want) physicalAll.add(a);

      const out = new Set(want);
      if (this.mapping.autofire && want.has("fire")) {
        out.delete("fire");
        if (Math.floor(slot.fireTicks / half) % 2 === 0) out.add("fire");
        slot.fireTicks++;
      } else slot.fireTicks = 0;

      for (const a of AMIGA_ACTIONS) {
        const was = slot.emitted.has(a), now = out.has(a);
        if (now !== was) this.opts.onAction(a, now, pad.id);
      }
      slot.emitted = out;
      slot.prevButtons = pressed;
    }
    for (const idx of [...this.slots.keys()]) if (!seen.has(idx)) this.release(idx);
    this.publish(name, physicalAll);
  }

  private publish(name = "", physical: ReadonlySet<string> = new Set()) {
    const connected = this.slots.size > 0;
    const next: GamepadState = { connected, name: connected ? name || this.last.name : "", physical, autofire: this.mapping.autofire };
    const l = this.last;
    const same = l.connected === next.connected && l.name === next.name && l.autofire === next.autofire &&
      l.physical.size === next.physical.size && [...next.physical].every((p) => l.physical.has(p));
    this.last = next;
    if (!same) this.opts.onChange?.(next);
  }
}
