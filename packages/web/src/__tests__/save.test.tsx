import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MockRuntimeAdapter, parseGameProfile } from "@rgme/core";
import { SaveStateManager, IndexedDbSaveStore, MemorySaveStore } from "../lib/save";
import { SaveDrawer } from "../components/SaveDrawer";
import { DEMO_PROFILE } from "../samples/demo";

const SHA = DEMO_PROFILE.media[0]!.sha256;
const PNG = "data:image/png;base64,AAAA";
const canvas = { toDataURL: () => PNG };

async function loaded(frames = 3) {
  const a = new MockRuntimeAdapter();
  await a.loadGame(DEMO_PROFILE);
  a.start();
  for (let i = 0; i < frames; i++) a.tick();
  return a;
}

describe("SaveStateManager (IndexedDB)", () => {
  it("saves with thumbnail, restores after mutation, lists 10 slots", async () => {
    const m = new SaveStateManager(new IndexedDbSaveStore(), () => 1234);
    const a = await loaded(3);
    a.pressInput("fire", true);
    const rec = await m.save(2, { adapter: a, canvas, title: "Demo", sha256: SHA });
    expect(rec).toMatchObject({ slot: 2, savedAt: 1234, thumbnail: PNG, sha256: SHA });
    a.tick(); a.tick(); a.pressInput("fire", false);
    await m.load(2, a, { sha256: SHA });
    expect(a.currentFrame).toBe(3);
    expect(a.activeInputs).toEqual(["fire"]);
    const list = await m.list();
    expect(list).toHaveLength(10);
    expect(list[1]?.title).toBe("Demo");
    expect(list.filter(Boolean)).toHaveLength(1);
    await m.delete(2);
    expect((await m.list())[1]).toBeNull();
    a.stop();
  });

  it("persists across manager instances (page reload)", async () => {
    const a = await loaded(1);
    await new SaveStateManager(new IndexedDbSaveStore()).save(5, { adapter: a, canvas: null, title: "T", sha256: SHA });
    const rec = (await new SaveStateManager(new IndexedDbSaveStore()).list())[4];
    expect(rec?.thumbnail).toBe(""); // no canvas => placeholder
    a.stop();
  });

  it("validates slot range, empty slots and mismatches", async () => {
    const m = new SaveStateManager(new MemorySaveStore());
    const a = await loaded();
    await expect(m.save(0, { adapter: a, title: "x", sha256: SHA })).rejects.toThrow(RangeError);
    await expect(m.save(11, { adapter: a, title: "x", sha256: SHA })).rejects.toThrow(RangeError);
    await expect(m.load(1, a)).rejects.toThrow(/empty/);
    await m.save(1, { adapter: a, canvas, title: "x", sha256: SHA });
    await expect(m.load(1, a, { sha256: "f".repeat(64) })).rejects.toThrow(/different disk/);
    const other = new MockRuntimeAdapter();
    await other.loadGame(parseGameProfile({ ...DEMO_PROFILE, id: "other-game", rights: { recordId: "r" } }));
    await expect(m.load(1, other, { sha256: SHA })).rejects.toThrow(/other-game/);
    a.stop(); other.stop();
  });

  it("canvas without PNG support yields empty thumbnail", async () => {
    const m = new SaveStateManager(new MemorySaveStore());
    const a = await loaded();
    const rec = await m.save(1, { adapter: a, canvas: { toDataURL: () => { throw new Error("tainted"); } }, title: "x", sha256: SHA });
    expect(rec.thumbnail).toBe("");
    a.stop();
  });
});

describe(".rgmesave export/import", () => {
  it("round-trips into another slot and manager", async () => {
    const a = await loaded(4);
    const m1 = new SaveStateManager(new MemorySaveStore());
    await m1.save(3, { adapter: a, canvas, title: "Demo", sha256: SHA });
    const bytes = await m1.exportSlot(3);
    const m2 = new SaveStateManager(new MemorySaveStore());
    const rec = await m2.importSave(bytes, 7);
    expect(rec.slot).toBe(7);
    a.tick();
    await m2.load(7, a, { sha256: SHA });
    expect(a.currentFrame).toBe(4);
    a.stop();
  });
  it("rejects tampered, foreign and unknown-version files", async () => {
    const a = await loaded();
    const m = new SaveStateManager(new MemorySaveStore());
    await m.save(1, { adapter: a, canvas, title: "Demo", sha256: SHA });
    const text = new TextDecoder().decode(await m.exportSlot(1));
    const enc = (s: string) => new TextEncoder().encode(s);
    const env = JSON.parse(text);
    await expect(m.importSave(enc(JSON.stringify({ ...env, payload: env.payload.replace('"frame":3', '"frame":99') })), 2)).rejects.toThrow(/Integrity/);
    await expect(m.importSave(enc(JSON.stringify({ ...env, version: 2 })), 2)).rejects.toThrow(/version/);
    await expect(m.importSave(enc("{}"), 2)).rejects.toThrow(/valid/);
    await expect(m.importSave(enc("garbage"), 2)).rejects.toThrow(/valid/);
    await expect(m.importSave(enc(text), 12)).rejects.toThrow(RangeError);
    a.stop();
  });
});

describe("SaveDrawer", () => {
  it("renders 10 slots and supports save, restore, delete", async () => {
    const a = await loaded(2);
    a.pause(); // stop the real 50Hz timer so frame counts are deterministic
    const manager = new SaveStateManager(new MemorySaveStore());
    render(<SaveDrawer manager={manager} adapter={a} getCanvas={() => canvas} title="Demo" sha256={SHA} open onClose={() => {}} />);
    await waitFor(() => expect(screen.getByTestId("slot-10")).toBeInTheDocument());
    expect(screen.getByTestId("slot-1")).toHaveAttribute("data-empty", "true");

    fireEvent.click(screen.getAllByText("Save")[0]!);
    await waitFor(() => expect(screen.getByTestId("slot-1")).toHaveAttribute("data-empty", "false"));
    expect(screen.getByAltText("Slot 1 preview")).toHaveAttribute("src", PNG);
    expect(screen.getByTestId("slot-1-time")).toBeInTheDocument();

    a.start(); a.tick(); a.tick(); a.pause();
    fireEvent.click(screen.getAllByText("Restore")[0]!);
    await waitFor(() => expect(a.currentFrame).toBe(2));
    expect(screen.getByTestId("save-message")).toHaveTextContent("Restored slot 1");

    fireEvent.click(screen.getAllByText("Delete")[0]!);
    await waitFor(() => expect(screen.getByTestId("slot-1")).toHaveAttribute("data-empty", "true"));
    a.stop();
  });
  it("renders nothing when closed", () => {
    render(<SaveDrawer manager={new SaveStateManager(new MemorySaveStore())} adapter={undefined} getCanvas={() => null} title="" sha256="" open={false} onClose={() => {}} />);
    expect(screen.queryByTestId("save-drawer")).toBeNull();
  });
});
