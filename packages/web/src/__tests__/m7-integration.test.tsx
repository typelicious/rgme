import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MockRuntimeAdapter, type StreamedRetroMedia } from "@rgme/core";
import { App } from "../App";
import { CloudStreamModal } from "../components/CloudStreamModal";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Milestone 7 Integration & Features", () => {
  it("M7-SCALING-001: Controls container matches dynamic responsive monitor class", () => {
    const { container } = render(<App createAdapter={() => new MockRuntimeAdapter()} />);
    const controls = container.querySelectorAll(".rgme-controls-container");
    expect(controls.length).toBeGreaterThanOrEqual(1);
  });

  it("M7-ARCHIVE-001: CloudStreamModal opens, queries Archive.org files, and triggers mount", async () => {
    const mockFiles = [
      { name: "classic_adventure.adf", size: 901120, format: "Amiga Disk File" },
      { name: "space_shooter.zip", size: 500000, format: "ZIP" }
    ];

    const mockConnector = {
      fetchMetadata: vi.fn(async (id: string) => ({
        identifier: id,
        title: "Test Retro Collection",
        files: mockFiles
      })),
      streamFile: vi.fn(async (id: string, filename: string): Promise<StreamedRetroMedia> => ({
        identifier: id,
        sourceFilename: filename,
        diskFilename: filename,
        bytes: new Uint8Array(1024),
        sha256: "0".repeat(64),
        size: 1024,
        format: "adf"
      }))
    };

    const handleMount = vi.fn(async () => {});
    const handleClose = vi.fn();

    render(
      <CloudStreamModal
        open={true}
        onClose={handleClose}
        onMountMedia={handleMount}
        connector={mockConnector as any}
      />
    );

    expect(screen.getByRole("dialog", { name: /Stream from Archive.org/i })).toBeInTheDocument();

    // Click "Query Files"
    const queryBtn = screen.getByRole("button", { name: /Query Files/i });
    fireEvent.click(queryBtn);

    await waitFor(() => {
      expect(mockConnector.fetchMetadata).toHaveBeenCalledWith("Amiga-Arquivista");
      expect(screen.getByText("classic_adventure.adf")).toBeInTheDocument();
      expect(screen.getByText("space_shooter.zip")).toBeInTheDocument();
    });

    // Click "Stream & Mount DF0:" on the first file
    const streamButtons = screen.getAllByRole("button", { name: /Stream & Mount DF0:/i });
    fireEvent.click(streamButtons[0]!);

    await waitFor(() => {
      expect(mockConnector.streamFile).toHaveBeenCalledWith("Amiga-Arquivista", "classic_adventure.adf");
      expect(handleMount).toHaveBeenCalled();
      expect(handleClose).toHaveBeenCalled();
    });
  });

  it("M7-ARCHIVE-001: Header contains Archive.org stream button opening the modal", () => {
    render(<App createAdapter={() => new MockRuntimeAdapter()} />);
    const cloudBtn = screen.getByTestId("header-cloud-btn");
    expect(cloudBtn).toBeInTheDocument();
    fireEvent.click(cloudBtn);

    expect(screen.getByRole("dialog", { name: /Stream from Archive.org/i })).toBeInTheDocument();
  });
});
