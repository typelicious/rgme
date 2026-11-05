import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { useEffect, useRef, useState } from "react";
import { Commodore1084sBezel } from "../components/Commodore1084sBezel";
import { COLLAPSE_MS, DEGAUSS_MS, WARM_MS, initialState, ledColor, reduce } from "../lib/bezel";

describe("bezel state machine", () => {
  it("power off collapses, then turns off; power on warms up, then turns on", () => {
    let s = initialState(true);
    expect(s).toEqual({ power: "on", degauss: "idle" });
    s = reduce(s, { type: "POWER_OFF" });
    expect(s.power).toBe("collapsing");
    s = reduce(s, { type: "TIMER_DONE" });
    expect(s.power).toBe("off");
    s = reduce(s, { type: "POWER_ON" });
    expect(s.power).toBe("warming");
    s = reduce(s, { type: "TIMER_DONE" });
    expect(s.power).toBe("on");
  });
  it("power can interrupt a collapse, and no-ops are stable", () => {
    let s = reduce(initialState(true), { type: "POWER_OFF" });
    expect(reduce(s, { type: "POWER_OFF" })).toBe(s);
    s = reduce(s, { type: "POWER_ON" });
    expect(s.power).toBe("warming");
    expect(reduce(s, { type: "POWER_ON" })).toBe(s);
    expect(reduce(initialState(true), { type: "TIMER_DONE" }).power).toBe("on");
  });
  it("degauss only while on, cancelled by power off", () => {
    expect(reduce(initialState(false), { type: "DEGAUSS_START" }).degauss).toBe("idle");
    let s = reduce(initialState(true), { type: "DEGAUSS_START" });
    expect(s.degauss).toBe("active");
    s = reduce(s, { type: "POWER_OFF" });
    expect(s.degauss).toBe("idle");
    expect(reduce(s, { type: "DEGAUSS_END" })).toBe(s);
  });
  it("LED colours", () => {
    expect(ledColor("on")).toBe("green");
    expect(ledColor("warming")).toBe("amber");
    expect(ledColor("off")).toBe("off");
    expect(ledColor("collapsing")).toBe("off");
  });
});

describe("Commodore1084sBezel", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    Object.defineProperty(document, "fullscreenElement", { configurable: true, value: null });
  });

  const bezel = () => screen.getByTestId("bezel");

  it("uncontrolled: power switch runs collapse -> off -> warming -> on and drives the LED", () => {
    const onPower = vi.fn();
    render(<Commodore1084sBezel onPowerChange={onPower}><div data-testid="child" /></Commodore1084sBezel>);
    expect(bezel()).toHaveAttribute("data-power", "on");
    expect(screen.getByTestId("bezel-led")).toHaveAttribute("data-led", "green");
    expect(screen.getByTestId("bezel-power")).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByTestId("bezel-power"));
    expect(onPower).toHaveBeenLastCalledWith(false);
    expect(bezel()).toHaveAttribute("data-power", "collapsing");
    expect(screen.getByTestId("bezel-led")).toHaveAttribute("data-led", "off");
    act(() => void vi.advanceTimersByTime(COLLAPSE_MS));
    expect(bezel()).toHaveAttribute("data-power", "off");
    expect(screen.getByTestId("bezel-power")).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(screen.getByTestId("bezel-power"));
    expect(onPower).toHaveBeenLastCalledWith(true);
    expect(bezel()).toHaveAttribute("data-power", "warming");
    expect(screen.getByTestId("bezel-led")).toHaveAttribute("data-led", "amber");
    act(() => void vi.advanceTimersByTime(WARM_MS));
    expect(bezel()).toHaveAttribute("data-power", "on");
    expect(screen.getByTestId("bezel-led")).toHaveAttribute("data-led", "green");
  });

  it("children stay mounted (same DOM node, effects keep running) while powered off", () => {
    const tick = vi.fn();
    function Child() {
      const ref = useRef<HTMLDivElement>(null);
      const [, set] = useState(0);
      useEffect(() => {
        const id = setInterval(() => { tick(); set((n) => n + 1); }, 20);
        return () => clearInterval(id);
      }, []);
      return <div ref={ref} data-testid="child" />;
    }
    render(<Commodore1084sBezel defaultPowered={false}><Child /></Commodore1084sBezel>);
    const node = screen.getByTestId("child");
    expect(bezel()).toHaveAttribute("data-power", "off");
    act(() => void vi.advanceTimersByTime(100));
    expect(tick.mock.calls.length).toBeGreaterThanOrEqual(4);
    expect(screen.getByTestId("child")).toBe(node);
    fireEvent.click(screen.getByTestId("bezel-power"));
    act(() => void vi.advanceTimersByTime(WARM_MS));
    expect(screen.getByTestId("child")).toBe(node);
  });

  it("controlled power follows the prop and only reports requests", () => {
    const onPower = vi.fn();
    const { rerender } = render(<Commodore1084sBezel powered onPowerChange={onPower}><span /></Commodore1084sBezel>);
    fireEvent.click(screen.getByTestId("bezel-power"));
    expect(onPower).toHaveBeenCalledWith(false);
    expect(bezel()).toHaveAttribute("data-power", "on"); // parent has not changed the prop
    rerender(<Commodore1084sBezel powered={false} onPowerChange={onPower}><span /></Commodore1084sBezel>);
    expect(bezel()).toHaveAttribute("data-power", "collapsing");
    act(() => void vi.advanceTimersByTime(COLLAPSE_MS));
    expect(bezel()).toHaveAttribute("data-power", "off");
  });

  it("degauss shudders for ~1.2s, only while on", () => {
    render(<Commodore1084sBezel><span /></Commodore1084sBezel>);
    fireEvent.click(screen.getByTestId("bezel-degauss"));
    expect(bezel()).toHaveAttribute("data-degauss", "active");
    expect(screen.getByTestId("bezel-degauss")).toBeDisabled();
    act(() => void vi.advanceTimersByTime(DEGAUSS_MS));
    expect(bezel()).toHaveAttribute("data-degauss", "idle");

    fireEvent.click(screen.getByTestId("bezel-power"));
    expect(screen.getByTestId("bezel-degauss")).toBeDisabled();
    fireEvent.click(screen.getByTestId("bezel-degauss"));
    expect(bezel()).toHaveAttribute("data-degauss", "idle");
  });

  it("powering off during degauss cancels it", () => {
    render(<Commodore1084sBezel><span /></Commodore1084sBezel>);
    fireEvent.click(screen.getByTestId("bezel-degauss"));
    fireEvent.click(screen.getByTestId("bezel-power"));
    expect(bezel()).toHaveAttribute("data-degauss", "idle");
  });

  it("fullscreen uses the Fullscreen API on the bezel and exits again", async () => {
    render(<Commodore1084sBezel><span /></Commodore1084sBezel>);
    const req = vi.fn(async () => {});
    const exit = vi.fn(async () => {});
    (bezel() as unknown as { requestFullscreen: unknown }).requestFullscreen = req;
    (document as unknown as { exitFullscreen: unknown }).exitFullscreen = exit;
    await act(async () => { fireEvent.click(screen.getByTestId("bezel-fullscreen")); });
    expect(req).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, "fullscreenElement", { configurable: true, value: bezel() });
    act(() => void document.dispatchEvent(new Event("fullscreenchange")));
    expect(bezel()).toHaveAttribute("data-fullscreen", "true");
    await act(async () => { fireEvent.click(screen.getByTestId("bezel-fullscreen")); });
    expect(exit).toHaveBeenCalledTimes(1);
    Object.defineProperty(document, "fullscreenElement", { configurable: true, value: null });
    act(() => void document.dispatchEvent(new Event("fullscreenchange")));
    expect(bezel()).toHaveAttribute("data-fullscreen", "false");
  });

  it("falls back to CSS pseudo-fullscreen when the API is unsupported or rejected; Escape leaves it", async () => {
    render(<Commodore1084sBezel><span /></Commodore1084sBezel>);
    await act(async () => { fireEvent.click(screen.getByTestId("bezel-fullscreen")); }); // jsdom: no requestFullscreen
    expect(bezel()).toHaveAttribute("data-fullscreen", "true");
    expect(bezel().className).toContain("rgme-bezel--pseudo-fs");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(bezel()).toHaveAttribute("data-fullscreen", "false");

    (bezel() as unknown as { requestFullscreen: unknown }).requestFullscreen = vi.fn(async () => { throw new Error("denied"); });
    await act(async () => { fireEvent.click(screen.getByTestId("bezel-fullscreen")); });
    expect(bezel().className).toContain("rgme-bezel--pseudo-fs");
    await act(async () => { fireEvent.click(screen.getByTestId("bezel-fullscreen")); });
    expect(bezel().className).not.toContain("rgme-bezel--pseudo-fs");
  });

  it("keeps a 4:3 screen and exposes accessible controls, brand-neutral badge", () => {
    render(<Commodore1084sBezel><span /></Commodore1084sBezel>);
    expect(screen.getByTestId("bezel-screen")).toBeInTheDocument();
    for (const name of ["Power", "Degauss", "Toggle fullscreen"]) expect(screen.getByRole("button", { name })).toBeInTheDocument();
    expect(screen.getByLabelText(/RGME stereo color monitor/i)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/commodore/i);
  });

  it("adds the reduced-motion class when the user prefers reduced motion", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce"), media: q, addEventListener: () => {}, removeEventListener: () => {} }));
    render(<Commodore1084sBezel><span /></Commodore1084sBezel>);
    expect(bezel().className).toContain("rgme-bezel--reduced");
    vi.unstubAllGlobals();
  });

  it("no reduced-motion class by default", () => {
    render(<Commodore1084sBezel><span /></Commodore1084sBezel>);
    expect(bezel().className).not.toContain("rgme-bezel--reduced");
  });
});
