import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MockRuntimeAdapter } from "@rgme/core";
import { App } from "../App";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Master Reset Layover Button", () => {
  it("renders floating reset layover button in bottom right", () => {
    render(<App createAdapter={() => new MockRuntimeAdapter()} />);
    const resetBtn = screen.getByTestId("master-reset-overlay-btn");
    expect(resetBtn).toBeInTheDocument();
    expect(resetBtn).toHaveTextContent("Reset");
    expect(resetBtn).toHaveTextContent("↺");
    expect(resetBtn.className).toContain("fixed");
    expect(resetBtn.className).toContain("bottom-6");
    expect(resetBtn.className).toContain("right-6");
  });

  it("clicking reset overlay button restores engine and UI to clean initial start state", async () => {
    const mockAdapter = new MockRuntimeAdapter();
    const stopSpy = vi.spyOn(mockAdapter, "stop");

    render(<App createAdapter={() => mockAdapter} />);

    // Load a demo game first
    fireEvent.click(screen.getByTestId("load-demo"));
    await waitFor(() => expect(mockAdapter.state).toBe("RUNNING"));

    // Verify game is loaded
    expect(screen.getByTestId("runtime-pill")).toHaveTextContent("RUNNING");

    // Click Master Reset Layover button
    const resetBtn = screen.getByTestId("master-reset-overlay-btn");
    fireEvent.click(resetBtn);

    // State should be unloaded / stopped and drives cleared
    expect(stopSpy).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByTestId("runtime-pill")).toHaveTextContent("UNLOADED");
    });

    // Clean up
    mockAdapter.stop();
  });
});
