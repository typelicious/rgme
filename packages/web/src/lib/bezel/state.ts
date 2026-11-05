/** Pure state machine for the monitor bezel. No timers here: the component schedules TIMER_DONE / DEGAUSS_END. */

export type PowerPhase = "on" | "off" | "warming" | "collapsing";
export type DegaussPhase = "idle" | "active";

export interface BezelState {
  power: PowerPhase;
  degauss: DegaussPhase;
}

export type BezelEvent =
  | { type: "POWER_ON" }
  | { type: "POWER_OFF" }
  | { type: "TIMER_DONE" }
  | { type: "DEGAUSS_START" }
  | { type: "DEGAUSS_END" };

/** Animation lengths in ms (kept in sync with bezel.css custom properties). */
export const WARM_MS = 900;
export const COLLAPSE_MS = 900; // squash to line, line to dot, ~600ms phosphor afterglow overlaps the tail
export const DEGAUSS_MS = 1200;

export const initialState = (powered: boolean): BezelState => ({ power: powered ? "on" : "off", degauss: "idle" });

export function reduce(s: BezelState, e: BezelEvent): BezelState {
  switch (e.type) {
    case "POWER_ON":
      return s.power === "off" || s.power === "collapsing" ? { ...s, power: "warming" } : s;
    case "POWER_OFF":
      return s.power === "on" || s.power === "warming" ? { power: "collapsing", degauss: "idle" } : s;
    case "TIMER_DONE":
      if (s.power === "warming") return { ...s, power: "on" };
      if (s.power === "collapsing") return { ...s, power: "off" };
      return s;
    case "DEGAUSS_START":
      return s.power === "on" && s.degauss === "idle" ? { ...s, degauss: "active" } : s;
    case "DEGAUSS_END":
      return s.degauss === "active" ? { ...s, degauss: "idle" } : s;
  }
}

/** Power LED colour: green when on, amber while warming, dark otherwise. */
export const ledColor = (p: PowerPhase): "green" | "amber" | "off" => (p === "on" ? "green" : p === "warming" ? "amber" : "off");

/** Whether the monitor is (or is becoming) powered. */
export const isPowered = (p: PowerPhase) => p === "on" || p === "warming";
