import type { RuntimeSnapshot } from "@rgme/core";

export const SLOT_MIN = 1;
export const SLOT_MAX = 10;

export interface SaveRecord {
  slot: number;
  title: string;
  profileId: string;
  sha256: string;
  savedAt: number;
  snapshot: RuntimeSnapshot;
  /** PNG data URL; empty string when the canvas could not be captured. */
  thumbnail: string;
}

export interface SaveStore {
  get(slot: number): Promise<SaveRecord | undefined>;
  put(record: SaveRecord): Promise<void>;
  delete(slot: number): Promise<void>;
}
