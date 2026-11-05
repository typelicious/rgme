import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CommandPalette, type PaletteAction } from "../components/CommandPalette";
import { KeyboardShortcutsModal } from "../components/KeyboardShortcutsModal";
import { AudioVisualizer } from "../components/AudioVisualizer";
import { LibraryShelf } from "../components/LibraryShelf";
import { GameLibraryStore } from "../lib/library";
import { App } from "../App";
import { MockRuntimeAdapter, FREEWARE_CLASSICS } from "@rgme/core";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Lane 5 (UX-PRO-MAX-001) Usability & Experience Overhaul", () => {
  it("CommandPalette renders actions, filters dynamically, and triggers run callback", () => {
    const handleRun = vi.fn();
    const actions: PaletteAction[] = [
      { id: "action-1", category: "Game", title: "Start Emulation", detail: "Start engine", run: handleRun },
      { id: "action-2", category: "Display", title: "Toggle CRT", detail: "Shader", run: vi.fn() },
      { id: "action-3", category: "Help", title: "Keyboard Shortcuts", run: vi.fn() }
    ];

    const { rerender } = render(<CommandPalette open={false} onClose={vi.fn()} actions={actions} />);
    expect(screen.queryByTestId("command-palette")).not.toBeInTheDocument();

    rerender(<CommandPalette open={true} onClose={vi.fn()} actions={actions} />);
    expect(screen.getByTestId("command-palette")).toBeInTheDocument();

    // Filter by query
    const input = screen.getByTestId("command-palette-input");
    fireEvent.change(input, { target: { value: "Start" } });

    expect(screen.getByText("Start Emulation")).toBeInTheDocument();
    expect(screen.queryByText("Toggle CRT")).not.toBeInTheDocument();

    // Click item
    fireEvent.click(screen.getByText("Start Emulation"));
    expect(handleRun).toHaveBeenCalled();
  });

  it("KeyboardShortcutsModal displays keybindings and closes on backdrop click", () => {
    const handleClose = vi.fn();
    const { rerender } = render(<KeyboardShortcutsModal open={false} onClose={handleClose} />);
    expect(screen.queryByTestId("shortcuts-modal")).not.toBeInTheDocument();

    rerender(<KeyboardShortcutsModal open={true} onClose={handleClose} />);
    const modal = screen.getByTestId("shortcuts-modal");
    expect(modal).toBeInTheDocument();
    expect(screen.getByText("Cmd+K / /")).toBeInTheDocument();

    fireEvent.click(modal);
    expect(handleClose).toHaveBeenCalled();
  });

  it("AudioVisualizer renders 4 Paula channel VU bars and oscilloscope", () => {
    render(
      <AudioVisualizer
        levels={[0.8, 0.4, 0.2, 0.9]}
        getWaveformData={() => new Float32Array(128).fill(0.5)}
      />
    );
    expect(screen.getByTestId("audio-visualizer")).toBeInTheDocument();
    expect(screen.getByTestId("vu-ch-0")).toBeInTheDocument();
    expect(screen.getByTestId("vu-ch-1")).toBeInTheDocument();
    expect(screen.getByTestId("vu-ch-2")).toBeInTheDocument();
    expect(screen.getByTestId("vu-ch-3")).toBeInTheDocument();
    expect(screen.getByTestId("oscilloscope")).toBeInTheDocument();
  });

  it("LibraryShelf renders curated Freeware Classics multi-disk games with 1-click launch", async () => {
    const store = new GameLibraryStore();
    const handleLaunch = vi.fn();
    render(<LibraryShelf store={store} onMount={vi.fn()} onLaunchClassic={handleLaunch} />);

    expect(screen.getByTestId("freeware-classics-showcase")).toBeInTheDocument();
    expect(screen.getByText("Flight of the Amazon Queen")).toBeInTheDocument();
    expect(screen.getByText("Beneath a Steel Sky")).toBeInTheDocument();
    expect(screen.getByText("Lure of the Temptress")).toBeInTheDocument();

    // 1-click launch button
    const launchButtons = screen.getAllByText("1-Click Mount & Load");
    expect(launchButtons.length).toBe(FREEWARE_CLASSICS.length);
    fireEvent.click(launchButtons[0]!);
    expect(handleLaunch).toHaveBeenCalledWith(FREEWARE_CLASSICS[0]);
  });

  it("App integrates CommandPalette hotkey (Cmd+K) and Shortcuts modal (?)", async () => {
    render(<App createAdapter={() => new MockRuntimeAdapter()} />);

    // Trigger palette via hotkey Cmd+K
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    await waitFor(() => {
      expect(screen.getByTestId("command-palette")).toBeInTheDocument();
    });

    // Close palette via Escape
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByTestId("command-palette")).not.toBeInTheDocument();
    });

    // Trigger shortcuts modal via '?'
    fireEvent.keyDown(window, { key: "?" });
    await waitFor(() => {
      expect(screen.getByTestId("shortcuts-modal")).toBeInTheDocument();
    });
  });

  it("Header includes audio toggle, palette button, and shortcuts button", () => {
    render(<App createAdapter={() => new MockRuntimeAdapter()} />);
    const driveSoundBtn = screen.getByTestId("drive-sound-toggle");
    expect(driveSoundBtn).toBeInTheDocument();
    expect(driveSoundBtn).toHaveTextContent(/Floppy Audio: 🔊 ON/i);

    fireEvent.click(driveSoundBtn);
    expect(driveSoundBtn).toHaveTextContent(/Floppy Audio: 🔇 OFF/i);

    const paletteBtn = screen.getByTestId("header-palette-btn");
    fireEvent.click(paletteBtn);
    expect(screen.getByTestId("command-palette")).toBeInTheDocument();
  });
});
