import { DEFAULT_DISPLAY_PROFILE, DEFAULT_INPUT_MAPPING, parseGameProfile, type GameProfile } from "@rgme/core";

export function gameIdFromHash(sha256: string): string {
  return `adf-${sha256.slice(0, 12)}`;
}

/** Declarative profile for a user-supplied ADF with sensible A500/OCS/PAL defaults. The ADF itself is never modified. */
export function buildProfileFromFile(filename: string, sha256: string, title?: string): GameProfile {
  const id = gameIdFromHash(sha256);
  return parseGameProfile({
    schema: "rgme.game/v0.2",
    id,
    title: title ?? filename.replace(/\.adf$/i, ""),
    platform: "amiga",
    machine: { model: "A500", chipset: "OCS", video: "PAL", ram: { chipKb: 512, fastKb: 512 } },
    media: [{ id: "df0", kind: "adf", filename, sha256 }],
    runtime: { preferredAdapter: "mock" },
    launch: { bootMediaId: "df0", autoStart: false },
    input: DEFAULT_INPUT_MAPPING,
    display: DEFAULT_DISPLAY_PROFILE,
    rights: { recordId: `rights:${id}:unknown` }
  });
}
