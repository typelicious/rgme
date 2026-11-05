import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { KickstartRomStore, BUILTIN_AROS_META } from "../rom/kickstart-rom-store.js";

describe("Milestone 11 - Batch 1: Kickstart ROM Persistence", () => {
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => mockStorage[key] ?? null,
      setItem: (key: string, value: string) => {
        mockStorage[key] = value;
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      },
      clear: () => {
        mockStorage = {};
      }
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("M11-KICK-001: persists activeId into localStorage when registering or selecting a ROM", async () => {
    const store = new KickstartRomStore();
    const fakeBytes = new Uint8Array(524288).fill(0x11);
    const fakeSha = "8c8a0cf04f91b88ee88ec540139b4b0079c6d3df3985fb12b59f33b1e843bc40";

    const meta = await store.registerRom(fakeBytes, fakeSha, "kick40063.A600");
    expect(meta.id).toBe(fakeSha);
    expect(store.getActiveRomId()).toBe(fakeSha);
    expect(mockStorage["rgme_active_kickstart_rom_id"]).toBe(fakeSha);

    // Instantiating a new store instance should immediately restore the saved activeId
    const restoredStore = new KickstartRomStore();
    expect(restoredStore.getActiveRomId()).toBe(fakeSha);
  });

  it("M11-KICK-002: setActiveRomId updates localStorage correctly", () => {
    const store = new KickstartRomStore();
    store.setActiveRomId(BUILTIN_AROS_META.id);
    expect(mockStorage["rgme_active_kickstart_rom_id"]).toBe(BUILTIN_AROS_META.id);
  });
});
