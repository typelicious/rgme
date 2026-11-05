import {
  GameProfileSchema,
  RightsRecordSchema,
  type GameProfile,
  type RightsRecord,
  type RightsStatus
} from "@rgme/core";

export type RightsClass = "A" | "B" | "C" | "D" | "E";

export interface LibraryRecord {
  /** Equals the SHA-256 of the ADF: the same disk is stored once. */
  id: string;
  sha256: string;
  title: string;
  filename: string;
  size: number;
  addedAt: number;
  profile: GameProfile;
  rights: RightsRecord;
  rightsClass: RightsClass;
  rightsStatus: RightsStatus;
  chipset: string;
  year?: number;
  /** Original ADF bytes, stored as-is and never modified. */
  data: ArrayBuffer;
}

export interface ResolvedGame {
  profile: GameProfile;
  rights: RightsRecord;
  title: string;
  year?: number;
}

export interface LibraryBackend {
  getAll(): Promise<unknown[]>;
  put(record: LibraryRecord): Promise<void>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
}

export class MemoryBackend implements LibraryBackend {
  private map = new Map<string, unknown>();
  async getAll() { return [...this.map.values()]; }
  async put(r: LibraryRecord) { this.map.set(r.id, r); }
  async delete(id: string) { this.map.delete(id); }
  async clear() { this.map.clear(); }
}

const DB = "rgme-library";
const STORE = "games";

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}
function done(tx: IDBTransaction): Promise<void> {
  return new Promise((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); });
}

export class IndexedDbBackend implements LibraryBackend {
  private dbp?: Promise<IDBDatabase>;
  constructor(private readonly factory: IDBFactory) {}

  private db(): Promise<IDBDatabase> {
    this.dbp ??= new Promise((resolve, reject) => {
      const open = this.factory.open(DB, 1);
      open.onupgradeneeded = () => open.result.createObjectStore(STORE, { keyPath: "id" });
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    return this.dbp;
  }
  async getAll() { return req((await this.db()).transaction(STORE).objectStore(STORE).getAll()); }
  async put(r: LibraryRecord) {
    const tx = (await this.db()).transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(r);
    await done(tx);
  }
  async delete(id: string) {
    const tx = (await this.db()).transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    await done(tx);
  }
  async clear() {
    const tx = (await this.db()).transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    await done(tx);
  }
}

/** IndexedDB when available, otherwise a (non-persistent) in-memory backend. */
export function defaultBackend(): LibraryBackend {
  try {
    if (typeof indexedDB !== "undefined" && indexedDB) return new IndexedDbBackend(indexedDB);
  } catch { /* fall through */ }
  return new MemoryBackend();
}

function validate(raw: unknown): LibraryRecord | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Partial<LibraryRecord>;
  if (typeof r.id !== "string" || typeof r.sha256 !== "string" || typeof r.title !== "string" || !isArrayBuffer(r.data)) return undefined;
  const profile = GameProfileSchema.safeParse(r.profile);
  const rights = RightsRecordSchema.safeParse(r.rights);
  if (!profile.success || !rights.success) return undefined;
  return { ...(r as LibraryRecord), profile: profile.data, rights: rights.data };
}

export class GameLibraryStore {
  constructor(private readonly backend: LibraryBackend = defaultBackend()) {}

  async add(source: Blob | ArrayBuffer | Uint8Array, filename: string, sha256: string, resolved: ResolvedGame): Promise<LibraryRecord> {
    const data = await toBuffer(source);
    const record: LibraryRecord = {
      id: sha256,
      sha256,
      title: resolved.title,
      filename,
      size: data.byteLength,
      addedAt: Date.now(),
      profile: resolved.profile,
      rights: resolved.rights,
      rightsClass: resolved.rights.classification,
      rightsStatus: resolved.rights.status,
      chipset: resolved.profile.machine.chipset,
      year: resolved.year,
      data
    };
    await this.backend.put(record);
    return record;
  }
  async list(): Promise<LibraryRecord[]> {
    const all = (await this.backend.getAll()).map(validate).filter((r): r is LibraryRecord => r !== undefined);
    return all.sort((a, b) => b.addedAt - a.addedAt);
  }
  async get(id: string) { return (await this.list()).find((r) => r.id === id); }
  async count() { return (await this.list()).length; }
  remove(id: string) { return this.backend.delete(id); }
  clear() { return this.backend.clear(); }
}

/** Realm-safe check (jsdom / structured clone produce foreign ArrayBuffer instances). */
const isArrayBuffer = (x: unknown): x is ArrayBuffer => Object.prototype.toString.call(x) === "[object ArrayBuffer]";
const isUint8Array = (x: unknown): x is Uint8Array => Object.prototype.toString.call(x) === "[object Uint8Array]";

async function toBuffer(s: Blob | ArrayBuffer | Uint8Array): Promise<ArrayBuffer> {
  if (isArrayBuffer(s)) return s.slice(0);
  if (isUint8Array(s)) return s.buffer.slice(s.byteOffset, s.byteOffset + s.byteLength) as ArrayBuffer;
  if (typeof s.arrayBuffer === "function") return s.arrayBuffer();
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as ArrayBuffer); r.onerror = () => rej(r.error); r.readAsArrayBuffer(s); });
}

export interface LibraryFilter {
  query?: string;
  rightsGroup?: "all" | "cleared" | "local-only";
  platform?: string;
}

const CLEARED_STATUS: ReadonlySet<RightsStatus> = new Set(["public_domain", "freeware", "authorized"]);

/** Cleared = class A/B/C with an evidenced public/freeware/authorized status. Unknown never counts as cleared. */
export function isCleared(r: Pick<LibraryRecord, "rightsClass" | "rightsStatus">): boolean {
  return (r.rightsClass === "A" || r.rightsClass === "B" || r.rightsClass === "C") && CLEARED_STATUS.has(r.rightsStatus);
}

export function filterLibrary(records: readonly LibraryRecord[], f: LibraryFilter = {}): LibraryRecord[] {
  const q = f.query?.trim().toLowerCase();
  return records.filter((r) => {
    if (q && !r.title.toLowerCase().includes(q) && !r.filename.toLowerCase().includes(q)) return false;
    if (f.rightsGroup === "cleared" && !isCleared(r)) return false;
    if (f.rightsGroup === "local-only" && isCleared(r)) return false;
    if (f.platform && f.platform !== "all" && r.profile.platform !== f.platform) return false;
    return true;
  });
}
