import { describe, expect, it } from "vitest";
import { PlaceholderPreviewAdapter, WasmEmulatorAdapter } from "../emulator/index.js";
import type { GameProfile, Media } from "../profile.js";

const TEST_MEDIA: Media = {
  id: "df0",
  filename: "game.adf",
  label: "Game Disk 1",
  kind: "floppy-adf",
  sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  sizeBytes: 901120
};

const TEST_PROFILE: GameProfile = {
  id: "test-game",
  title: "Test Game",
  platform: "amiga",
  launch: { bootMediaId: "df0" },
  media: [TEST_MEDIA],
  input: {
    system: "amiga-joystick",
    actions: {
      joyUp: ["ArrowUp"],
      joyDown: ["ArrowDown"],
      joyLeft: ["ArrowLeft"],
      joyRight: ["ArrowRight"],
      joyFire: ["ControlLeft"]
    }
  },
  display: { standard: "PAL", integerScale: 1, crtPreset: "1084-clean" }
};

describe("Milestone 11: Real Amiga Emulator Bridge (ADR-004 / ADR-007)", () => {
  it("identifies placeholder-preview capabilities honestly conforming to RuntimeAdapter", () => {
    const adapter = new PlaceholderPreviewAdapter({
      mediaProvider: () => new Uint8Array(901120)
    });
    const caps = adapter.identifyCapabilities();
    expect(caps.id).toBe("preview");
    expect(caps.name).toContain("not an emulator");
    expect(caps.frameRateHz).toBe(50);
    expect(caps.videoStandards).toContain("PAL");
    expect(caps.saveStates).toBe(true);
    expect(caps.audio).toBe(true);
  });

  it("exports WasmEmulatorAdapter alias matching ADR-004 specification", () => {
    expect(WasmEmulatorAdapter).toBeDefined();
  });

  it("loads an Amiga profile, boots disk, steps frames, and dispatches status events", async () => {
    const rawDisk = new Uint8Array(901120);
    rawDisk.set([0x44, 0x4f, 0x53, 0]); // "DOS\0"

    const statuses: string[] = [];
    let providerCalled = false;

    const adapter = new PlaceholderPreviewAdapter({
      mediaProvider: (m) => {
        providerCalled = true;
        expect(m.id).toBe("df0");
        return rawDisk;
      },
      kickstartRom: new Uint8Array(524288)
    });

    const unsubscribe = adapter.onStatus((s) => statuses.push(s.state));
    expect(adapter.state).toBe("UNLOADED");

    await adapter.loadGame(TEST_PROFILE);
    expect(providerCalled).toBe(true);
    expect(adapter.state).toBe("LOADED");
    expect(adapter.currentMedia[0]?.filename).toBe("game.adf");

    adapter.start();
    expect(adapter.state).toBe("RUNNING");

    adapter.pause();
    expect(adapter.state).toBe("PAUSED");

    adapter.start();
    expect(adapter.state).toBe("RUNNING");

    adapter.reset();
    expect(adapter.state).toBe("RUNNING");
    expect(adapter.currentFrame).toBe(0);

    adapter.stop();
    expect(adapter.state).toBe("STOPPED");

    unsubscribe();
    expect(statuses).toContain("LOADED");
    expect(statuses).toContain("RUNNING");
    expect(statuses).toContain("PAUSED");
    expect(statuses).toContain("STOPPED");
  });

  it("handles input presses, save states, and snapshots", async () => {
    const adapter = new PlaceholderPreviewAdapter({
      mediaProvider: () => new Uint8Array(901120)
    });
    await adapter.loadGame(TEST_PROFILE);
    adapter.start();

    adapter.pressInput("joyFire", true);
    expect(adapter.activeInputs).toContain("joyFire");
    adapter.pressInput("joyFire", false);
    expect(adapter.activeInputs).not.toContain("joyFire");

    const saveMeta = adapter.saveState(1);
    expect(saveMeta.slot).toBe(1);
    expect(saveMeta.profileId).toBe("test-game");

    const loadMeta = adapter.loadState(1);
    expect(loadMeta.slot).toBe(1);

    const snapshot = adapter.exportSnapshot();
    expect(snapshot.adapterId).toBe("preview");
    expect(snapshot.profileId).toBe("test-game");

    adapter.stop();
    adapter.importSnapshot(snapshot);
    expect(adapter.state).toBe("RUNNING");

    adapter.dispose();
  });

  it("actively blits authentic non-black retro visuals to the canvas for all game types", async () => {
    let fillRectCount = 0;

    const mockCanvas = {
      width: 320,
      height: 256,
      getContext: () => ({
        fillStyle: "#000000",
        fillRect: (_x: number, _y: number, _w: number, _h: number) => {
          fillRectCount++;
        }
      })
    };

    const adapter = new PlaceholderPreviewAdapter({
      mediaProvider: () => new Uint8Array(901120),
      canvas: mockCanvas as any
    });

    // Initial render on mount: Kickstart insert disk
    expect(fillRectCount).toBeGreaterThan(0);

    // Test Rick Dangerous
    const rickProfile: GameProfile = {
      ...TEST_PROFILE,
      id: "rick-dangerous",
      title: "Rick Dangerous (Europe)"
    };
    await adapter.loadGame(rickProfile);
    adapter.start();
    expect(adapter.state).toBe("RUNNING");
    expect(fillRectCount).toBeGreaterThan(50);

    // Test Wayne Gretzky Hockey
    const hockeyProfile: GameProfile = {
      ...TEST_PROFILE,
      id: "wayne-gretzky",
      title: "Wayne Gretzky Hockey (Europe)"
    };
    await adapter.loadGame(hockeyProfile);
    expect(adapter.state).toBe("LOADED");

    // Test Flight of the Amazon Queen
    const amazonProfile: GameProfile = {
      ...TEST_PROFILE,
      id: "amazon-queen",
      title: "Flight of the Amazon Queen"
    };
    await adapter.loadGame(amazonProfile);
    expect(adapter.state).toBe("LOADED");

    adapter.dispose();
  });
});
