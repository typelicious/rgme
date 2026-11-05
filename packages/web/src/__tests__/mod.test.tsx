import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { ModError } from "@rgme/core";
import { ModPlayerPanel, type ModPlayerLike } from "../components/ModPlayerPanel";

const demo = () => new Uint8Array(readFileSync(resolve(process.cwd(), "../../concept/fixtures/rgme-demo.mod")));

function fake(over: Partial<ModPlayerLike> = {}) {
  const calls: string[] = [];
  let title = "";
  const p: ModPlayerLike = {
    load: (b) => { if (b.length < 1084) throw new ModError("File too small to be a ProTracker module."); title = "FAKE TUNE"; calls.push("load"); },
    start: () => void calls.push("start"),
    pause: () => void calls.push("pause"),
    stop: () => void calls.push("stop"),
    setVolume: (v) => void calls.push(`vol:${v}`),
    get title() { return title; },
    positionInfo: () => ({ order: 1, pattern: 2, row: 7, tick: 0 }),
    ...over
  };
  return { p, calls };
}

afterEach(() => vi.useRealTimers());

describe("ModPlayerPanel", () => {
  it("shows an empty state, then loads bytes and plays/pauses/stops", async () => {
    const { p, calls } = fake();
    const { rerender } = render(<ModPlayerPanel createPlayer={() => p} />);
    expect(screen.getByTestId("mod-title")).toHaveTextContent("No module loaded");
    expect(screen.getByTestId("mod-play")).toBeDisabled();

    rerender(<ModPlayerPanel bytes={demo()} createPlayer={() => p} />);
    await waitFor(() => expect(screen.getByTestId("mod-title")).toHaveTextContent("FAKE TUNE"));
    expect(screen.getByTestId("mod-play")).toBeEnabled();

    vi.useFakeTimers();
    fireEvent.click(screen.getByTestId("mod-play"));
    expect(calls).toContain("start");
    act(() => { vi.advanceTimersByTime(150); });
    expect(screen.getByTestId("mod-position")).toHaveTextContent("Order 01 · Pattern 02 · Row 07");
    expect(screen.getByTestId("mod-pause")).toBeEnabled();
    fireEvent.click(screen.getByTestId("mod-pause"));
    expect(calls).toContain("pause");
    fireEvent.click(screen.getByTestId("mod-stop"));
    expect(calls.filter((c) => c === "stop").length).toBeGreaterThan(0);
    expect(screen.getByTestId("mod-position")).toHaveTextContent("Row --");
  });

  it("volume slider forwards to the player", async () => {
    const { p, calls } = fake();
    render(<ModPlayerPanel bytes={demo()} createPlayer={() => p} />);
    await waitFor(() => expect(screen.getByTestId("mod-play")).toBeEnabled());
    fireEvent.change(screen.getByTestId("mod-volume"), { target: { value: "0.3" } });
    expect(calls).toContain("vol:0.3");
  });

  it("shows a graceful error for files that fail to parse", async () => {
    const { p } = fake();
    render(<ModPlayerPanel createPlayer={() => p} />);
    const file = new File([new Uint8Array(20)], "broken.mod");
    await act(async () => { fireEvent.change(screen.getByTestId("mod-file"), { target: { files: [file] } }); });
    await waitFor(() => expect(screen.getByTestId("mod-error")).toHaveTextContent(/too small/i));
    expect(screen.getByTestId("mod-title")).toHaveTextContent("No module loaded");
    expect(screen.getByTestId("mod-play")).toBeDisabled();
  });

  it("loads a dropped .mod file and falls back to the file name when the module has no title", async () => {
    const { p } = fake();
    p.load = () => {};
    render(<ModPlayerPanel createPlayer={() => p} />);
    const file = new File([demo()], "cool-tune.mod");
    await act(async () => { fireEvent.change(screen.getByTestId("mod-file"), { target: { files: [file] } }); });
    await waitFor(() => expect(screen.getByTestId("mod-title")).toHaveTextContent("cool-tune"));
  });

  it("surfaces start() errors without crashing", async () => {
    const { p } = fake({ start: () => { throw new ModError("No module loaded."); } });
    render(<ModPlayerPanel bytes={demo()} createPlayer={() => p} />);
    await waitFor(() => expect(screen.getByTestId("mod-play")).toBeEnabled());
    fireEvent.click(screen.getByTestId("mod-play"));
    expect(screen.getByTestId("mod-error")).toHaveTextContent("No module loaded.");
  });
});
