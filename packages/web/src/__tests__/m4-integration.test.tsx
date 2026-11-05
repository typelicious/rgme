import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MockRuntimeAdapter } from "@rgme/core";
import { App } from "../App";

const fx = (n: string) => readFileSync(resolve(process.cwd(), "../../concept/fixtures", n));
afterEach(() => vi.unstubAllGlobals());

describe("M4 wiring", () => {
  it("scene demo runs inside the 1084-style bezel; the partial 68000 runtime boots the bootblock and reports honestly where it stops", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(fx("rgme-scene-intro.adf"), { status: 200 })));
    render(<App createAdapter={() => new MockRuntimeAdapter()} />);
    expect(screen.getByTestId("bezel")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("load-scene"));
    await waitFor(() => expect(screen.getByTestId("runtime-pill")).toHaveTextContent("RUNNING"), { timeout: 8000 });

    // children stay mounted when the monitor is switched off
    const canvas = screen.getByTestId("canvas");
    fireEvent.click(screen.getByTestId("bezel-power"));
    expect(screen.getByTestId("canvas")).toBe(canvas);

    await act(async () => { fireEvent.click(screen.getByTestId("runtime-m68k")); });
    await waitFor(() => expect(screen.getByTestId("runtime-pill")).toHaveTextContent(/68000/i), { timeout: 8000 });
    expect(screen.getByTestId("runtime-note")).toHaveTextContent(/partial 68000/i);
  }, 40000);

  it("loads the demo tracker module into the player panel", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(fx("rgme-demo.mod"), { status: 200 })));
    render(<App createAdapter={() => new MockRuntimeAdapter()} />);
    fireEvent.click(screen.getByTestId("load-mod"));
    await waitFor(() => expect(document.body.textContent).toMatch(/RGME demo tune|M\.K\./i), { timeout: 5000 });
  });
});
