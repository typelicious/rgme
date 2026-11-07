import { describe, it, expect, vi } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MockRuntimeAdapter } from "@rgme/core";
import { App } from "../App";

describe("INTEG-001 web demonstrator", () => {
  it("demo profile launches on the mock runtime, local play allowed, export blocked, keyboard drives HUD", async () => {
    const adapter = new MockRuntimeAdapter();
    render(<App createAdapter={() => adapter} />);

    fireEvent.click(screen.getByTestId("load-demo"));
    await waitFor(() => expect(adapter.state).toBe("RUNNING"));
    expect(screen.getByTestId("runtime-pill")).toHaveTextContent("RUNNING");

    // Rights: local execution evidenced, redistribution still not verified.
    expect(screen.getByTestId("badge-private_execution")).toHaveAttribute("data-tone", "cleared");
    expect(screen.getByTestId("badge-binary_redistribution")).toHaveAttribute("data-tone", "restricted");
    expect(screen.getByTestId("export-btn")).toBeDisabled();
    expect(screen.getByTestId("share-btn")).toBeDisabled();

    // Keyboard -> Amiga joystick -> adapter + HUD
    fireEvent.keyDown(window, { code: "ArrowLeft" });
    fireEvent.keyDown(window, { code: "Space" });
    await waitFor(() => expect(screen.getByTestId("hud-fire")).toHaveAttribute("data-active", "true"));
    expect(adapter.activeInputs).toEqual(["fire", "left"]);
    fireEvent.keyUp(window, { code: "ArrowLeft" });
    fireEvent.keyUp(window, { code: "Space" });
    await waitFor(() => expect(adapter.activeInputs).toEqual([]));

    // Frames advance while running, save/load work
    const f = adapter.currentFrame;
    adapter.tick();
    expect(adapter.currentFrame).toBe(f + 1);
    fireEvent.click(screen.getByText("Save"));
    adapter.tick();
    fireEvent.click(screen.getByText("Load"));
    expect(adapter.currentFrame).toBe(f + 1);
    adapter.stop();
  });
});

describe("Scene demo (rgme-scene-intro.adf)", () => {
  const adfPath = existsSync(resolve(process.cwd(), "concept/fixtures/rgme-scene-intro.adf"))
    ? resolve(process.cwd(), "concept/fixtures/rgme-scene-intro.adf")
    : resolve(process.cwd(), "../../concept/fixtures/rgme-scene-intro.adf");

  it("Load Scene Demo identifies the real ADF by hash (Class A / public domain), launches the intro scene with audio sink", async () => {
    const bytes = readFileSync(adfPath);
    const fetchMock = vi.fn(async () => new Response(bytes, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const calls: string[] = [];
    const audio = { start: () => void calls.push("start"), pause: () => void calls.push("pause"), stop: () => void calls.push("stop"), setMuted: (m: boolean) => void calls.push(`mute:${m}`) };
    const adapter = new MockRuntimeAdapter(undefined, undefined, audio);
    render(<App createAdapter={() => adapter} />);

    fireEvent.click(screen.getByTestId("load-scene"));
    await waitFor(() => expect(adapter.state).toBe("RUNNING"), { timeout: 5000 });
    expect(screen.getByTestId("drop-status")).toHaveTextContent("Identified");
    expect(screen.getByTestId("drop-hash")).toHaveTextContent("16e02d77f501");
    expect(screen.getByTestId("badge-private_execution")).toHaveAttribute("data-tone", "cleared");
    expect(screen.getByTestId("badge-binary_redistribution")).toHaveAttribute("data-tone", "cleared");
    expect(screen.getByTestId("export-btn")).toBeEnabled();
    expect(calls).toContain("start");

    fireEvent.click(screen.getByTestId("mute-btn"));
    expect(calls).toContain("mute:true");
    adapter.stop();
    vi.unstubAllGlobals();
  });

  it("dropping the same ADF under another name is still identified; a different file is Unknown and export stays blocked", async () => {
    const adapter = new MockRuntimeAdapter();
    render(<App createAdapter={() => adapter} />);
    const real = new File([readFileSync(adfPath)], "copy-of-disk.adf");
    await act(async () => { fireEvent.drop(screen.getByTestId("dropzone"), { dataTransfer: { files: [real] } }); });
    await waitFor(() => expect(screen.getByTestId("drop-status")).toHaveTextContent("Identified"), { timeout: 5000 });

    const fake = new File(["not the scene"], "rgme-scene-intro.adf");
    await act(async () => { fireEvent.drop(screen.getByTestId("dropzone"), { dataTransfer: { files: [fake] } }); });
    await waitFor(() => expect(screen.getByTestId("drop-status")).toHaveTextContent("Unknown"), { timeout: 5000 });
    expect(screen.getByTestId("export-btn")).toBeDisabled();
  });
});
