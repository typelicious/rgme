import { ChiptunePlayer, type AudioContextLike, type AudioSink } from "../chiptune.js";
import { MockRuntimeAdapter, type CanvasLike } from "../mock-runtime.js";
import type { Platform } from "../profile.js";
import type { RuntimeAdapter } from "../runtime.js";
import { C64RuntimeAdapter } from "./c64-adapter.js";
import { SidPlayer } from "./c64-sid.js";
import { GenesisRuntimeAdapter } from "./genesis-adapter.js";
import { FmPlayer } from "./genesis-fm.js";

export const SUPPORTED_PLATFORMS: readonly Platform[] = ["amiga", "c64", "megadrive"];

/** amiga -> MockRuntimeAdapter (or WASM adapter via the web switch); c64/megadrive -> reference runtimes. */
export function createPlatformAdapter(platform: Platform, canvas?: CanvasLike, audio?: AudioSink): RuntimeAdapter {
  switch (platform) {
    case "amiga":
      return new MockRuntimeAdapter(canvas, undefined, audio);
    case "c64":
      return new C64RuntimeAdapter(canvas, undefined, audio);
    case "megadrive":
      return new GenesisRuntimeAdapter(canvas, undefined, audio);
    default:
      throw new Error(`No runtime adapter for platform "${platform}"`);
  }
}

/** The platform's synthesised soundtrack: Paula-style chiptune, SID-style or FM/PSG-style. */
export function createPlatformAudio(platform: Platform, createContext: () => AudioContextLike | undefined): AudioSink | undefined {
  switch (platform) {
    case "amiga":
      return new ChiptunePlayer(createContext);
    case "c64":
      return new SidPlayer(createContext);
    case "megadrive":
      return new FmPlayer(createContext);
    default:
      return undefined;
  }
}
