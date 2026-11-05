import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MockRuntimeAdapter } from "@rgme/core";
import { App } from "../App";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Milestone 6 Integration & Features", () => {
  it("M6-MONITOR-001: Viewport container renders with height-constrained class", () => {
    const { container } = render(<App createAdapter={() => new MockRuntimeAdapter()} />);
    const viewportBox = container.querySelector(".rgme-viewport-container");
    expect(viewportBox).toBeInTheDocument();
  });

  it("M6-LIFECYCLE-001: Demo can be loaded and cleanly unloaded via button or central toolbar", async () => {
    render(<App createAdapter={() => new MockRuntimeAdapter()} />);

    // Load demo
    fireEvent.click(screen.getByTestId("load-demo"));
    await waitFor(() => {
      expect(screen.getByTestId("runtime-pill")).toHaveTextContent("RUNNING");
    });

    // Unload button should be enabled
    const unloadDemoBtn = screen.getByTestId("unload-demo");
    expect(unloadDemoBtn).not.toBeDisabled();

    // Central toolbar unload button should be enabled
    const centralUnloadBtn = screen.getByTestId("btn-unload");
    expect(centralUnloadBtn).not.toBeDisabled();

    // Click unload
    fireEvent.click(unloadDemoBtn);
    await waitFor(() => {
      expect(screen.getByTestId("runtime-pill")).toHaveTextContent("UNLOADED");
    });
    expect(centralUnloadBtn).toBeDisabled();
  });

  it("M6-GURU-001: Guru Meditation loads, renders, and reboots on canvas click or space", async () => {
    render(<App createAdapter={() => new MockRuntimeAdapter()} />);

    // Load Guru Meditation
    fireEvent.click(screen.getByTestId("load-guru"));
    await waitFor(() => {
      expect(screen.getByTestId("runtime-pill")).toHaveTextContent("RUNNING");
      expect(screen.getAllByText(/Guru Meditation/i).length).toBeGreaterThanOrEqual(1);
    });

    // Click canvas to trigger reboot
    const canvas = screen.getByTestId("canvas");
    fireEvent.click(canvas);

    await waitFor(() => {
      expect(screen.getByTestId("runtime-pill")).toHaveTextContent("UNLOADED");
    });
  });

  it("M6-PLAYABLE-001: Freeware Classics launch into interactive Amiga Boing engine", async () => {
    render(<App createAdapter={() => new MockRuntimeAdapter()} />);

    // Launch Lure of the Temptress from the shelf
    const launchBtn = screen.getByTestId("launch-lure-of-the-temptress");
    fireEvent.click(launchBtn);

    await waitFor(() => {
      expect(screen.getByTestId("runtime-pill")).toHaveTextContent("RUNNING");
    });

    // Central unload should cleanly eject
    fireEvent.click(screen.getByTestId("btn-unload"));
    await waitFor(() => {
      expect(screen.getByTestId("runtime-pill")).toHaveTextContent("UNLOADED");
    });
  });
});
