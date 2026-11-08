import { parseGameProfile, DEFAULT_DISPLAY_PROFILE, DEFAULT_INPUT_MAPPING, type GameProfile } from "./profile.js";
import type { AssertionStatus, EvidenceRecord, RightsAction, RightsAssertion, RightsRecord, RightsStatus } from "./rights.js";

/** Entry of concept/fixtures/freeware-games.json (hash-identified, rights-evidenced titles). */
export interface FreewareEntry {
  id: string;
  canonical_title: string;
  filename: string;
  sha256: string;
  /** Defaults to 'amiga'. */
  platform?: string;
  machine: { model: string; chipset: string; video: string; ram_chip_kb: number; ram_fast_kb: number };
  rights: {
    rights_class: string;
    status: string;
    opportunity: string;
    rightsholder: string;
    license: string;
    actions: Record<string, string>;
    provenance_note?: string;
  };
}

/** SHA-256 of zero bytes. A placeholder hash must never identify (and thereby authorize) anything. */
export const EMPTY_SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

/** Profiles whose runtime should render a dedicated scene instead of the generic test pattern. */
const SCENES: Record<string, string> = { "rgme-scene-intro": "intro" };

const ACTIONS: RightsAction[] = [
  "private_execution", "binary_redistribution", "browser_hosting", "reverse_engineering",
  "patch_distribution", "modification", "derivative_distribution", "commercial_use"
];

function mapAction(v: string | undefined): AssertionStatus {
  if (v === "allow") return "permitted";
  if (v?.startsWith("deny")) return "prohibited";
  if (v?.startsWith("review")) return "restricted";
  return "unknown";
}

/** Hash lookup only. Titles/filenames are guessable and never grant permission. */
export function findFreewareByHash(entries: readonly FreewareEntry[], sha256: string): FreewareEntry | undefined {
  const h = sha256.toLowerCase();
  if (h === EMPTY_SHA256) return undefined;
  return entries.find((e) => e.sha256.toLowerCase() === h && e.sha256.toLowerCase() !== EMPTY_SHA256);
}

export function freewareEntryToRights(e: FreewareEntry, now = "2026-11-05T00:00:00Z"): { record: RightsRecord; evidence: EvidenceRecord[] } {
  const evId = `ev:${e.id}:fixture-registry`;
  const cls = e.rights.rights_class;
  const status: RightsStatus =
    e.rights.status.includes("public_domain") ? "public_domain" : e.rights.status.includes("freeware") ? "freeware" : "unknown";
  const evidence: EvidenceRecord[] = [
    {
      schema: "rgme.evidence/v0.2",
      id: evId,
      subject: { type: "game", id: e.id },
      claim: e.rights.provenance_note ?? `${e.rights.license} (${e.rights.rightsholder})`,
      source: { type: cls === "A" ? "author" : "license", title: `${e.rights.license} — ${e.rights.rightsholder}` },
      scope: e.sha256,
      confidence: cls === "A" ? "high" : "medium",
      createdAt: now
    }
  ];
  const assertions: RightsAssertion[] = ACTIONS.filter((a) => e.rights.actions[a] !== undefined).map((action) => ({
    action,
    component: "game_binary" as const,
    status: mapAction(e.rights.actions[action]),
    scope: e.rights.actions[action],
    evidenceIds: [evId],
    confidence: cls === "A" ? ("high" as const) : ("medium" as const)
  }));
  return {
    evidence,
    record: {
      schema: "rgme.rights/v0.2",
      id: `rights:${e.id}`,
      gameId: e.id,
      status,
      classification: (["A", "B", "C", "D", "E"].includes(cls) ? cls : "D") as RightsRecord["classification"],
      opportunity: (["GREEN", "LIGHT_GREEN", "YELLOW", "ORANGE", "RED", "GREY"].includes(e.rights.opportunity) ? e.rights.opportunity : "GREY") as RightsRecord["opportunity"],
      copyright: { status: status === "public_domain" ? "public_domain" : "active", currentHolder: e.rights.rightsholder, confidence: cls === "A" ? "high" : "medium" },
      assertions,
      reviewedAt: now,
      notes: [`${e.rights.license}`]
    }
  };
}

const KINDS = ["adf", "ipf", "dms", "d64", "t64", "g64", "st", "msa", "rom", "bin", "md", "sfc", "smc", "nes", "img", "iso"];
function mediaKind(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return KINDS.includes(ext) ? ext : "bin";
}

export function freewareEntryToProfile(e: FreewareEntry): GameProfile {
  const scene = SCENES[e.id];
  return parseGameProfile({
    schema: "rgme.game/v0.2",
    id: e.id,
    title: e.canonical_title,
    platform: e.platform ?? "amiga",
    machine: {
      model: e.machine.model,
      chipset: e.machine.chipset,
      video: e.machine.video,
      ram: { chipKb: e.machine.ram_chip_kb, fastKb: e.machine.ram_fast_kb }
    },
    media: [{ id: "df0", kind: mediaKind(e.filename), filename: e.filename, label: e.canonical_title, sha256: e.sha256 }],
    runtime: { preferredAdapter: "mock", ...(scene ? { options: { scene } } : {}) },
    launch: { bootMediaId: "df0", autoStart: Boolean(scene) },
    input: DEFAULT_INPUT_MAPPING,
    display: { ...DEFAULT_DISPLAY_PROFILE, crt: Boolean(scene) },
    rights: { recordId: `rights:${e.id}` }
  });
}

export interface FreewareClassic {
  id: string;
  title: string;
  developer: string;
  year: number;
  totalDisks: number;
  rightsClass: "C";
  provenance: string;
  disks: Array<{ id: string; label: string; filename: string; sha256: string }>;
}

export const FREEWARE_CLASSICS: readonly FreewareClassic[] = [
  {
    id: "flight-of-the-amazon-queen",
    title: "Flight of the Amazon Queen",
    developer: "Interactive Binary Illusions",
    year: 1995,
    totalDisks: 11,
    rightsClass: "C",
    provenance: "Released as freeware by John Passfield & Steve Stamatiadis in 2004 for ScummVM project.",
    disks: [
      {
        id: "disk-1",
        label: "Disk 1 of 11",
        filename: "Flight of the Amazon Queen (Disk 1 of 11).adf",
        sha256: "3f0063719d4f2ce7bd4204ad1e573e1af52688539a280a032e5d485e27f42cbf"
      },
      {
        id: "disk-2",
        label: "Disk 2 of 11",
        filename: "Flight of the Amazon Queen (Disk 2 of 11).adf",
        sha256: "4421dd21c99189ab6b9d0c13ca415e142bf8f345b9fd5bd87b9c277014683b1e"
      },
      {
        id: "disk-3",
        label: "Disk 3 of 11",
        filename: "Flight of the Amazon Queen (Disk 3 of 11).adf",
        sha256: "69e96b75026d8e0c084f3fcbd7ad882b56a9cf7973b541e70f6e2295d5da827e"
      },
      {
        id: "disk-4",
        label: "Disk 4 of 11",
        filename: "Flight of the Amazon Queen (Disk 4 of 11).adf",
        sha256: "81ac34b42b0be5e86e17af7102aaae6f3d1150fe0fa4880b9477bf7b9959522c"
      },
      {
        id: "disk-5",
        label: "Disk 5 of 11",
        filename: "Flight of the Amazon Queen (Disk 5 of 11).adf",
        sha256: "7631bd7e084b1472ee85fa5f8994d43f40d0010d3a3ba7b9cb20d22b614a4618"
      },
      {
        id: "disk-6",
        label: "Disk 6 of 11",
        filename: "Flight of the Amazon Queen (Disk 6 of 11).adf",
        sha256: "fee57bf2e941bf2aab9657aed57666b344c1cf0561726ed0e94e7f84c9ac7b30"
      },
      {
        id: "disk-7",
        label: "Disk 7 of 11",
        filename: "Flight of the Amazon Queen (Disk 7 of 11).adf",
        sha256: "617395f36628f56412554ca3e174c95e0a737ef0229275573e53c6257715cc23"
      },
      {
        id: "disk-8",
        label: "Disk 8 of 11",
        filename: "Flight of the Amazon Queen (Disk 8 of 11).adf",
        sha256: "b4a2622ab77ae7c3b1fb5d854ad04ff36620f672183210f45b69ae4f509bd811"
      },
      {
        id: "disk-9",
        label: "Disk 9 of 11",
        filename: "Flight of the Amazon Queen (Disk 9 of 11).adf",
        sha256: "c6b1114ec6fb63b1c0b1fdf838cd3f1a3e21c3f5b7f6f6cba9ed0fc604f790ee"
      },
      {
        id: "disk-10",
        label: "Disk 10 of 11",
        filename: "Flight of the Amazon Queen (Disk 10 of 11).adf",
        sha256: "5d7d8668520cef5d24c19783d4f4cf5371a587b3eae03dd5510b5494a9f957c2"
      },
      {
        id: "disk-11",
        label: "Disk 11 of 11",
        filename: "Flight of the Amazon Queen (Disk 11 of 11).adf",
        sha256: "61d60e4eb792e5113292a80301781f458bf48c9e903ea87af862575c32d62145"
      }
    ]
  },
  {
    id: "beneath-a-steel-sky",
    title: "Beneath a Steel Sky",
    developer: "Revolution Software",
    year: 1994,
    totalDisks: 15,
    rightsClass: "C",
    provenance: "Released as freeware by Revolution Software in 2003 with ScummVM collaboration.",
    disks: [
      {
        id: "disk-1",
        label: "Disk 1 of 15",
        filename: "Beneath a Steel Sky (Disk 1 of 15).adf",
        sha256: "40d6ac0cf39b7afda40f9932beaf4fac5c408bd0f3b7124ebf509771c2399372"
      },
      {
        id: "disk-2",
        label: "Disk 2 of 15",
        filename: "Beneath a Steel Sky (Disk 2 of 15).adf",
        sha256: "ae58bc8aab612c0415d98f5c3c75503f099be7cf2a2d35b208d565059d7cfcaa"
      },
      {
        id: "disk-3",
        label: "Disk 3 of 15",
        filename: "Beneath a Steel Sky (Disk 3 of 15).adf",
        sha256: "778d1c893efa057cdea3eab5ec74e46c8dc5afe5932690d9c4456ef66e423c4b"
      },
      {
        id: "disk-4",
        label: "Disk 4 of 15",
        filename: "Beneath a Steel Sky (Disk 4 of 15).adf",
        sha256: "a979c0b5ddbadc6ed506f0f8574ef7bef2a5bff892a77c74aa7b840fd77a1034"
      },
      {
        id: "disk-5",
        label: "Disk 5 of 15",
        filename: "Beneath a Steel Sky (Disk 5 of 15).adf",
        sha256: "ba274bdcd499d99bf42079ab0285d7f876a12a5f18ec3313ffdb6969b8de76b9"
      },
      {
        id: "disk-6",
        label: "Disk 6 of 15",
        filename: "Beneath a Steel Sky (Disk 6 of 15).adf",
        sha256: "8c7936b26b9cb6565c2ed70940da8bac29bbcd76c365bfd39878ac26ae6ca285"
      },
      {
        id: "disk-7",
        label: "Disk 7 of 15",
        filename: "Beneath a Steel Sky (Disk 7 of 15).adf",
        sha256: "bf9a029db3c25aea5549b16234c491bf46d4c097d240601ce5433a2547b0658c"
      },
      {
        id: "disk-8",
        label: "Disk 8 of 15",
        filename: "Beneath a Steel Sky (Disk 8 of 15).adf",
        sha256: "cefaaa2872de133199345713c9245254b7cdd0240c8337ce77721467d301b53c"
      },
      {
        id: "disk-9",
        label: "Disk 9 of 15",
        filename: "Beneath a Steel Sky (Disk 9 of 15).adf",
        sha256: "01d9850bbb5aa15eec27f7f2432d6e85e0514306f8f2399c1492e1b329f17830"
      },
      {
        id: "disk-10",
        label: "Disk 10 of 15",
        filename: "Beneath a Steel Sky (Disk 10 of 15).adf",
        sha256: "e8a738949562854eed571a0686f719216184dacedfdde33ef5a29587e9a171ad"
      },
      {
        id: "disk-11",
        label: "Disk 11 of 15",
        filename: "Beneath a Steel Sky (Disk 11 of 15).adf",
        sha256: "57954ffa19f4d49801574ad1c8a2196c7d2d49d5ce613d132d9f960b2c4dd64f"
      },
      {
        id: "disk-12",
        label: "Disk 12 of 15",
        filename: "Beneath a Steel Sky (Disk 12 of 15).adf",
        sha256: "902a0e6c593c72f714e7910b66c1bc8ec039e95681f7591a44783f64681cb48d"
      },
      {
        id: "disk-13",
        label: "Disk 13 of 15",
        filename: "Beneath a Steel Sky (Disk 13 of 15).adf",
        sha256: "c58e1aa10f84a38b759979ec97b09af00e72a328c3f5cea00891f68905acf248"
      },
      {
        id: "disk-14",
        label: "Disk 14 of 15",
        filename: "Beneath a Steel Sky (Disk 14 of 15).adf",
        sha256: "4052807ef8f7fa7c38bee74e17bb62cb6cb976afc0665bf2f7ccb77156ea34b0"
      },
      {
        id: "disk-15",
        label: "Disk 15 of 15",
        filename: "Beneath a Steel Sky (Disk 15 of 15).adf",
        sha256: "6668477b1432d9b524ef9018ce66301ab6cca3cfe0b433e954f3cc19e701c573"
      }
    ]
  },
  {
    id: "lure-of-the-temptress",
    title: "Lure of the Temptress",
    developer: "Revolution Software",
    year: 1992,
    totalDisks: 4,
    rightsClass: "C",
    provenance: "Released as freeware by Revolution Software in 2003.",
    disks: [
      {
        id: "disk-1",
        label: "Disk 1 of 4",
        filename: "Lure of the Temptress (Disk 1 of 4).adf",
        sha256: "6e7ac7d58057b2c2b07afcabb3fd94ed30fb6b58c876fe417c975d5450fbf21a"
      },
      {
        id: "disk-2",
        label: "Disk 2 of 4",
        filename: "Lure of the Temptress (Disk 2 of 4).adf",
        sha256: "df62f37da18a38aea318c9312b32b445901c0f16934f25259f758a50277bf7f0"
      },
      {
        id: "disk-3",
        label: "Disk 3 of 4",
        filename: "Lure of the Temptress (Disk 3 of 4).adf",
        sha256: "df62f37da18a38aea318c9312b32b445901c0f16934f25259f758a50277bf7f0"
      },
      {
        id: "disk-4",
        label: "Disk 4 of 4",
        filename: "Lure of the Temptress (Disk 4 of 4).adf",
        sha256: "df62f37da18a38aea318c9312b32b445901c0f16934f25259f758a50277bf7f0"
      }
    ]
  }
];

export function createClassicMultiDiskProfile(classic: FreewareClassic): GameProfile {
  return parseGameProfile({
    schema: "rgme.game/v0.2",
    id: classic.id,
    title: classic.title,
    platform: "amiga",
    machine: {
      model: "A500",
      chipset: "OCS",
      video: "PAL",
      ram: { chipKb: 1024, fastKb: 0 }
    },
    media: classic.disks.map((d) => ({
      id: d.id,
      kind: "adf",
      filename: d.filename,
      label: d.label,
      sha256: d.sha256
    })),
    runtime: { preferredAdapter: "mock" },
    launch: { bootMediaId: "disk-1", autoStart: true },
    input: DEFAULT_INPUT_MAPPING,
    display: { ...DEFAULT_DISPLAY_PROFILE, crt: true },
    rights: { recordId: `rights:${classic.id}` }
  });
}
