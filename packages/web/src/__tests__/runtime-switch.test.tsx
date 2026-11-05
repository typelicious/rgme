import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MockRuntimeAdapter, WasmAmigaAdapter, WasmCoreUnavailableError, bytesLoader, type GameProfile } from "@rgme/core";
import { RuntimeSwitch } from "../components/RuntimeSwitch";
import { MediaRegistry, createRuntime, disposeRuntime } from "../lib/runtime-factory";
import { buildProfileFromFile } from "../lib/profile";

const SHA = "c".repeat(64);
const profile = (): GameProfile => buildProfileFromFile("t.adf", SHA);

describe("RuntimeSwitch", () => {
  it("shows the selection, notes the reference core and reports changes", () => {
    const onChange = vi.fn();
    const { rerender } = render(<RuntimeSwitch kind="mock" onChange={onChange} />);
    expect(screen.getByTestId("runtime-mock")).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByTestId("runtime-wasm"));
    expect(onChange).toHaveBeenCalledWith("wasm");
    fireEvent.click(screen.getByTestId("runtime-mock")); // already selected: no event
    expect(onChange).toHaveBeenCalledTimes(1);
    rerender(<RuntimeSwitch kind="wasm" onChange={onChange} />);
    expect(screen.getByTestId("runtime-note")).toHaveTextContent(/reference core/i);
    expect(screen.getByTestId("runtime-note")).toHaveTextContent(/not an emulator/i);
  });
  it("disables the WASM option with an explanation", () => {
    const onChange = vi.fn();
    render(<RuntimeSwitch kind="mock" onChange={onChange} disabledWasmReason="WebAssembly unavailable" />);
    const b = screen.getByTestId("runtime-wasm");
    expect(b).toBeDisabled();
    expect(b).toHaveAttribute("title", "WebAssembly unavailable");
    fireEvent.click(b);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("runtime factory", () => {
  it("creates the requested adapter kind", () => {
    expect(createRuntime("mock", null)).toBeInstanceOf(MockRuntimeAdapter);
    expect(createRuntime("vamiga", null).identifyCapabilities().id).toBe("vamiga");
    expect(createRuntime("puae", null).identifyCapabilities().id).toBe("puae");
    expect(createRuntime("preview", null).identifyCapabilities().id).toBe("preview");
    const w = createRuntime("wasm", null);
    expect(w).toBeInstanceOf(WasmAmigaAdapter);
    expect(w.identifyCapabilities().id).toBe("wasm-amiga");
  });

  it("switches mock -> wasm on the same profile and keeps playing from the registry bytes", async () => {
    const media = new MediaRegistry();
    const bytes = new Uint8Array(901120);
    bytes.set([68, 79, 83, 0]);
    media.register(SHA.toUpperCase(), bytes); // case-insensitive
    const p = profile();

    const mock = createRuntime("mock", null);
    await mock.loadGame(p);
    mock.start();
    disposeRuntime(mock);

    const wasm = createRuntime("wasm", null, { media }) as WasmAmigaAdapter;
    await wasm.loadGame(p);
    wasm.start();
    wasm.stepFrame();
    expect(wasm.state).toBe("RUNNING");
    expect(wasm.currentFrame).toBe(1);
    disposeRuntime(wasm);
    expect(wasm.state).toBe("UNLOADED");
  });

  it("fails loudly (never fakes emulation) when the core or the media is unavailable", async () => {
    const noCore = createRuntime("wasm", null, { loader: bytesLoader(new Uint8Array([9])) });
    await expect(noCore.loadGame(profile())).rejects.toBeInstanceOf(WasmCoreUnavailableError);
    const noMedia = createRuntime("wasm", null);
    await expect(noMedia.loadGame(profile())).rejects.toThrow(/No bytes registered/);
  });
});
