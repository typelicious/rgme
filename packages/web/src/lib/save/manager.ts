import type { RuntimeAdapter } from "@rgme/core";
import { sha256Hex } from "../hash";
import { SLOT_MAX, SLOT_MIN, type SaveRecord, type SaveStore } from "./types";

export const SAVE_MAGIC = "RGMESAVE";
export const SAVE_VERSION = 1;

export interface SaveInput {
  adapter: RuntimeAdapter;
  canvas?: { toDataURL?(type?: string): string } | null;
  title: string;
  sha256: string;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

export function assertSlot(slot: number) {
  if (!Number.isInteger(slot) || slot < SLOT_MIN || slot > SLOT_MAX) {
    throw new RangeError(`Save slot must be an integer ${SLOT_MIN}-${SLOT_MAX}`);
  }
}

function captureThumbnail(canvas: SaveInput["canvas"]): string {
  try {
    const url = canvas?.toDataURL?.("image/png") ?? "";
    return url.startsWith("data:image/png") ? url : "";
  } catch {
    return "";
  }
}

export class SaveStateManager {
  constructor(private readonly store: SaveStore, private readonly now: () => number = () => Date.now()) {}

  async save(slot: number, input: SaveInput): Promise<SaveRecord> {
    assertSlot(slot);
    if (!input.adapter.exportSnapshot) throw new Error("This runtime does not support persistent save states");
    const snapshot = input.adapter.exportSnapshot();
    const record: SaveRecord = {
      slot,
      title: input.title,
      profileId: snapshot.profileId,
      sha256: input.sha256,
      savedAt: this.now(),
      snapshot,
      thumbnail: captureThumbnail(input.canvas)
    };
    await this.store.put(record);
    return record;
  }

  async load(slot: number, adapter: RuntimeAdapter, expected?: { sha256: string }): Promise<SaveRecord> {
    assertSlot(slot);
    const rec = await this.store.get(slot);
    if (!rec) throw new Error(`Save slot ${slot} is empty`);
    if (!adapter.importSnapshot) throw new Error("This runtime does not support persistent save states");
    if (expected && rec.sha256.toLowerCase() !== expected.sha256.toLowerCase()) {
      throw new Error(`Save slot ${slot} belongs to a different disk image (${rec.sha256.slice(0, 12)}…)`);
    }
    adapter.importSnapshot(rec.snapshot); // throws on profile mismatch
    return rec;
  }

  async delete(slot: number) {
    assertSlot(slot);
    await this.store.delete(slot);
  }

  /** Always 10 entries (slot 1..10); empty slots are null. */
  async list(): Promise<Array<SaveRecord | null>> {
    const out: Array<SaveRecord | null> = [];
    for (let s = SLOT_MIN; s <= SLOT_MAX; s++) out.push((await this.store.get(s)) ?? null);
    return out;
  }

  /** `.rgmesave`: JSON { magic, version, payload, checksum } where checksum = SHA-256(payload JSON). */
  async exportSlot(slot: number): Promise<Uint8Array> {
    assertSlot(slot);
    const rec = await this.store.get(slot);
    if (!rec) throw new Error(`Save slot ${slot} is empty`);
    const payload = JSON.stringify(rec);
    const checksum = await sha256Hex(enc.encode(payload));
    return enc.encode(JSON.stringify({ magic: SAVE_MAGIC, version: SAVE_VERSION, payload, checksum }));
  }

  async importSave(bytes: Uint8Array, slot: number): Promise<SaveRecord> {
    assertSlot(slot);
    let env: { magic?: unknown; version?: unknown; payload?: unknown; checksum?: unknown };
    try {
      env = JSON.parse(dec.decode(bytes));
    } catch {
      throw new Error("Not a valid .rgmesave file");
    }
    if (env.magic !== SAVE_MAGIC) throw new Error("Not a valid .rgmesave file");
    if (env.version !== SAVE_VERSION) throw new Error(`Unsupported .rgmesave version ${String(env.version)}`);
    if (typeof env.payload !== "string" || typeof env.checksum !== "string") throw new Error("Corrupt .rgmesave file");
    if ((await sha256Hex(enc.encode(env.payload))) !== env.checksum) throw new Error("Integrity check failed: .rgmesave file was modified or corrupted");
    const rec = JSON.parse(env.payload) as SaveRecord;
    if (rec?.snapshot?.version !== 1 || typeof rec.sha256 !== "string") throw new Error("Corrupt .rgmesave payload");
    const imported = { ...rec, slot };
    await this.store.put(imported);
    return imported;
  }
}
