import type { DisplayProfile, GameProfile, InputMapping, Media } from "./profile.js";

export type RuntimeState = "UNLOADED" | "LOADED" | "RUNNING" | "PAUSED" | "STOPPED";

export interface RuntimeCapabilities {
  id: string;
  name: string;
  videoStandards: Array<"PAL" | "NTSC">;
  frameRateHz: number;
  saveStates: boolean;
  audio: boolean;
}

export interface SaveStateMeta {
  slot: number;
  savedAt: number;
  frame: number;
  profileId: string;
}

export interface RuntimeStatus {
  state: RuntimeState;
  frame: number;
  diskActivity: boolean;
}

/** JSON-serializable runtime state used by the save-state engine. */
export interface RuntimeSnapshot {
  version: 1;
  adapterId: string;
  profileId: string;
  frame: number;
  inputs: string[];
  media: Media[];
  display?: DisplayProfile;
  state: RuntimeState;
}

/** The ONLY surface the UI and profiles may use to reach an emulator. */
export interface RuntimeAdapter {
  readonly state: RuntimeState;
  identifyCapabilities(): RuntimeCapabilities;
  loadGame(profile: GameProfile): Promise<void>;
  start(): void;
  pause(): void;
  reset(): void;
  stop(): void;
  saveState(slot: number): SaveStateMeta;
  loadState(slot: number): SaveStateMeta;
  setInputMapping(mapping: InputMapping): void;
  setDisplayProfile(profile: DisplayProfile): void;
  insertMedia(media: Media): void;
  /** Host input (semantic Amiga joystick actions). */
  pressInput(action: string, down: boolean): void;
  /** Optional: full-state snapshot for the persistent save-state engine. */
  exportSnapshot?(): RuntimeSnapshot;
  importSnapshot?(snapshot: RuntimeSnapshot): void;
  /** Optional: adapters with audio support honour this. */
  setMuted?(muted: boolean): void;
  onStatus(listener: (s: RuntimeStatus) => void): () => void;
}
