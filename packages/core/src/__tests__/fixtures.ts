import type { GameProfile } from "../profile.js";
export const HASH = "a".repeat(64);
export function sampleProfile(over: Partial<GameProfile> = {}): GameProfile {
  return {
    schema: "rgme.game/v0.2",
    id: "demo",
    title: "Demo",
    platform: "amiga",
    machine: { model: "A500", chipset: "OCS", video: "PAL", ram: { chipKb: 512, fastKb: 512 } },
    media: [{ id: "df0", kind: "adf", filename: "demo.adf", sha256: HASH }],
    runtime: { preferredAdapter: "mock" },
    launch: { bootMediaId: "df0", autoStart: true },
    input: { id: "k", keyboard: { Space: "fire" }, gamepad: {} },
    display: { id: "authentic-pal", aspect: "4:3", scaling: "integer", crt: false, aspectAltered: false },
    rights: { recordId: "rights:demo" },
    ...over
  };
}
