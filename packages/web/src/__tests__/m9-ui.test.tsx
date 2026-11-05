// @vitest-environment jsdom
import "../test-setup.js";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CoreTelemetryHUD } from "../components/CoreTelemetryHUD";
import { KickstartModal } from "../components/KickstartModal";
import { KickstartRomStore, BUILTIN_AROS_META } from "@rgme/core";
import { createRuntime } from "../lib/runtime-factory";

describe("Milestone 9: CoreTelemetryHUD", () => {
  it("renders correctly in WASM mode with ROM badge and telemetry", () => {
    const onOpen = vi.fn();
    render(
      <CoreTelemetryHUD
        runtimeKind="wasm"
        state="RUNNING"
        frame={120}
        activeRomName="AROS Amiga 68k Compatibility ROM"
        onOpenRomSettings={onOpen}
      />
    );

    expect(screen.getByTestId("core-telemetry-hud")).toBeInTheDocument();
    expect(screen.getByText("WASM 68000 CORE")).toBeInTheDocument();
    expect(screen.getByText("RUNNING")).toBeInTheDocument();
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getByText("AROS Amiga 68k Compatibility ROM")).toBeInTheDocument();

    const btn = screen.getByTestId("open-rom-modal-btn");
    fireEvent.click(btn);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("renders in mock mode without ROM settings button", () => {
    render(
      <CoreTelemetryHUD
        runtimeKind="mock"
        state="LOADED"
        frame={0}
      />
    );

    expect(screen.getByText("MOCK ARCADE")).toBeInTheDocument();
    expect(screen.getByText("LOADED")).toBeInTheDocument();
    expect(screen.queryByTestId("open-rom-modal-btn")).not.toBeInTheDocument();
  });
});

describe("Milestone 9: KickstartModal", () => {
  it("renders modal with built-in AROS ROM and handles closing", async () => {
    const store = new KickstartRomStore();
    const onClose = vi.fn();

    render(
      <KickstartModal
        open={true}
        onClose={onClose}
        store={store}
      />
    );

    expect(screen.getByText("Kickstart ROM Management")).toBeInTheDocument();
    expect(screen.getByTestId(`rom-item-${BUILTIN_AROS_META.id}`)).toBeInTheDocument();
    expect(screen.getByText("AROS Amiga 68k Compatibility ROM")).toBeInTheDocument();
    expect(screen.getByText("Built-in Clean")).toBeInTheDocument();

    const closeBtn = screen.getByTestId("close-rom-modal-btn");
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("Milestone 9: Runtime Factory with WASM Amiga Core", () => {
  it("creates a WasmAmigaAdapter when kind is wasm", () => {
    const adapter = createRuntime("wasm", null);
    expect(adapter).toBeDefined();
    expect(adapter.identifyCapabilities().id).toBe("wasm-amiga");
    expect(adapter.identifyCapabilities().name).toContain("WASM Amiga");
  });
});
