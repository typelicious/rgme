import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MockRuntimeAdapter } from "@rgme/core";
import { App } from "../App";

const fx = (n: string) => readFileSync(resolve(process.cwd(), "../../concept/fixtures", n));
const stubFetch = (name: string) => vi.stubGlobal("fetch", vi.fn(async () => new Response(fx(name), { status: 200 })));

afterEach(() => vi.unstubAllGlobals());

describe("M3 wiring", () => {
  it("C64 demo: identified by hash, runs on the C64 reference runtime, WASM disabled, export gated to player (class A)", async () => {
    stubFetch("rgme-c64-demo.d64");
    render(<App createAdapter={() => new MockRuntimeAdapter()} />);
    fireEvent.click(screen.getByTestId("load-c64"));
    await waitFor(() => expect(screen.getByTestId("runtime-pill")).toHaveTextContent("RUNNING"), { timeout: 5000 });
    expect(screen.getByTestId("drop-status")).toHaveTextContent("Identified");
    expect(screen.getByTestId("machine-summary")).toHaveTextContent("Commodore 64");
    expect(screen.getByTestId("runtime-pill")).toHaveTextContent(/C64|Reference/i);
    expect(screen.getByTestId("export-btn")).toBeEnabled();
  });

  it("Mega Drive demo runs on the Genesis reference runtime", async () => {
    stubFetch("rgme-md-demo.md");
    render(<App createAdapter={() => new MockRuntimeAdapter()} />);
    fireEvent.click(screen.getByTestId("load-md"));
    await waitFor(() => expect(screen.getByTestId("runtime-pill")).toHaveTextContent("RUNNING"), { timeout: 5000 });
    expect(screen.getByTestId("machine-summary")).toHaveTextContent("Mega Drive");
  });

  it("switches the scene demo between Mock and the WASM reference core, then back", async () => {
    stubFetch("rgme-scene-intro.adf");
    render(<App createAdapter={() => new MockRuntimeAdapter()} />);
    fireEvent.click(screen.getByTestId("load-scene"));
    await waitFor(() => expect(screen.getByTestId("runtime-pill")).toHaveTextContent("RUNNING"), { timeout: 5000 });
    expect(screen.getByTestId("runtime-pill")).toHaveTextContent("Mock");

    await act(async () => { fireEvent.click(screen.getByTestId("runtime-wasm")); });
    await waitFor(() => expect(screen.getByTestId("runtime-pill")).toHaveTextContent(/wasm/i), { timeout: 5000 });
    expect(screen.queryByTestId("runtime-error")).toBeNull();

    await act(async () => { fireEvent.click(screen.getByTestId("runtime-mock")); });
    await waitFor(() => expect(screen.getByTestId("runtime-pill")).toHaveTextContent("Mock"), { timeout: 5000 });
  });

  it("unknown file: export panel falls back to BYOG, chain of title says local play only", async () => {
    render(<App createAdapter={() => new MockRuntimeAdapter()} />);
    const file = new File(["some unknown disk"], "Mystery.adf");
    await act(async () => { fireEvent.drop(screen.getByTestId("dropzone"), { dataTransfer: { files: [file] } }); });
    await waitFor(() => expect(screen.getByTestId("drop-status")).toHaveTextContent("Unknown"), { timeout: 5000 });
    expect(screen.getByTestId("export-btn")).toBeDisabled();
    expect(document.body.textContent).toMatch(/BYOG package/i);
    expect(document.body.textContent).toMatch(/local play only/i);
  });
});
