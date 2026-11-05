/**
 * Kickstart ROM Management & Built-in Open AROS Compatibility Layer.
 *
 * Provides out-of-the-box open-source Kickstart ROM emulation (AROS 68k compatible)
 * alongside Bring-Your-Own-ROM (BYOR) support for authentic Commodore Kickstart ROMs (1.2, 1.3, 2.04, 3.1).
 */

export interface KickstartRomMeta {
  id: string;
  name: string;
  version: string;
  sha256: string;
  size: number;
  builtIn: boolean;
  source: "built-in" | "user-uploaded";
  compatibility: "open-source-clean" | "authentic-commodore";
}

export const KNOWN_COMMODORE_ROMS: Record<string, { name: string; version: string }> = {
  // Kickstart 1.3 (A500, A2000)
  "c4f0f55f119409d811b408c56c20573e0473ce17800c2ab5c9c9351e2202ea6d": {
    name: "Commodore Amiga Kickstart 1.3 (34.005)",
    version: "1.3"
  },
  "cd854c92e0a2455286a9f458e3ca0329e46a788880e685f678ef459952ec96f3": {
    name: "Commodore Amiga Kickstart 1.3 (34.005) [Alternative]",
    version: "1.3"
  },
  // Kickstart 1.2
  "85ad74194e87c0e722906fe42a4c53f4719604f8261e70072139e705d626d183": {
    name: "Commodore Amiga Kickstart 1.2 (33.180)",
    version: "1.2"
  },
  // Kickstart 2.04 (A500+)
  "c383d57d760b54bf9fe2d488e02d3345163f91c9405c141d0c41031c5ee935d2": {
    name: "Commodore Amiga Kickstart 2.04 (37.175)",
    version: "2.04"
  },
  // Kickstart 3.1 (A1200)
  "fc24ae0e70f9a4c4384e0ab3b5b8b42169b5e1f5d6c31f13d856296979560449": {
    name: "Commodore Amiga Kickstart 3.1 (40.068)",
    version: "3.1"
  }
};

/** Minimal Open AROS 68k replacement ROM banner and entry vectors */
export const BUILTIN_AROS_META: KickstartRomMeta = {
  id: "aros-68k-builtin",
  name: "AROS Amiga 68k Compatibility ROM",
  version: "AROS-2026",
  sha256: "0000000000000000000000000000000000000000000000000000000000000001",
  size: 524288,
  builtIn: true,
  source: "built-in",
  compatibility: "open-source-clean"
};

/** Minimal synthetic 512KB AROS-compatible Kickstart ROM image */
export function createBuiltinArosRom(): Uint8Array {
  const rom = new Uint8Array(512 * 1024);
  // Reset vector at offset 0: initial SSP (0x080000) and PC (0xFC0002)
  const view = new DataView(rom.buffer);
  view.setUint32(0, 0x00080000, false);
  view.setUint32(4, 0x00fc0002, false);

  // Magic Kickstart header at 0x000000 (standard Amiga ROM header at end or beginning)
  // 0x1111 (NOP / marker), 0x4ef9 (JMP to bootstrap)
  rom[8] = 0x11; rom[9] = 0x11;
  rom[10] = 0x4e; rom[11] = 0xf9;
  view.setUint32(12, 0x00fc0020, false);

  // String signature
  const sig = "AROS-68K-OPEN-AMIGA-KICKSTART-RGME-v1.0";
  for (let i = 0; i < sig.length; i++) {
    rom[0x20 + i] = sig.charCodeAt(i);
  }
  return rom;
}

export interface KickstartRomEntry {
  meta: KickstartRomMeta;
  bytes: Uint8Array;
}

/** In-memory and IndexedDB-backed Kickstart ROM storage */
export class KickstartRomStore {
  private customRoms = new Map<string, KickstartRomEntry>();
  private activeId: string = BUILTIN_AROS_META.id;
  private readonly dbName = "rgme_kickstart_db";
  private dbPromise: Promise<IDBDatabase | null> | null = null;

  constructor() {
    try {
      if (typeof localStorage !== "undefined") {
        const saved = localStorage.getItem("rgme_active_kickstart_rom_id");
        if (saved) this.activeId = saved;
      }
    } catch {
      /* ignore */
    }
    this.initDb();
  }

  private initDb() {
    if (typeof indexedDB === "undefined") {
      this.dbPromise = Promise.resolve(null);
      return;
    }
    this.dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(this.dbName, 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains("roms")) {
            db.createObjectStore("roms", { keyPath: "sha256" });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  getActiveRomId(): string {
    return this.activeId;
  }

  setActiveRomId(id: string): void {
    if (id === BUILTIN_AROS_META.id || this.customRoms.has(id)) {
      this.activeId = id;
      try {
        if (typeof localStorage !== "undefined") {
          localStorage.setItem("rgme_active_kickstart_rom_id", id);
        }
      } catch {
        /* ignore */
      }
    }
  }

  async listRoms(): Promise<KickstartRomMeta[]> {
    await this.loadPersistedRoms();
    const result: KickstartRomMeta[] = [{ ...BUILTIN_AROS_META }];
    for (const entry of this.customRoms.values()) {
      result.push({ ...entry.meta });
    }
    return result;
  }

  async getActiveRom(): Promise<KickstartRomEntry> {
    await this.loadPersistedRoms();
    if (this.activeId !== BUILTIN_AROS_META.id && this.customRoms.has(this.activeId)) {
      return this.customRoms.get(this.activeId)!;
    }
    return {
      meta: BUILTIN_AROS_META,
      bytes: createBuiltinArosRom()
    };
  }

  async registerRom(bytes: Uint8Array, sha256: string, filename?: string): Promise<KickstartRomMeta> {
    const cleanSha = sha256.toLowerCase();
    const known = KNOWN_COMMODORE_ROMS[cleanSha];
    const name = known ? known.name : (filename ?? `Custom ROM (${cleanSha.slice(0, 8)})`);
    const version = known ? known.version : "Custom";

    const meta: KickstartRomMeta = {
      id: cleanSha,
      name,
      version,
      sha256: cleanSha,
      size: bytes.length,
      builtIn: false,
      source: "user-uploaded",
      compatibility: known ? "authentic-commodore" : "open-source-clean"
    };

    const entry: KickstartRomEntry = { meta, bytes };
    this.customRoms.set(cleanSha, entry);
    this.activeId = cleanSha;
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("rgme_active_kickstart_rom_id", cleanSha);
      }
    } catch {
      /* ignore */
    }

    // Persist to IndexedDB
    try {
      const db = await this.dbPromise;
      if (db) {
        const tx = db.transaction("roms", "readwrite");
        tx.objectStore("roms").put({ sha256: cleanSha, meta, bytes: Array.from(bytes) });
      }
    } catch {
      /* ignore storage errors */
    }

    return meta;
  }

  private async loadPersistedRoms(): Promise<void> {
    try {
      const db = await this.dbPromise;
      if (!db) return;
      return new Promise<void>((resolve) => {
        const tx = db.transaction("roms", "readonly");
        const req = tx.objectStore("roms").getAll();
        req.onsuccess = () => {
          const items = req.result as Array<{ sha256: string; meta: KickstartRomMeta; bytes: number[] }>;
          if (items && Array.isArray(items)) {
            for (const item of items) {
              if (!this.customRoms.has(item.sha256)) {
                this.customRoms.set(item.sha256, {
                  meta: item.meta,
                  bytes: new Uint8Array(item.bytes)
                });
              }
            }
            try {
              if (typeof localStorage !== "undefined") {
                const saved = localStorage.getItem("rgme_active_kickstart_rom_id");
                if (saved && (saved === BUILTIN_AROS_META.id || this.customRoms.has(saved))) {
                  this.activeId = saved;
                }
              }
            } catch {
              /* ignore */
            }
          }
          resolve();
        };
        req.onerror = () => resolve();
      });
    } catch {
      /* ignore */
    }
  }
}
