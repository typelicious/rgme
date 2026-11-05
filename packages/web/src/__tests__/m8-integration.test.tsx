import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  MockRuntimeAdapter,
  ArchiveSourceStore,
  ArchiveBookmarkStore,
  type RetroGameMetadata
} from "@rgme/core";
import { App } from "../App";
import { GameCard } from "../components/GameCard";
import { SourceManagerModal } from "../components/SourceManagerModal";
import { LibraryShelf } from "../components/LibraryShelf";
import { GameLibraryStore, MemoryBackend } from "../lib/library";

afterEach(() => {
  vi.unstubAllGlobals();
});

const mockGame: RetroGameMetadata = {
  id: "Amiga-Arquivista:oil imperium",
  canonicalTitle: "Oil Imperium",
  genre: "Strategy & Simulation",
  year: 1989,
  studio: "Rainbow Arts",
  platform: "amiga",
  totalDisks: 2,
  versions: [
    {
      filename: "Oil Imperium (EU).zip",
      label: "EU Edition (ZIP)",
      format: "zip",
      sourceId: "Amiga-Arquivista"
    },
    {
      filename: "Oil Imperium (GE).zip",
      label: "GE Edition (ZIP)",
      format: "zip",
      sourceId: "Amiga-Arquivista"
    }
  ],
  defaultVersion: {
    filename: "Oil Imperium (EU).zip",
    label: "EU Edition (ZIP)",
    format: "zip",
    sourceId: "Amiga-Arquivista"
  },
  sourceId: "Amiga-Arquivista",
  sourceTitle: "Amiga Arquivista"
};

describe("Milestone 8 Integration: Steam/YouTube Retro Hub, Sources & Playability", () => {
  it("M8-CARDS-001: GameCard displays metadata, switches versions, and triggers stream & bookmark", () => {
    const handleStream = vi.fn();
    const handleBookmark = vi.fn();

    render(
      <GameCard
        game={mockGame}
        isBookmarked={false}
        onToggleBookmark={handleBookmark}
        onStreamAndMount={handleStream}
      />
    );

    expect(screen.getByText("Oil Imperium")).toBeInTheDocument();
    expect(screen.getByText("Strategy & Simulation")).toBeInTheDocument();
    expect(screen.getByText("2 Disks")).toBeInTheDocument();
    expect(screen.getByText(/Rainbow Arts • 1989/)).toBeInTheDocument();

    // Toggle bookmark
    const bookmarkBtn = screen.getByRole("button", { name: /Bookmark/i });
    fireEvent.click(bookmarkBtn);
    expect(handleBookmark).toHaveBeenCalledWith(mockGame);

    // Switch version
    const select = screen.getByTestId("version-select") as HTMLSelectElement;
    expect(select.value).toBe("Oil Imperium (EU).zip");
    fireEvent.change(select, { target: { value: "Oil Imperium (GE).zip" } });
    expect(select.value).toBe("Oil Imperium (GE).zip");

    // Click Stream & Mount
    const mountBtn = screen.getByRole("button", { name: /Stream & Mount DF0:/i });
    fireEvent.click(mountBtn);
    expect(handleStream).toHaveBeenCalledWith(
      mockGame,
      expect.objectContaining({ filename: "Oil Imperium (GE).zip" })
    );
  });

  it("M8-SOURCES-001: SourceManagerModal displays connected collections and adds new source", async () => {
    const sourceStore = new ArchiveSourceStore();
    const handleChanged = vi.fn();
    const mockConnector = {
      fetchMetadata: vi.fn(async (id: string) => ({
        identifier: id,
        title: "TOSEC Amiga Disks",
        description: "Public domain TOSEC collection",
        files: [{ name: "demo.adf" }]
      }))
    };

    render(
      <SourceManagerModal
        open={true}
        onClose={vi.fn()}
        sourceStore={sourceStore}
        onSourcesChanged={handleChanged}
        connector={mockConnector as any}
      />
    );

    expect(screen.getByRole("dialog", { name: /Manage Archive.org Sources/i })).toBeInTheDocument();
    expect(screen.getByText("Amiga Arquivista Collection")).toBeInTheDocument();

    // Fill in new source
    const inputs = screen.getAllByRole("textbox");
    fireEvent.change(inputs[0]!, { target: { value: "tosec-amiga" } });
    fireEvent.change(inputs[1]!, { target: { value: "TOSEC Amiga Disks" } });

    const addBtn = screen.getByRole("button", { name: /\+ Add Source/i });
    fireEvent.click(addBtn);

    await waitFor(() => {
      expect(mockConnector.fetchMetadata).toHaveBeenCalledWith("tosec-amiga");
      expect(handleChanged).toHaveBeenCalled();
      expect(screen.getByText(/Successfully added "TOSEC Amiga Disks"/i)).toBeInTheDocument();
    });
  });

  it("M8-LIBRARY-001: LibraryShelf supports tabbed navigation and discovery", async () => {
    const memStore = new GameLibraryStore(new MemoryBackend());
    const sourceStore = new ArchiveSourceStore();
    const bookmarkStore = new ArchiveBookmarkStore();
    const mockConnector = {
      fetchMetadata: vi.fn(async () => ({
        identifier: "Amiga-Arquivista",
        title: "Amiga Arquivista",
        files: [
          { name: "Oil Imperium (EU).zip", size: 1065000 },
          { name: "Monkey Island 2 (Disk 1 of 11).adf", size: 901120 }
        ]
      }))
    };

    render(
      <LibraryShelf
        store={memStore}
        onMount={vi.fn()}
        sourceStore={sourceStore}
        bookmarkStore={bookmarkStore}
        connector={mockConnector as any}
      />
    );

    // Initial tab: My Library
    expect(screen.getByTestId("tab-my-library")).toBeInTheDocument();
    expect(screen.getByTestId("freeware-classics-showcase")).toBeInTheDocument();

    // Switch to Recently Played
    fireEvent.click(screen.getByTestId("tab-recent"));
    expect(screen.getByText(/Chronological history of launched games/i)).toBeInTheDocument();

    // Switch to Discover & Sources
    fireEvent.click(screen.getByTestId("tab-discover"));
    await waitFor(() => {
      expect(mockConnector.fetchMetadata).toHaveBeenCalled();
      expect(screen.getByText("Oil Imperium")).toBeInTheDocument();
      expect(screen.getByText("Monkey Island 2")).toBeInTheDocument();
    });
  });

  it("M8-PLAYABILITY-001: App provides dedicated Stop button that silences runtime and transitions state", async () => {
    const mockAdapter = new MockRuntimeAdapter();
    const stopSpy = vi.spyOn(mockAdapter, "stop");

    render(<App createAdapter={() => mockAdapter} />);

    // Start simulation
    fireEvent.click(screen.getByTestId("load-demo"));
    await waitFor(() => expect(mockAdapter.state).toBe("RUNNING"));

    // Click Stop button
    const stopBtn = screen.getByTestId("btn-stop");
    expect(stopBtn).toBeInTheDocument();
    expect(stopBtn).not.toBeDisabled();

    fireEvent.click(stopBtn);
    expect(stopSpy).toHaveBeenCalled();
    expect(mockAdapter.state).toBe("STOPPED");

    // Start again from STOPPED
    const startBtn = screen.getByTestId("btn-start");
    expect(startBtn).not.toBeDisabled();
    fireEvent.click(startBtn);
    expect(mockAdapter.state).toBe("RUNNING");

    // Clean up
    mockAdapter.stop();
  });
});
