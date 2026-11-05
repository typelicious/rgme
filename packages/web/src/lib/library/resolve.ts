import { findFreewareByHash, freewareEntryToProfile, freewareEntryToRights, unknownRightsRecord, type FreewareEntry } from "@rgme/core";
import freewareData from "../../../../../concept/fixtures/freeware-games.json";
import { sha256Hex } from "../hash";
import { buildProfileFromFile } from "../profile";
import type { ResolvedGame } from "./store";

const FREEWARE = freewareData as unknown as FreewareEntry[];

/** Identify an ADF by exact SHA-256 only. Anything unrecognized is unknown rights => local play only. */
export async function resolveDroppedAdf(bytes: ArrayBuffer | Uint8Array, filename: string): Promise<{ sha256: string; identified: boolean; resolved: ResolvedGame }> {
  const sha256 = await sha256Hex(bytes);
  const known = findFreewareByHash(FREEWARE, sha256);
  if (known) {
    return { sha256, identified: true, resolved: { profile: freewareEntryToProfile(known), rights: freewareEntryToRights(known).record, title: known.canonical_title } };
  }
  const profile = buildProfileFromFile(filename, sha256);
  return { sha256, identified: false, resolved: { profile, rights: unknownRightsRecord(profile.id), title: profile.title } };
}
