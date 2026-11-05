import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GamepadManager, detectVendor } from "../lib/gamepad/manager";
import { DEFAULT_GAMEPAD_MAPPING, loadMapping, saveMapping } from "../lib/gamepad/mapping";
import { ControllerHUD } from "../components/ControllerHUD";
import { RemapModal } from "../components/RemapModal";

function pad(over: { buttons?: number[]; axes?: number[]; index?: number; id?: string; connected?: boolean } = {}): Gamepad {
  const pressed = new Set(over.buttons ?? []);
  return {
    index: over.index ?? 0, id: over.id ?? "Xbox 360 Controller (STANDARD GAMEPAD)", connected: over.connected ?? true, mapping: "standard",
    axes: over.axes ?? [0, 0, 0, 0], timestamp: 0,
    buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.has(i), touched: false, value: pressed.has(i) ? 1 : 0 }))
  } as unknown as Gamepad;
}

function setup(mapping = { ...DEFAULT_GAMEPAD_MAPPING, buttons: { ...DEFAULT_GAMEPAD_MAPPING.buttons } }) {
  let current: (Gamepad | null)[] = [];
  const events: string[] = [];
  const target = new EventTarget();
  const m = new GamepadManager({
    getGamepads: () => current,
    target,
    mapping,
    onAction: (a, d) => events.push(`${a}:${d ? "down" : "up"}`)
  });
  m.start();
  return { m, events, target, set: (p: (Gamepad | null)[]) => { current = p; } };
}

describe("GamepadManager", () => {
  it("emits edge events for D-pad and face buttons (no repeats while held)", () => {
    const t = setup();
    t.set([pad({ buttons: [12, 0] })]);
    t.m.poll(); t.m.poll();
    expect(t.events).toEqual(["up:down", "fire:down"]);
    t.set([pad({ buttons: [0] })]);
    t.m.poll();
    expect(t.events).toEqual(["up:down", "fire:down", "up:up"]);
    expect(t.m.state.connected).toBe(true);
    expect(t.m.state.name).toBe("Xbox");
  });

  it("maps the left stick with a 0.4 deadzone", () => {
    const t = setup();
    t.set([pad({ axes: [0.39, -0.39] })]); t.m.poll();
    expect(t.events).toEqual([]);
    t.set([pad({ axes: [-0.8, 0.9] })]); t.m.poll();
    expect(t.events.sort()).toEqual(["down:down", "left:down"]);
    expect([...t.m.state.physical].sort()).toEqual(["down", "left"]);
  });

  it("releases held actions when the pad disappears or disconnects", () => {
    const t = setup();
    t.set([pad({ buttons: [15, 1] })]); t.m.poll();
    t.set([null]); t.m.poll();
    expect(t.events.filter((e) => e.endsWith("up")).sort()).toEqual(["fire2:up", "right:up"]);
    expect(t.m.state.connected).toBe(false);

    t.events.length = 0;
    t.set([pad({ buttons: [0] })]); t.m.poll();
    const ev = new Event("gamepaddisconnected") as Event & { gamepad: Gamepad };
    ev.gamepad = pad();
    t.target.dispatchEvent(ev);
    expect(t.events).toEqual(["fire:down", "fire:up"]);
  });

  it("honours remapping", () => {
    const t = setup({ ...DEFAULT_GAMEPAD_MAPPING, buttons: { ...DEFAULT_GAMEPAD_MAPPING.buttons, fire: 5 } });
    t.set([pad({ buttons: [0] })]); t.m.poll();
    expect(t.events).toEqual([]);
    t.set([pad({ buttons: [5] })]); t.m.poll();
    expect(t.events).toEqual(["fire:down"]);
  });

  it("autofire toggles with X and pulses fire while held", () => {
    const t = setup();
    t.set([pad({ buttons: [2] })]); t.m.poll(); // toggle on
    t.set([pad({ buttons: [] })]); t.m.poll();
    expect(t.m.state.autofire).toBe(true);
    t.set([pad({ buttons: [0] })]);
    for (let i = 0; i < 12; i++) t.m.poll();
    const downs = t.events.filter((e) => e === "fire:down").length;
    expect(downs).toBeGreaterThanOrEqual(2);
    expect(t.events.filter((e) => e === "fire:up").length).toBeGreaterThanOrEqual(1);
  });

  it("stop() releases everything and rumble is safe without an actuator", () => {
    const t = setup();
    t.set([pad({ buttons: [14] })]); t.m.poll();
    expect(() => t.m.rumble()).not.toThrow();
    t.m.stop();
    expect(t.events).toEqual(["left:down", "left:up"]);
  });

  it("rumble uses the dual-rumble effect when present", () => {
    const play = vi.fn(async () => undefined);
    const p = { ...pad(), vibrationActuator: { playEffect: play } } as unknown as Gamepad;
    const t = setup(); t.set([p]);
    t.m.rumble(50);
    expect(play).toHaveBeenCalledWith("dual-rumble", expect.objectContaining({ duration: 50 }));
  });
});

describe("vendor detection and mapping storage", () => {
  it("detects vendors", () => {
    expect(detectVendor("Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e)")).toBe("xbox");
    expect(detectVendor("DualSense Wireless Controller (Vendor: 054c)")).toBe("playstation");
    expect(detectVendor("8BitDo Pro 2 (Vendor: 2dc8)")).toBe("8bitdo");
    expect(detectVendor("USB Gamepad")).toBe("generic");
  });
  it("round-trips and validates stored mappings", () => {
    const mem: Record<string, string> = {};
    const st = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => void (mem[k] = v) };
    const m = { ...DEFAULT_GAMEPAD_MAPPING, autofire: true };
    saveMapping(m, st);
    expect(loadMapping(st).autofire).toBe(true);
    mem["rgme.gamepad.mapping"] = "{broken";
    expect(loadMapping(st)).toEqual(DEFAULT_GAMEPAD_MAPPING);
    mem["rgme.gamepad.mapping"] = JSON.stringify({ buttons: { up: -3 } });
    expect(loadMapping(st)).toEqual(DEFAULT_GAMEPAD_MAPPING);
  });
});

describe("UI", () => {
  it("HUD shows physical presses and gamepad name, still works without them", () => {
    const { rerender } = render(<ControllerHUD active={new Set()} press={() => {}} />);
    expect(screen.getByTestId("hud-fire")).toHaveAttribute("data-physical", "false");
    expect(screen.queryByTestId("hud-gamepad")).toBeNull();
    rerender(<ControllerHUD active={new Set(["fire"])} press={() => {}} physical={new Set(["fire"])} gamepadName="Xbox" />);
    expect(screen.getByTestId("hud-fire")).toHaveAttribute("data-physical", "true");
    expect(screen.getByTestId("hud-up")).toHaveAttribute("data-physical", "false");
    expect(screen.getByTestId("hud-gamepad")).toHaveTextContent("Xbox");
  });
  it("RemapModal edits the mapping", () => {
    const onChange = vi.fn();
    render(<RemapModal open mapping={DEFAULT_GAMEPAD_MAPPING} onChange={onChange} onClose={() => {}} />);
    fireEvent.change(screen.getByTestId("remap-fire"), { target: { value: "5" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ buttons: expect.objectContaining({ fire: 5 }) }));
    fireEvent.click(screen.getByTestId("remap-autofire"));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ autofire: true }));
  });
  it("RemapModal renders nothing when closed", () => {
    render(<RemapModal open={false} mapping={DEFAULT_GAMEPAD_MAPPING} onChange={() => {}} onClose={() => {}} />);
    expect(screen.queryByTestId("remap-modal")).toBeNull();
  });
});
