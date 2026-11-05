import type { SaveRecord, SaveStore } from "./types";

const DB = "rgme-saves";
const STORE = "slots";

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((res, rej) => {
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

export class IndexedDbSaveStore implements SaveStore {
  private db?: Promise<IDBDatabase>;

  static available(): boolean {
    return typeof indexedDB !== "undefined";
  }

  private open(): Promise<IDBDatabase> {
    if (!IndexedDbSaveStore.available()) return Promise.reject(new Error("IndexedDB is not available in this browser"));
    this.db ??= new Promise((res, rej) => {
      const o = indexedDB.open(DB, 1);
      o.onupgradeneeded = () => o.result.createObjectStore(STORE, { keyPath: "slot" });
      o.onsuccess = () => res(o.result);
      o.onerror = () => rej(o.error);
    });
    return this.db;
  }

  private async store(mode: IDBTransactionMode) {
    return (await this.open()).transaction(STORE, mode).objectStore(STORE);
  }

  async get(slot: number) {
    return (await req((await this.store("readonly")).get(slot))) as SaveRecord | undefined;
  }
  async put(record: SaveRecord) {
    await req((await this.store("readwrite")).put(record));
  }
  async delete(slot: number) {
    await req((await this.store("readwrite")).delete(slot));
  }
}

/** In-memory store, used when IndexedDB is unavailable. */
export class MemorySaveStore implements SaveStore {
  private m = new Map<number, SaveRecord>();
  async get(slot: number) { return this.m.get(slot); }
  async put(r: SaveRecord) { this.m.set(r.slot, structuredClone(r)); }
  async delete(slot: number) { this.m.delete(slot); }
}
