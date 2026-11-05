import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MockRuntimeAdapter } from "@rgme/core";
import { App } from "../App";
import { RightsBadge } from "../components/RightsBadge";

describe("RightsBadge", () => {
  it("renders tones and action-specific text", () => {
    const { rerender } = render(<RightsBadge action="private_execution" decision="local_only" />);
    let b = screen.getByTestId("badge-private_execution");
    expect(b).toHaveAttribute("data-tone", "local-only");
    expect(b).toHaveTextContent("Local execution: allowed (BYOG)");
    rerender(<RightsBadge action="binary_redistribution" decision="deny" />);
    b = screen.getByTestId("badge-binary_redistribution");
    expect(b).toHaveAttribute("data-tone", "restricted");
    expect(b).toHaveTextContent("Binary redistribution: not verified");
    rerender(<RightsBadge action="binary_redistribution" decision="allow" />);
    expect(screen.getByTestId("badge-binary_redistribution")).toHaveAttribute("data-tone", "cleared");
    expect(document.body.textContent).not.toMatch(/legal/i);
  });
});

describe("App", () => {
  it("renders shell with disabled export", () => {
    render(<App createAdapter={() => new MockRuntimeAdapter()} />);
    expect(screen.getAllByText("RGME").length).toBeGreaterThan(0);
    expect(screen.getByTestId("export-btn")).toBeDisabled();
    expect(screen.getByTestId("runtime-pill")).toHaveTextContent("UNLOADED");
  });

  it("drop flow: hash, local-only badge, export blocked, play, keyboard HUD", async () => {
    const adapter = new MockRuntimeAdapter();
    render(<App createAdapter={() => adapter} />);
    const file = new File(["abc"], "Demo.adf");
    await act(async () => {
      fireEvent.drop(screen.getByTestId("dropzone"), { dataTransfer: { files: [file] } });
    });
    await waitFor(() => expect(screen.getByTestId("drop-status")).toHaveTextContent("Unknown"));
    expect(screen.getByTestId("drop-hash")).toHaveTextContent("ba7816bf8f01cfea");
    expect(screen.getByTestId("badge-private_execution")).toHaveAttribute("data-tone", "local-only");
    expect(screen.getByTestId("badge-binary_redistribution")).toHaveAttribute("data-tone", "restricted");
    expect(screen.getByTestId("export-btn")).toBeDisabled();
    expect(screen.getByTestId("share-btn")).toBeDisabled();
    expect(screen.getByTestId("export-reason")).toHaveTextContent(/local play only/i);
    await waitFor(() => expect(adapter.state).toBe("LOADED"));

    fireEvent.click(screen.getByTestId("btn-start"));
    await waitFor(() => expect(adapter.state).toBe("RUNNING"));
    fireEvent.keyDown(window, { code: "Space" });
    await waitFor(() => expect(screen.getByTestId("hud-fire")).toHaveAttribute("data-active", "true"));
    expect(adapter.activeInputs).toEqual(["fire"]);
    fireEvent.keyUp(window, { code: "Space" });
    await waitFor(() => expect(screen.getByTestId("hud-fire")).toHaveAttribute("data-active", "false"));
    fireEvent.click(screen.getByTestId("btn-pause"));
    expect(adapter.state).toBe("PAUSED");
    fireEvent.click(screen.getByText("Show details"));
    expect(screen.getByTestId("inspector-details")).toBeInTheDocument();
  });

  it("toggles CRT overlay", () => {
    render(<App createAdapter={() => new MockRuntimeAdapter()} />);
    expect(screen.queryByTestId("crt-overlay")).toBeNull();
    fireEvent.click(screen.getByText("CRT scanlines"));
    expect(screen.getByTestId("crt-overlay")).toBeInTheDocument();
  });
});
