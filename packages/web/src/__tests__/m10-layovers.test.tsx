import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MockRuntimeAdapter, FREEWARE_CLASSICS, createClassicMultiDiskProfile } from "@rgme/core";
import { DEMO_PROFILE, DEMO_RIGHTS } from "../samples/demo";
import { App } from "../App";
import { MediaRegistry, createRuntime } from "../lib/runtime-factory";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Milestone 10: Layovers, Centered Layout & WASM Core Resilience", () => {
  it("M10-WASM-001: MediaRegistry provides bootable synthetic ADF for unmounted disks without throwing", async () => {
    const registry = new MediaRegistry(true);
    const bootMedia = { id: "disk1", kind: "adf" as const, sha256: "ba55000000000000000000000000000000000000000000000000000000000001", filename: "Beneath a Steel Sky (Disk 1 of 15).adf" };
    
    // Should NOT throw "No bytes registered"
    const bytes = await registry.provider(bootMedia);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBe(901120);
    // Standard Amiga DOS header 'DOS\0'
    expect(bytes[0]).toBe(0x44); // 'D'
    expect(bytes[1]).toBe(0x4f); // 'O'
    expect(bytes[2]).toBe(0x53); // 'S'
    expect(bytes[3]).toBe(0x00);
  });

  it("M10-WASM-002: WasmAmigaAdapter loads multi-disk freeware classics using synthetic fallback", async () => {
    const registry = new MediaRegistry(true);
    const canvas = document.createElement("canvas");
    const adapter = createRuntime("wasm", canvas, { media: registry });

    const classic = FREEWARE_CLASSICS[0]!; // Beneath a Steel Sky
    const profile = createClassicMultiDiskProfile(classic);

    await expect(adapter.loadGame(profile)).resolves.not.toThrow();
    expect(adapter.state).toBe("LOADED");
    adapter.start();
    expect(adapter.state).toBe("RUNNING");
    adapter.stop();
    expect(adapter.state).toBe("STOPPED");
  });

  it("M10-DRAWER-001: SidebarDrawer opens and closes via triggers", async () => {
    render(<App createAdapter={() => new MockRuntimeAdapter()} />);

    const drawerPane = screen.getByTestId("sidebar-drawer-pane");
    const drawerContainer = screen.getByTestId("sidebar-drawer-container");
    expect(drawerContainer).toHaveClass("hidden");

    // Click header drawer trigger (positioned to the left of the WASM Core menu)
    fireEvent.click(screen.getByTestId("sidebar-toggle-btn"));
    expect(drawerContainer).not.toHaveClass("hidden");

    // Close via drawer close button
    fireEvent.click(screen.getByTestId("close-sidebar-btn"));
    expect(drawerContainer).toHaveClass("hidden");

    // Reopen via header drawer trigger
    fireEvent.click(screen.getByTestId("sidebar-toggle-btn"));
    expect(drawerContainer).not.toHaveClass("hidden");

    // Close via backdrop click
    fireEvent.click(screen.getByTestId("sidebar-drawer-backdrop"));
    expect(drawerContainer).toHaveClass("hidden");
  });

  it("M10-ORDER-001: Lower content sections follow the exact order: 1) Library, 2) Player, 3) Chain", () => {
    const { container } = render(<App createAdapter={() => new MockRuntimeAdapter()} />);
    const sections = Array.from(container.querySelectorAll("section[aria-label]"));
    const labels = sections.map((s) => s.getAttribute("aria-label"));

    // Find indices of the three main lower sections
    const libraryIdx = labels.indexOf("Game library");
    const playerIdx = labels.indexOf("Tracker player");
    const chainIdx = labels.indexOf("Chain of title");

    expect(libraryIdx).toBeGreaterThanOrEqual(0);
    expect(playerIdx).toBeGreaterThanOrEqual(0);
    expect(chainIdx).toBeGreaterThanOrEqual(0);

    // Assert exact order: Library -> Player -> Chain
    expect(libraryIdx).toBeLessThan(playerIdx);
    expect(playerIdx).toBeLessThan(chainIdx);
  });

  it("M10-CRT-001: CRT scanlines toggle and popover operate from top-right corner of monitor", async () => {
    render(<App createAdapter={() => new MockRuntimeAdapter()} />);

    // Trigger in corner exists
    const crtBtn = screen.getByTestId("crt-corner-trigger");
    expect(crtBtn).toBeInTheDocument();
    expect(screen.queryByTestId("crt-layover-panel")).toBeNull();

    // Toggle CRT on
    fireEvent.click(crtBtn);
    expect(crtBtn).toHaveAttribute("aria-pressed", "true");

    // Open settings popover
    fireEvent.click(screen.getByTestId("crt-menu-toggle-btn"));
    expect(screen.getByTestId("crt-layover-panel")).toBeInTheDocument();
    expect(screen.getByTestId("crt-controls")).toBeInTheDocument();

    // Close popover
    fireEvent.click(screen.getByTestId("crt-layover-close-btn"));
    expect(screen.queryByTestId("crt-layover-panel")).toBeNull();
  });

  it("M10-REMOTE-001: FloatingRemoteControl provides directional D-Pad and minimizes to bottom-right", () => {
    render(<App createAdapter={() => new MockRuntimeAdapter()} />);

    expect(screen.getByTestId("floating-remote-control")).toBeInTheDocument();
    expect(screen.queryByTestId("remote-minimized-pill")).toBeNull();

    // Minimize remote
    fireEvent.click(screen.getByTestId("minimize-remote-btn"));
    expect(screen.queryByTestId("floating-remote-control")).toBeNull();

    const minimizedPill = screen.getByTestId("remote-minimized-pill");
    expect(minimizedPill).toBeInTheDocument();

    // Restore remote
    fireEvent.click(minimizedPill);
    expect(screen.getByTestId("floating-remote-control")).toBeInTheDocument();
  });
});
