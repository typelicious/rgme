import { DEFAULT_DISPLAY_PROFILE, DEFAULT_INPUT_MAPPING, parseGameProfile, type GameProfile } from "@rgme/core";

export function gameIdFromHash(sha256: string): string {
  return `adf-${sha256.slice(0, 12)}`;
}

/** Declarative profile for a user-supplied ADF/IPF/ZIP with intelligent model & Kickstart detection. */
export function buildProfileFromFile(filename: string, sha256: string, title?: string): GameProfile {
  const id = gameIdFromHash(sha256);
  const fn = filename.toUpperCase();

  let model = "A500";
  let chipset = "OCS";
  let kickstart = "1.3";
  let ram = { chipKb: 512, fastKb: 512 };

  if (fn.includes("(AGA)") || fn.includes("A1200")) {
    model = "A1200";
    chipset = "AGA";
    kickstart = "3.1";
    ram = { chipKb: 2048, fastKb: 0 };
  } else if (fn.includes("CD32")) {
    model = "CD32";
    chipset = "AGA";
    kickstart = "3.1";
    ram = { chipKb: 2048, fastKb: 0 };
  } else if (fn.includes("A600")) {
    model = "A600";
    chipset = "ECS";
    kickstart = "3.1";
    ram = { chipKb: 1024, fastKb: 1024 };
  } else if (fn.includes("A500+") || fn.includes("A500PLUS") || fn.includes("(ECS)")) {
    model = "A500Plus";
    chipset = "ECS";
    kickstart = "2.04";
    ram = { chipKb: 1024, fastKb: 1024 };
  }

  const cleanTitle = title ?? filename.replace(/\.(adf|ipf|adz|dms|zip)$/i, "").replace(/ \([A-Za-z0-9, -]+\)/g, "").trim();

  return parseGameProfile({
    schema: "rgme.game/v0.2",
    id,
    title: cleanTitle || filename,
    platform: "amiga",
    machine: { model, chipset, video: "PAL", ram, kickstart },
    media: [{ id: "df0", kind: filename.toLowerCase().endsWith(".ipf") ? "ipf" : "adf", filename, sha256 }],
    runtime: { preferredAdapter: "mock" },
    launch: { bootMediaId: "df0", autoStart: false },
    input: DEFAULT_INPUT_MAPPING,
    display: DEFAULT_DISPLAY_PROFILE,
    rights: { recordId: `rights:${id}:unknown` }
  });
}
