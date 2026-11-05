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
  onStatus(listener: (s: RuntimeStatus) => void): () => void;
}
