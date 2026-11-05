import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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
