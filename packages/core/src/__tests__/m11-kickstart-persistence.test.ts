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

  it("M11-KICK-003: resolves optimal ROM from deposited pool based on profile machine requirements", async () => {
    const store = new KickstartRomStore();
    const ks13Bytes = new Uint8Array(262144).fill(0x13);
    const ks13Sha = "ee05862d8102a08436ac4056da7d549db31625c7d47b24dfb7b3c9a5c113ca53";
    await store.registerRom(ks13Bytes, ks13Sha, "Kickstart 1.3");

    const ks31Bytes = new Uint8Array(524288).fill(0x31);
    const ks31Sha = "6d43840d4099a74170ea0f0425b6257c3891ebcaa39c4d1840075a9ab22b5707";
    await store.registerRom(ks31Bytes, ks31Sha, "Kickstart 3.1 (A1200)");

    // 1. Classic OCS game (e.g. Wayne Gretzky Hockey / Rick Dangerous) gets Kickstart 1.3
    const ocsRom = await store.resolveRomForProfile({
      machine: { model: "A500", chipset: "OCS", kickstart: "1.3" }
    });
    expect(ocsRom.meta.version).toBe("1.3");
    expect(ocsRom.meta.name).toContain("Kickstart 1.3");

    // 2. AGA game (e.g. Gloom / Alien Breed 3D) gets Kickstart 3.1
    const agaRom = await store.resolveRomForProfile({
      machine: { model: "A1200", chipset: "AGA", kickstart: "3.1" }
    });
    expect(agaRom.meta.version).toBe("3.1");
    expect(agaRom.meta.name).toContain("Kickstart 3.1");

    // 3. Game requesting unknown ROM falls back to AROS
    const arosRom = await store.resolveRomForProfile({
      machine: { model: "A500", chipset: "OCS", kickstart: "AROS" }
    });
    expect(arosRom.meta.builtIn).toBe(true);
  });
});
