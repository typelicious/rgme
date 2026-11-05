# Retro Game Modernization Engine (RGME)
## MVP Technical Specification / PRD v0.2

**Date:** 2026-10-28  
**Status:** Implementation-ready MVP specification  
**Parent:** `RGME-Overall-Concept-v0.2`  
**Data input:** `RGME-Amiga-Library-Rights-Matrix-v0.1`  
**Primary target:** Amiga 500 / Amiga 600, PAL, browser-first, local-first  
**Implementation posture:** TypeScript monorepo, emulator isolated behind runtime adapter, original game content immutable

---

# 0. Executive Summary

RGME v0.2 is the first implementation milestone of the Retro Game Modernization Engine.

The MVP proves that RGME can:

1. ingest a user-owned/local Amiga game file without modifying it;
2. identify the content by cryptographic hash and declarative metadata;
3. associate it with a machine-readable Game Profile;
4. associate that profile with an evidence-backed Rights Record;
5. evaluate a requested action through a Rights Policy Engine;
6. launch an authorized/local game through an emulator hidden behind a generic `RuntimeAdapter`;
7. translate modern keyboard/gamepad input to Amiga semantics;
8. apply selectable display profiles without misrepresenting scaling as true widescreen;
9. create/load save states;
10. preserve provenance for identity, rights and later research/enhancement operations.

The MVP is **not** a ROM distribution platform, a mass-decompiler, an AI remastering system, or a complete Amiga preservation database.

The central implementation rule is:

> **Original content is immutable. Identity, runtime configuration, rights evidence, controls, presentation, saves and future enhancements are external, versioned layers.**

The central policy rule is:

> **Unknown rights never become permission by inference.**

The MVP acceptance milestone is:

> **At least one legally usable A500/A600 title is identified, rights-evaluated and launched unmodified in RGME in a modern browser, controllable with a modern controller, with selectable display profile and save-state support.**

A three-title rights-cleared/freeware-path demonstrator is the preferred end-of-sprint validation.

---

# 1. Product Requirements

## 1.1 Problem

Classic Amiga games can already be emulated, but the surrounding workflow remains fragmented:

- game files live in arbitrary local archives/folders;
- emulator configuration is runtime-specific;
- modern controls are manually mapped;
- display treatment is emulator-specific;
- game identity and variants are inconsistently represented;
- legal/rightsholder information is normally detached from the executable content;
- preservation/research findings are rarely represented as reproducible evidence;
- modernization patches and replacement assets are not consistently separated from originals.

RGME creates a stable abstraction above these concerns.

## 1.2 MVP users

### Primary — Collection owner
A user with legally possessed/local retro-game files who wants to index and play them through a modern UX without reorganizing or modifying the source library.

### Secondary — RGME developer/researcher
A contributor creating profiles, mappings, rights evidence, runtime adapters and later enhancement/research packages.

### Future — Rights holder / preservation partner
A developer, publisher, author or archive that can explicitly authorize content, source, assets, patches or remaster work.

## 1.3 Jobs to be done

- “Scan my Amiga library without changing it.”
- “Tell me what release RGME thinks this file is.”
- “Launch it without knowing emulator internals.”
- “Use my modern gamepad.”
- “Choose authentic/pixel-perfect/CRT presentation.”
- “Save and resume.”
- “Show me why RGME believes an action is or is not distributable.”
- “Keep the original game separate from profiles and future enhancements.”

---

# 2. Scope

## 2.1 In scope

- Amiga 500 / Amiga 600 first
- PAL first; NTSC represented in schema
- ADF as primary disk format
- extensible support for LHA/WHDLoad-style content identification, but not required as first runtime path
- browser player
- local-first CLI scanner
- SHA-256 content identity
- SQLite registry
- Game Profile v0.2
- Rights Record v0.2
- Evidence Record v0.2
- Runtime Adapter API
- EmulatorJS/libretro/PUAE integration adapter
- keyboard + standard Gamepad API input
- semantic input mapping
- display profiles
- save/load state
- rights-policy evaluation
- three-game demo target
- deterministic validation fixtures using rights-cleared/publicly usable test material

## 2.2 Explicit non-goals

- automatic mass reverse engineering
- Ghidra integration in MVP critical path
- REA agent orchestration in MVP critical path
- Copperline as required runtime
- public hosting of ordinary copyrighted commercial game binaries
- automatic acquisition/download of copyrighted games
- automatic legal conclusions from “abandonware” databases
- full WHDLoad launcher compatibility
- Amiga CD32/CDTV as first-class MVP targets
- C64 support in MVP
- true widescreen patches
- AI-generated replacement art
- automated remaster publication
- cloud account/sync system
- multiplayer/netplay
- achievements
- mobile touch controls beyond architectural placeholders

---

# 3. Success Metrics

## 3.1 Required acceptance metrics

The MVP is accepted when:

- ≥1 rights-cleared/local test title launches successfully in browser through `RuntimeAdapter`.
- Preferred demonstration: 3 distinct titles.
- source content SHA-256 is calculated and stored.
- no source game file is modified.
- Game Profile validates against JSON Schema.
- Rights Record validates against JSON Schema.
- every policy decision exposes status + reason + evidence references.
- keyboard mapping works.
- one standard gamepad works through browser Gamepad API.
- Authentic and Pixel Perfect display profiles work.
- CRT profile is selectable.
- save state can be created and restored during the same compatible runtime version.
- scanner can process a test directory recursively.
- duplicate content is recognized by hash.
- unsupported files do not crash the scan.
- automated unit/integration tests pass.
- Playwright validates the primary launch journey.

## 3.2 Performance targets

MVP targets, not hard platform guarantees:

- UI shell interactive: <2 s on a normal development machine after local assets are available.
- scan metadata overhead: <100 ms/file excluding hashing and archive decompression.
- hash throughput should be I/O-bound rather than deliberately serialized.
- player command response (`pause`, `reset`, display setting): perceived <250 ms where emulator permits.
- SQLite query for one game/profile: <50 ms for MVP-sized registries.

---

# 4. Architectural Principles

1. **Local first.**
2. **Browser first, not browser only.**
3. **Original content immutable.**
4. **Engine ≠ content.**
5. **Game Profile is the central game configuration abstraction.**
6. **Runtime implementation never leaks into product-level semantics.**
7. **Rights are per action/component, never a single boolean.**
8. **Rights assertions require evidence/provenance.**
9. **Unknown defaults to no distribution assumption.**
10. **Presentation scaling is not true widescreen.**
11. **Enhancements are external, versioned and hash-targeted.**
12. **Research findings must later be evidence-backed, not AI assertions.**

---

# 5. System Context

```text
                         ┌─────────────────────┐
                         │    RGME Web App     │
                         │ Library / Player UI │
                         └──────────┬──────────┘
                                    │
                            application services
                                    │
        ┌───────────────────────────┼────────────────────────────┐
        │                           │                            │
        ▼                           ▼                            ▼
   Game/Profile               Rights Policy                Runtime API
      Service                    Engine                         │
        │                           │                            ▼
        │                           │                   EmulatorJS Adapter
        │                           │                            │
        │                           │                       libretro/PUAE
        │                           │
        ▼                           ▼
 Identity Resolver          Rights/Evidence Store
        │                           │
        └─────────────┬─────────────┘
                      ▼
               SQLite Registry
                      ▲
                      │
                 CLI Scanner
                      │
                      ▼
                Local Library
             (read-only source)
```

---

# 6. Monorepo Bootstrap

## 6.1 Repository

```text
retro-game-modernization-engine/
├── apps/
│   ├── web/
│   └── cli/
├── packages/
│   ├── core/
│   ├── db/
│   ├── ingestion/
│   ├── identity/
│   ├── rights/
│   ├── evidence/
│   ├── input/
│   ├── display/
│   ├── saves/
│   ├── runtime-adapter-api/
│   └── runtime-emulatorjs/
├── schemas/
│   ├── game-profile.schema.json
│   ├── rights-record.schema.json
│   ├── evidence.schema.json
│   ├── input-profile.schema.json
│   ├── display-profile.schema.json
│   └── enhancement.schema.json
├── profiles/
│   ├── platforms/
│   ├── machines/
│   ├── input/
│   ├── display/
│   └── games/
├── rights/
│   └── games/
├── fixtures/
│   ├── content/
│   ├── profiles/
│   └── rights/
├── docs/
│   ├── architecture/
│   ├── adr/
│   ├── legal/
│   ├── runtime/
│   └── development/
├── tools/
│   └── validation/
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.base.json
├── eslint.config.js
├── prettier.config.js
├── vitest.workspace.ts
├── README.md
├── CONTRIBUTING.md
├── SECURITY.md
└── LICENSE
```

## 6.2 Tooling

Recommended:

- Node.js 22 LTS or current project-approved LTS
- pnpm workspaces
- TypeScript strict mode
- React
- Vite
- SQLite
- Zod for runtime TypeScript validation
- JSON Schema as portable external contract
- AJV for JSON Schema validation
- Vitest
- Playwright
- ESLint
- Prettier

Do not make Next.js a dependency for the MVP. RGME does not initially require SSR, server routes or a hosted backend. Vite better matches the local/browser runtime spike.

## 6.3 Root scripts

```json
{
  "scripts": {
    "dev": "pnpm --filter @rgme/web dev",
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "test:e2e": "pnpm --filter @rgme/web test:e2e",
    "lint": "pnpm -r lint",
    "typecheck": "pnpm -r typecheck",
    "scan": "pnpm --filter @rgme/cli rgme scan",
    "validate:profiles": "pnpm --filter @rgme/cli rgme validate profiles",
    "validate:rights": "pnpm --filter @rgme/cli rgme validate rights"
  }
}
```

---

# 7. Package Boundaries

## `@rgme/core`

Owns platform-neutral domain types:

- IDs
- `Game`
- `GameProfile`
- `MediaReference`
- machine/platform enums
- common result/error types
- version helpers

Must not depend on UI or emulator implementation.

## `@rgme/db`

Owns:

- SQLite connection
- migrations
- repositories
- transaction helpers
- DB mapping

No product policy belongs here.

## `@rgme/ingestion`

Owns:

- recursive discovery
- file stat
- hashing
- extension/format detection
- archive-entry representation
- scan events
- scan errors

Must not decide rights.

## `@rgme/identity`

Owns:

- canonical-title normalization
- hash matching
- variant extraction
- identity confidence
- canonical-game resolution

Must preserve original filename as evidence.

## `@rgme/rights`

Owns:

- rights domain types
- rights-record validation
- policy evaluation
- action/component matrix
- conservative defaults

Must not fetch/download game content.

## `@rgme/evidence`

Owns:

- evidence records
- provenance
- source snapshots/references
- claim linkage
- confidence vocabulary

## `@rgme/input`

Owns:

- physical input normalization
- semantic actions
- emulated target mapping
- gamepad polling abstraction
- keyboard mapping

## `@rgme/display`

Owns:

- display profiles
- aspect/scaling modes
- shader configuration abstraction
- viewport calculation

## `@rgme/saves`

Owns:

- save-state metadata
- slots
- runtime compatibility identifiers
- file naming/storage

## `@rgme/runtime-adapter-api`

Owns the emulator-independent runtime contract.

## `@rgme/runtime-emulatorjs`

Implements the adapter for EmulatorJS/libretro/PUAE.

No app outside this package may call EmulatorJS-specific APIs directly.

---

# 8. Core TypeScript Domain Contracts

## 8.1 IDs

```ts
export type GameId = string;
export type MediaId = string;
export type ProfileId = string;
export type RightsRecordId = string;
export type EvidenceId = string;
export type RuntimeSessionId = string;
```

Use stable slug/UUID identifiers. Never use mutable display titles as primary keys.

## 8.2 Media

```ts
export type MediaFormat =
  | "adf"
  | "lha"
  | "hdf"
  | "ipf"
  | "dms"
  | "unknown";

export interface ContentHash {
  algorithm: "sha256";
  value: string;
}

export interface MediaReference {
  id: MediaId;
  sourceType: "local-file" | "archive-entry" | "fixture";
  path?: string;
  archivePath?: string;
  entryPath?: string;
  format: MediaFormat;
  sizeBytes?: number;
  hashes: ContentHash[];
  readOnly: true;
}
```

## 8.3 Machine profile

```ts
export interface AmigaMachineProfile {
  platform: "amiga";
  model: "A500" | "A500_PLUS" | "A600";
  cpu: "M68000";
  chipset: "OCS" | "ECS";
  videoStandard: "PAL" | "NTSC";
  chipRamKb: number;
  slowRamKb?: number;
  fastRamKb?: number;
  kickstartRef?: string;
}
```

Firmware references are identifiers only. Proprietary Kickstart ROM bytes are not committed to the RGME repository.

---

# 9. Game Profile v0.2

## 9.1 TypeScript contract

```ts
export interface GameProfileV02 {
  schema: "rgme.game/v0.2";

  game: {
    id: GameId;
    title: string;
    aliases?: string[];
    platform: "amiga";
    releaseYear?: number;
    region?: string;
  };

  identity: {
    hashes: ContentHash[];
    filenameHints?: string[];
    canonicalGroup?: string;
  };

  machine: AmigaMachineProfile;

  media: {
    type: "disk-set" | "single-disk" | "installed";
    items: Array<{
      id: string;
      role: "boot" | "disk" | "data";
      order: number;
      mediaRef?: MediaId;
      expectedHashes?: ContentHash[];
    }>;
  };

  runtime: {
    preferredAdapter: "emulatorjs-puae";
    fallbackAdapters?: string[];
    options?: Record<string, unknown>;
  };

  launch: {
    bootMediaId: string;
    autoStart?: boolean;
  };

  input: {
    profileId: ProfileId;
  };

  display: {
    defaultProfileId: ProfileId;
    supportedProfileIds: ProfileId[];
  };

  rights: {
    recordId: RightsRecordId;
  };

  enhancements: {
    packages: string[];
  };

  research: {
    status:
      | "unanalysed"
      | "identified"
      | "static-analysis"
      | "dynamic-analysis"
      | "documented";
  };
}
```

## 9.2 JSON Schema minimum

`schemas/game-profile.schema.json` must:

- set `$schema` to JSON Schema Draft 2020-12;
- require `schema`, `game`, `identity`, `machine`, `media`, `runtime`, `launch`, `input`, `display`, `rights`;
- use `additionalProperties: false` at stable object boundaries;
- validate SHA-256 as 64 lowercase/uppercase hex characters;
- constrain `schema` to `rgme.game/v0.2`;
- validate supported Amiga model/chipset/video values;
- permit extension through explicitly defined `options` maps rather than arbitrary top-level fields.

Example:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://rgme.dev/schemas/game-profile-v0.2.json",
  "title": "RGME Game Profile v0.2",
  "type": "object",
  "required": [
    "schema",
    "game",
    "identity",
    "machine",
    "media",
    "runtime",
    "launch",
    "input",
    "display",
    "rights"
  ],
  "properties": {
    "schema": { "const": "rgme.game/v0.2" },
    "game": {
      "type": "object",
      "additionalProperties": false,
      "required": ["id", "title", "platform"],
      "properties": {
        "id": { "type": "string", "minLength": 1 },
        "title": { "type": "string", "minLength": 1 },
        "aliases": {
          "type": "array",
          "items": { "type": "string" },
          "uniqueItems": true
        },
        "platform": { "const": "amiga" },
        "releaseYear": {
          "type": "integer",
          "minimum": 1985,
          "maximum": 2100
        },
        "region": { "type": "string" }
      }
    }
  }
}
```

The implementation must contain the complete schema, not only the excerpt above.

---

# 10. Rights Record v0.2

## 10.1 Actions

```ts
export type RightsAction =
  | "private_execution"
  | "binary_redistribution"
  | "browser_hosting"
  | "reverse_engineering"
  | "patch_distribution"
  | "modification"
  | "derivative_distribution"
  | "commercial_use";
```

## 10.2 Components

```ts
export type RightsComponent =
  | "game_binary"
  | "source_code"
  | "graphics"
  | "music_audio"
  | "story_text"
  | "manual_box_art"
  | "trademark";
```

## 10.3 Assertion status

```ts
export type RightsAssertionStatus =
  | "permitted"
  | "prohibited"
  | "restricted"
  | "unknown"
  | "not_applicable";
```

`unknown` is not equivalent to `prohibited` as a legal claim. It **does** cause RGME's distribution policy to deny automated distribution until reviewed.

## 10.4 Record

```ts
export interface RightsRecordV02 {
  schema: "rgme.rights/v0.2";
  id: RightsRecordId;
  gameId: GameId;

  classification: "A" | "B" | "C" | "D" | "E";

  opportunity:
    | "GREEN"
    | "LIGHT_GREEN"
    | "YELLOW"
    | "ORANGE"
    | "RED"
    | "GREY";

  copyright?: {
    status: "active" | "expired" | "public_domain" | "unknown";
    currentHolder?: string;
    confidence: "low" | "medium" | "high" | "verified";
  };

  assertions: Array<{
    action: RightsAction;
    component: RightsComponent;
    status: RightsAssertionStatus;
    scope?: string;
    territory?: string[];
    versionScope?: string[];
    conditions?: string[];
    evidenceIds: EvidenceId[];
    confidence: "low" | "medium" | "high" | "verified";
  }>;

  reviewedAt: string;
  notes?: string[];
}
```

## 10.5 Policy behavior

Policy is **operation-specific**.

Example:

```ts
export interface RightsPolicyRequest {
  gameId: GameId;
  action: RightsAction;
  components: RightsComponent[];
  releaseHashes?: string[];
  context: {
    mode: "local" | "public" | "development";
    commercial: boolean;
  };
}

export interface RightsPolicyDecision {
  decision: "allow" | "deny" | "review";
  reasonCodes: string[];
  matchedAssertions: string[];
  evidenceIds: EvidenceId[];
}
```

Rules:

```text
explicit permitted + scope matches     -> allow
explicit prohibited + scope matches    -> deny
restricted                             -> review unless machine-evaluable conditions pass
unknown + local private execution      -> review/allow only according to configured local policy
unknown + distribution/browser hosting -> deny
conflicting evidence                   -> review
missing rights record                  -> deny distribution; local runtime may use BYOG policy
```

The UI must never display a generic “LEGAL” badge. It should display action-specific language such as:

- “Local execution: allowed by local/BYOG policy”
- “Binary redistribution: authorized for this release”
- “Remaster distribution: not verified”
- “Browser hosting: review required”

---

# 11. Evidence Record v0.2

```ts
export interface EvidenceRecordV02 {
  schema: "rgme.evidence/v0.2";
  id: EvidenceId;

  subject: {
    type: "game" | "release" | "rights-holder" | "rights-assertion";
    id: string;
  };

  claim: string;

  source: {
    type:
      | "official-rightsholder"
      | "author"
      | "license"
      | "authorized-distributor"
      | "statute"
      | "secondary-source"
      | "local-observation";
    title: string;
    uri?: string;
    accessedAt?: string;
  };

  excerpt?: string;
  scope?: string;
  confidence: "low" | "medium" | "high" | "verified";
  contradicts?: EvidenceId[];
  createdAt: string;
}
```

Evidence must be appendable and auditable. A rights assertion references evidence; it does not duplicate source prose.

---

# 12. SQLite Data Model

## 12.1 Required tables

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE games (
  id TEXT PRIMARY KEY,
  canonical_title TEXT NOT NULL,
  platform TEXT NOT NULL,
  release_year INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE game_aliases (
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  PRIMARY KEY (game_id, alias)
);

CREATE TABLE media (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_path TEXT,
  archive_path TEXT,
  entry_path TEXT,
  format TEXT NOT NULL,
  size_bytes INTEGER,
  read_only INTEGER NOT NULL DEFAULT 1 CHECK(read_only = 1),
  discovered_at TEXT NOT NULL
);

CREATE TABLE media_hashes (
  media_id TEXT NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  algorithm TEXT NOT NULL,
  hash TEXT NOT NULL,
  PRIMARY KEY (media_id, algorithm, hash)
);

CREATE UNIQUE INDEX idx_media_sha256
ON media_hashes(algorithm, hash)
WHERE algorithm = 'sha256';

CREATE TABLE game_media (
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  media_id TEXT NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  disk_order INTEGER,
  PRIMARY KEY (game_id, media_id)
);

CREATE TABLE game_profiles (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  schema_version TEXT NOT NULL,
  profile_json TEXT NOT NULL,
  source_path TEXT,
  validated_at TEXT
);

CREATE TABLE identity_matches (
  id TEXT PRIMARY KEY,
  media_id TEXT NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  game_id TEXT REFERENCES games(id) ON DELETE SET NULL,
  method TEXT NOT NULL,
  confidence REAL NOT NULL CHECK(confidence >= 0 AND confidence <= 1),
  explanation TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE rights_records (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  schema_version TEXT NOT NULL,
  classification TEXT NOT NULL,
  opportunity TEXT NOT NULL,
  record_json TEXT NOT NULL,
  reviewed_at TEXT NOT NULL
);

CREATE TABLE evidence (
  id TEXT PRIMARY KEY,
  schema_version TEXT NOT NULL,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  claim TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_title TEXT NOT NULL,
  source_uri TEXT,
  accessed_at TEXT,
  confidence TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE rights_assertions (
  id TEXT PRIMARY KEY,
  rights_record_id TEXT NOT NULL REFERENCES rights_records(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  component TEXT NOT NULL,
  status TEXT NOT NULL,
  scope TEXT,
  confidence TEXT NOT NULL,
  assertion_json TEXT NOT NULL
);

CREATE TABLE rights_assertion_evidence (
  assertion_id TEXT NOT NULL REFERENCES rights_assertions(id) ON DELETE CASCADE,
  evidence_id TEXT NOT NULL REFERENCES evidence(id) ON DELETE CASCADE,
  PRIMARY KEY (assertion_id, evidence_id)
);

CREATE TABLE input_profiles (
  id TEXT PRIMARY KEY,
  schema_version TEXT NOT NULL,
  profile_json TEXT NOT NULL
);

CREATE TABLE display_profiles (
  id TEXT PRIMARY KEY,
  schema_version TEXT NOT NULL,
  profile_json TEXT NOT NULL
);

CREATE TABLE runtime_sessions (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES games(id),
  adapter_id TEXT NOT NULL,
  adapter_version TEXT NOT NULL,
  core_id TEXT,
  core_version TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT
);

CREATE TABLE save_states (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES games(id),
  runtime_session_id TEXT REFERENCES runtime_sessions(id),
  slot TEXT NOT NULL,
  state_path TEXT NOT NULL,
  game_hash TEXT NOT NULL,
  adapter_id TEXT NOT NULL,
  adapter_version TEXT NOT NULL,
  core_version TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(game_id, slot)
);

CREATE TABLE scan_runs (
  id TEXT PRIMARY KEY,
  root_path TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  files_seen INTEGER NOT NULL DEFAULT 0,
  files_hashed INTEGER NOT NULL DEFAULT 0,
  errors INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE scan_errors (
  id TEXT PRIMARY KEY,
  scan_run_id TEXT NOT NULL REFERENCES scan_runs(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  error_code TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

## 12.2 Migration strategy

- migrations committed as ordered SQL files;
- schema version stored in `PRAGMA user_version` or a dedicated migration table;
- no destructive migration without explicit backup path;
- registry can be rebuilt from source files/profiles/rights data, but saves are user data and must be preserved.

---

# 13. Library Scanner

## 13.1 CLI

```bash
rgme scan ~/Retro/Amiga
rgme scan ~/Retro/Amiga --dry-run
rgme scan ~/Retro/Amiga --hash sha256
rgme scan ~/Retro/Amiga --formats adf,lha
rgme scan ~/Retro/Amiga --json
```

## 13.2 Contract

```ts
export interface ScanOptions {
  rootPath: string;
  recursive: boolean;
  hash: "sha256" | "none";
  allowedFormats?: MediaFormat[];
  followSymlinks: boolean;
  dryRun: boolean;
}

export type ScanEvent =
  | { type: "scan-started"; runId: string; rootPath: string }
  | { type: "file-discovered"; path: string; sizeBytes: number }
  | { type: "file-classified"; path: string; format: MediaFormat }
  | { type: "file-hashed"; path: string; sha256: string }
  | { type: "identity-resolved"; path: string; gameId?: string; confidence: number }
  | { type: "scan-warning"; path?: string; code: string; message: string }
  | { type: "scan-finished"; runId: string; summary: ScanSummary };
```

## 13.3 Scanner safety

Default:

- read only;
- never rename;
- never move;
- never delete;
- never rewrite archive contents;
- never execute discovered binaries;
- symlinks not followed unless explicit;
- paths canonicalized;
- filesystem errors isolated to individual records;
- hashing streams bytes; no need to load entire disk image into memory.

## 13.4 Archive handling

MVP distinction:

1. **Listing ingestion** — may record an `.lha`/archive as a media object.
2. **Runtime extraction** — only when required and only into RGME-controlled temporary/cache storage.
3. **Source archive** remains immutable.

Archive extraction must protect against:

- path traversal (`../`);
- absolute paths;
- symlink escape;
- decompression bombs via configured size limits;
- unexpected executable auto-launch.

---

# 14. Identity Resolver

## 14.1 Resolution order

```text
1 exact SHA-256 match
2 known release hash database
3 exact normalized filename + variant
4 canonical title + structured variant hints
5 fuzzy title candidate
6 unresolved
```

Only levels 1–2 should normally produce `confidence >= 0.95`.

Filename inference is a candidate-generation mechanism, not proof of exact release identity.

## 14.2 Variant extraction

Recognize hints such as:

- `(DE)`, `(FR)`, `(ES)`, `(IT)`
- `(NTSC)`
- `(Demo)`
- `(1MB)`, `(2MB)`, `(512k)`
- `CDTV`
- `Data Disk`
- disk number
- early build/beta markers

Preserve the raw filename unchanged.

## 14.3 Result

```ts
export interface IdentityCandidate {
  gameId: GameId;
  releaseId?: string;
  confidence: number;
  method:
    | "sha256"
    | "known-hash"
    | "filename-exact"
    | "filename-normalized"
    | "fuzzy";
  reasons: string[];
}
```

---

# 15. Runtime Adapter API

## 15.1 Core contract

```ts
export interface RuntimeCapabilities {
  platforms: string[];
  mediaFormats: MediaFormat[];
  saveStates: boolean;
  screenshots: boolean;
  gamepad: boolean;
  keyboard: boolean;
  mouse: boolean;
  shaders: boolean;
  diskSwap: boolean;
}

export interface RuntimeLoadRequest {
  game: GameProfileV02;
  media: MediaReference[];
  firmware?: MediaReference[];
}

export interface RuntimeAdapter {
  readonly id: string;
  readonly version: string;

  identifyCapabilities(): Promise<RuntimeCapabilities>;

  initialize(container: HTMLElement): Promise<void>;
  load(request: RuntimeLoadRequest): Promise<void>;

  start(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  reset(kind?: "soft" | "hard"): Promise<void>;
  stop(): Promise<void>;

  insertMedia(media: MediaReference, drive?: number): Promise<void>;

  setInputMapping(mapping: ResolvedInputMapping): Promise<void>;
  setDisplayProfile(profile: ResolvedDisplayProfile): Promise<void>;

  saveState(slot: string): Promise<Uint8Array>;
  loadState(slot: string, state: Uint8Array): Promise<void>;

  screenshot(): Promise<Blob>;

  getStatus(): RuntimeStatus;
  dispose(): Promise<void>;
}
```

## 15.2 State machine

```text
UNINITIALIZED
    |
    v
INITIALIZED
    |
    v
LOADED
    |
    +--> RUNNING <--> PAUSED
    |       |
    |       +--> RESETTING --> RUNNING
    |
    +--> STOPPED
            |
            v
         DISPOSED
```

Invalid transitions must return typed errors rather than silently failing.

---

# 16. EmulatorJS / PUAE Integration

## 16.1 Boundary

`@rgme/runtime-emulatorjs` owns all knowledge of:

- EmulatorJS global/configuration APIs;
- libretro core selection;
- PUAE core configuration;
- emulator canvas/container lifecycle;
- media mounting;
- emulator-specific input codes;
- emulator-specific save-state APIs;
- shader/config translation.

The web app sees only `RuntimeAdapter`.

## 16.2 Boot sequence

```text
Player route opened
  -> load Game Profile
  -> resolve local MediaReference(s)
  -> policy check: private_execution
  -> resolve firmware reference
  -> create EmulatorJsPuaeAdapter
  -> initialize DOM container
  -> translate Game Profile -> PUAE runtime config
  -> mount boot ADF
  -> apply input mapping
  -> apply display profile
  -> start
```

## 16.3 Firmware

RGME repository must not contain proprietary Kickstart ROM bytes unless an explicit redistributable license exists.

Firmware resolver:

```ts
export interface FirmwareResolver {
  resolve(ref: string): Promise<MediaReference | null>;
}
```

A missing required firmware produces a guided configuration error, not a download from an unofficial source.

## 16.4 Emulator assets

Pin runtime/core versions for reproducibility. Do not consume mutable “latest” core assets in production builds.

Store:

- adapter version
- EmulatorJS version
- core identifier
- core version/hash

in runtime/save-state metadata.

---

# 17. Local File Handling

A pure browser cannot freely traverse arbitrary local paths. Therefore MVP uses a split local architecture:

```text
CLI / local service
  -> scans filesystem
  -> stores registry
  -> exposes approved local media to player

Browser UI
  -> requests media by RGME media ID
  -> never receives arbitrary filesystem authority
```

Implementation options:

### Preferred MVP
A minimal local Node process started with the CLI serves:

- registry API
- approved media streams
- save-state storage
- profile/rights records

bound to loopback only.

Example:

```text
http://127.0.0.1:4765
```

The web UI may be served by the same local process in packaged/dev mode.

### Security requirements

- bind `127.0.0.1`, not `0.0.0.0`, by default;
- random per-session bearer token or same-origin session secret;
- CORS deny-by-default;
- no endpoint accepting arbitrary absolute file paths from browser;
- browser requests media by opaque ID;
- server verifies media ID exists in registry;
- no directory listing endpoint outside registered roots;
- Content Security Policy in web app;
- no telemetry by default.

---

# 18. Local API

Minimal endpoints:

```text
GET  /api/health
GET  /api/games
GET  /api/games/:id
GET  /api/games/:id/profile
GET  /api/games/:id/rights
POST /api/rights/evaluate
GET  /api/media/:id
GET  /api/saves/:gameId
POST /api/saves/:gameId/:slot
GET  /api/saves/:gameId/:slot
DELETE /api/saves/:gameId/:slot
POST /api/scan
GET  /api/scan/:runId
```

Do not expose raw source paths unless the local user explicitly requests diagnostics.

---

# 19. Input Model

## 19.1 Three layers

```text
Physical input
   ↓
Semantic RGME action
   ↓
Emulated Amiga target
```

Example:

```text
Gamepad Button South
   -> PLAYER_PRIMARY_ACTION
   -> JOYSTICK_PORT_2_FIRE_1
```

## 19.2 Contract

```ts
export type SemanticAction =
  | "MOVE_UP"
  | "MOVE_DOWN"
  | "MOVE_LEFT"
  | "MOVE_RIGHT"
  | "PRIMARY_ACTION"
  | "SECONDARY_ACTION"
  | "START"
  | "SELECT"
  | "PAUSE"
  | "MENU";

export interface InputBinding {
  source: {
    device: "keyboard" | "gamepad";
    control: string;
  };
  semanticAction: SemanticAction;
  target: {
    device: "amiga-joystick" | "amiga-keyboard" | "amiga-mouse";
    control: string;
    port?: 1 | 2;
  };
}

export interface InputProfile {
  schema: "rgme.input/v0.2";
  id: ProfileId;
  bindings: InputBinding[];
}
```

## 19.3 MVP defaults

Typical modern profile:

```text
D-pad / left stick -> Amiga joystick directions
A / Cross          -> Fire 1
B / Circle         -> optional game-specific key/fire
Start              -> game-specific Start/Space/Return
Select             -> game-specific Escape
```

Do not assume all games use joystick port 2 or the same keyboard semantics. That belongs in the game profile/input profile.

---

# 20. Display Model

## 20.1 Profiles

MVP:

- `authentic`
- `pixel-perfect`
- `crt`
- `modern-screen`

## 20.2 Contract

```ts
export interface DisplayProfile {
  schema: "rgme.display/v0.2";
  id: ProfileId;
  label: string;

  scaling: "native" | "integer" | "fit";
  aspect: "source" | "4:3" | "fit-container";
  overscan: "preserve" | "crop-safe";
  smoothing: "nearest" | "linear";

  shader?: {
    id: string;
    params?: Record<string, number | boolean | string>;
  };

  claimsTrueWidescreen: false;
}
```

For MVP, `claimsTrueWidescreen` is always false.

A future game-specific enhancement can introduce a separate capability such as:

```ts
worldViewportMode: "patched-widescreen"
```

only when supported by a hash-targeted patch and technical evidence.

---

# 21. Save-State Model

Save states are not assumed portable across emulator/core versions.

Metadata:

```ts
export interface SaveStateMetadata {
  id: string;
  gameId: GameId;
  slot: string;
  gameSha256: string;
  adapterId: string;
  adapterVersion: string;
  coreId: string;
  coreVersion?: string;
  createdAt: string;
}
```

Before loading:

```text
game hash mismatch    -> block
adapter mismatch      -> warn/block according to compatibility table
core major mismatch   -> warn/block
known compatible      -> load
```

Save files live in RGME-controlled user-data storage, never inside the original game directory by default.

---

# 22. Rights Policy Engine

## 22.1 Purpose

The engine answers:

> “Given this exact identified release, intended action, components and context, what may RGME automate based on the evidence currently recorded?”

It does **not** claim to replace legal review.

## 22.2 Policy examples

### Local BYOG execution

Input:

```json
{
  "action": "private_execution",
  "components": ["game_binary"],
  "context": {
    "mode": "local",
    "commercial": false
  }
}
```

Possible result:

```json
{
  "decision": "allow",
  "reasonCodes": ["LOCAL_BYOG_POLICY"],
  "matchedAssertions": [],
  "evidenceIds": []
}
```

This is an RGME operational policy decision, not a universal legal declaration.

### Browser distribution

If no explicit evidence:

```json
{
  "decision": "deny",
  "reasonCodes": ["NO_DISTRIBUTION_PERMISSION_EVIDENCE"],
  "matchedAssertions": [],
  "evidenceIds": []
}
```

### Freeware release

If exact release scope and evidence match:

```json
{
  "decision": "allow",
  "reasonCodes": ["EXPLICIT_REDISTRIBUTION_PERMISSION"],
  "matchedAssertions": ["assertion-123"],
  "evidenceIds": ["evidence-456"]
}
```

### Remaster

Freeware binary permission but no derivative rights:

```json
{
  "decision": "review",
  "reasonCodes": ["DERIVATIVE_RIGHTS_UNVERIFIED"],
  "matchedAssertions": [],
  "evidenceIds": ["evidence-freeware-release"]
}
```

---

# 23. Rights Matrix Import

The existing `RGME-Amiga-Library-Rights-Matrix-v0.1.json` is a seed research dataset, not automatically trusted production policy.

Import command:

```bash
rgme rights import ./data/RGME-Amiga-Library-Rights-Matrix-v0.1.json
```

Import stages:

```text
parse
 -> schema/shape validate
 -> preserve source filename
 -> map canonical group
 -> import verified seed assertions
 -> mark unreviewed rows as research_required
 -> never synthesize permissions from empty fields
```

The original audit contains 2,992 listed files and approximately 2,369 heuristic canonical groups. Those groups are leads until exact release identity is established by hashes or stronger metadata.

---

# 24. Web Application

## 24.1 Routes

```text
/                       Library
/game/:gameId            Game detail
/player/:gameId          Player
/rights/:gameId          Rights/evidence detail
/settings                Local runtime/settings
```

## 24.2 Library card

Shows:

- title
- platform
- variant
- identity confidence
- local media available
- rights status summary for local execution
- Play button only if runtime prerequisites are satisfied

Do not show a misleading universal green/red legality badge.

## 24.3 Player

Controls:

```text
[ Back ] [ Pause ] [ Reset ] [ Save ] [ Load ]
[ Display ▼ ] [ Input ▼ ] [ Fullscreen ]
```

Secondary panel:

- machine profile
- media/disk state
- runtime/core version
- identity
- rights/evidence link

## 24.4 Rights panel

Example:

```text
Local execution       ALLOWED BY RGME LOCAL/BYOG POLICY
Binary redistribution VERIFIED FOR THIS RELEASE
Browser hosting       REVIEW REQUIRED
Modification          UNKNOWN
Remaster distribution UNKNOWN

Evidence:
- Authorized distributor record ...
- Rights-holder statement ...
```

---

# 25. Error Model

```ts
export type RgmeErrorCode =
  | "MEDIA_NOT_FOUND"
  | "MEDIA_HASH_MISMATCH"
  | "UNSUPPORTED_MEDIA_FORMAT"
  | "IDENTITY_UNRESOLVED"
  | "PROFILE_INVALID"
  | "RIGHTS_RECORD_INVALID"
  | "RIGHTS_POLICY_DENIED"
  | "RIGHTS_POLICY_REVIEW_REQUIRED"
  | "FIRMWARE_MISSING"
  | "RUNTIME_INITIALIZATION_FAILED"
  | "RUNTIME_INVALID_STATE"
  | "SAVE_STATE_INCOMPATIBLE"
  | "ARCHIVE_UNSAFE"
  | "LOCAL_API_UNAVAILABLE";

export class RgmeError extends Error {
  constructor(
    public readonly code: RgmeErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
  }
}
```

Errors shown to users should distinguish:

- technical failure;
- missing local prerequisite;
- unresolved identity;
- rights-policy restriction.

---

# 26. Security and Trust Boundaries

## 26.1 Untrusted inputs

Treat as untrusted:

- filenames
- archive entries
- game binaries
- profile contributions
- rights/evidence imports
- enhancement packages
- save-state files from outside RGME
- shader packages

## 26.2 Required controls

- source library read-only
- archive path sanitization
- maximum extracted size
- file-type allowlist
- no automatic execution
- local API loopback binding
- opaque media IDs
- CSP
- dependency pinning/lockfile
- checksum runtime assets where practical
- schema validation before profile/rights import
- enhancement packages cannot write arbitrary filesystem paths
- no remote analytics by default

## 26.3 Enhancement trust

Future packages need:

```text
manifest
hash
target game hashes
declared operations
rights metadata
optional signature
```

MVP only establishes the boundary.

---

# 27. Test Strategy

## 27.1 Unit tests

### Ingestion
- detects `.adf`
- detects `.lha`
- ignores unsupported files safely
- SHA-256 deterministic
- does not mutate source
- symlink behavior correct

### Identity
- exact hash wins over filename
- language tags parsed
- NTSC/PAL hints preserved
- demo/data-disk hints preserved
- fuzzy match never silently becomes verified

### Rights
- explicit permission allows scoped action
- explicit prohibition denies
- unknown distribution denies
- conflicting assertions return review
- component mismatch does not leak permission
- release/hash scope enforced

### Input
- physical → semantic → emulator mapping
- game-specific override
- no duplicate impossible mapping unless explicitly supported

### Display
- integer scaling calculations
- aspect preservation
- CRT profile config
- no profile reports true widescreen

### Saves
- metadata created
- hash mismatch blocked
- incompatible core version handled

## 27.2 Integration tests

- scanner → DB → identity candidate
- profile load → rights lookup
- policy evaluation → player launch authorization
- local API media stream by opaque ID
- save state round trip with mocked runtime
- EmulatorJS adapter contract test with fixture/runtime smoke test

## 27.3 E2E

Playwright:

```text
1 start local RGME service
2 load fixture library
3 open library
4 select test game
5 inspect identity
6 inspect rights
7 launch
8 change display profile
9 trigger mapped input
10 save
11 reset
12 load
13 verify player returns to expected runtime state
```

## 27.4 Golden fixtures

Use small rights-cleared/publicly usable fixtures and metadata in CI.

Do not put commercial Amiga binaries in the public repository merely because they are useful tests.

---

# 28. Observability

Local structured logs:

```json
{
  "timestamp": "...",
  "level": "info",
  "event": "runtime.game.loaded",
  "gameId": "...",
  "mediaId": "...",
  "adapter": "emulatorjs-puae"
}
```

Never log:

- full proprietary binary content;
- secrets/session tokens;
- unnecessary absolute user paths in normal logs.

Useful events:

```text
scan.started
scan.file.discovered
scan.file.hashed
identity.matched
identity.unresolved
rights.evaluated
runtime.initialized
runtime.game.loaded
runtime.error
save.created
save.loaded
```

---

# 29. CLI v0.2

```text
rgme init
rgme serve
rgme scan <path>
rgme library list
rgme game show <id>
rgme identify <file|media-id>
rgme profile validate <path>
rgme rights show <game-id>
rgme rights evaluate <game-id> --action <action>
rgme rights import <file>
rgme doctor
```

`rgme doctor` checks:

- DB writable
- configured library roots readable
- runtime assets present
- firmware references resolved
- schemas valid
- local API bind available

---

# 30. Configuration

Example:

```yaml
schema: rgme.config/v0.2

server:
  host: 127.0.0.1
  port: 4765

library:
  roots:
    - ~/Retro/Amiga
  readOnly: true
  followSymlinks: false

registry:
  database: ~/.rgme/registry.sqlite

storage:
  saves: ~/.rgme/saves
  cache: ~/.rgme/cache

runtime:
  defaultAdapter: emulatorjs-puae

privacy:
  telemetry: false
```

Environment variables may override operational settings, but game/profile configuration belongs in declarative profile files.

---

# 31. ADR Set for MVP

```text
ADR-001 Local-first architecture
ADR-002 Original game files are immutable
ADR-003 Game Profile is central abstraction
ADR-004 Runtime adapters isolate emulator implementations
ADR-005 Browser-first frontend
ADR-006 SQLite for MVP registry
ADR-007 EmulatorJS/libretro/PUAE initial runtime
ADR-008 Reverse engineering outside MVP critical path
ADR-009 Enhancement packages declarative/versioned
ADR-010 Engine and copyrighted content separated
ADR-011 Rights modeled per action
ADR-012 Rights claims require evidence
ADR-013 Abandonware is not a rights classification
ADR-014 Freeware redistribution != derivative rights
ADR-015 Rights may differ by component
ADR-016 Public profiles/patches do not bundle original binaries
ADR-017 Unknown rights default to no distribution assumption
ADR-018 Browser receives media by opaque ID, not arbitrary filesystem path
ADR-019 Exact content hash outranks filename identity
ADR-020 Save-state compatibility is versioned
```

---

# 32. Seven-Day MVP Execution Plan

## Day 1 — Runtime spike

Deliver:

- monorepo
- Vite/React app
- EmulatorJS/PUAE proof
- one rights-cleared/local ADF
- PAL video
- audio
- basic keyboard

Exit:

> A real Amiga title runs in browser from RGME development shell.

## Day 2 — Runtime boundary + player

Deliver:

- `RuntimeAdapter`
- EmulatorJS implementation
- `/player/:gameId`
- start/pause/resume/reset/fullscreen
- runtime state machine

Exit:

> Web app contains no direct EmulatorJS calls outside adapter package.

## Day 3 — Profiles + rights

Deliver:

- Game Profile Schema
- Rights Record Schema
- Evidence Schema
- AJV validation
- Rights Policy Engine
- first verified seed record

Exit:

> Player launch passes through policy evaluation.

## Day 4 — Scanner + registry + identity

Deliver:

- CLI
- recursive scan
- SHA-256
- format detection
- SQLite migrations
- exact hash identity
- filename candidate identity
- imported sample of existing Amiga listing/matrix

Exit:

> Local content appears in library without source modification.

## Day 5 — Modern controls

Deliver:

- keyboard abstraction
- Gamepad API
- semantic mapping
- game-specific input profile
- UI selector/status

Exit:

> Test title is comfortably playable with a modern controller.

## Day 6 — Display + saves

Deliver:

- Authentic
- Pixel Perfect
- CRT
- Modern Screen
- save/load slots
- compatibility metadata

Exit:

> User can switch presentation and restore a save state.

## Day 7 — Demonstrator

Deliver:

- target 3 rights-cleared/freeware-path titles
- library UI
- game detail
- rights/evidence panel
- player
- README
- screenshots
- automated smoke/E2E
- known limitations
- next backlog

Exit:

> RGME can be demonstrated end-to-end without bundling ordinary copyrighted commercial content.

---

# 33. Issue Backlog

## Epic A — Repository/Foundation

### RGME-001 Bootstrap pnpm TypeScript monorepo
**AC**
- workspace packages resolve;
- strict TypeScript;
- lint/typecheck/test root commands pass.

### RGME-002 Create schema validation infrastructure
**AC**
- AJV validates JSON Schema Draft 2020-12;
- CLI validation command returns non-zero on invalid document.

### RGME-003 SQLite migration runner
**AC**
- clean DB initializes;
- migrations idempotently tracked;
- test DB disposable.

## Epic B — Runtime

### RGME-010 Define RuntimeAdapter API
**AC**
- adapter package has no EmulatorJS dependency;
- mocked implementation passes contract tests.

### RGME-011 Implement EmulatorJS/PUAE adapter
**AC**
- ADF mounts;
- start/pause/reset work;
- errors typed.

### RGME-012 Firmware resolver
**AC**
- firmware configured by reference;
- missing firmware produces actionable error;
- no unofficial auto-download.

### RGME-013 Runtime version provenance
**AC**
- adapter/core versions stored with session.

## Epic C — Game Profiles

### RGME-020 Implement Game Profile v0.2 schema
**AC**
- valid sample passes;
- invalid model/hash/media fails.

### RGME-021 Profile repository/service
**AC**
- profile retrieved by game ID;
- profile source/version visible.

## Epic D — Ingestion/Identity

### RGME-030 Recursive scanner
**AC**
- scans configured root;
- source untouched;
- unsupported file safe.

### RGME-031 Streaming SHA-256
**AC**
- known fixture hash correct;
- large file not buffered whole.

### RGME-032 Media registry
**AC**
- discovered media persisted;
- duplicate hash query works.

### RGME-033 Filename variant parser
**AC**
- DE/FR/NTSC/Demo/memory/CDTV/Data Disk fixtures parsed.

### RGME-034 Identity resolver
**AC**
- hash match prioritized;
- filename result carries confidence/method;
- unresolved remains unresolved.

### RGME-035 Import existing Rights Matrix
**AC**
- 2,992 source rows can be represented/imported;
- unreviewed rows remain research-required;
- import creates no inferred permissions.

## Epic E — Rights/Evidence

### RGME-040 Rights Record v0.2 schema
**AC**
- per-action/component assertions;
- evidence references required for verified permissions.

### RGME-041 Evidence Record v0.2 schema
**AC**
- source/provenance/confidence represented.

### RGME-042 Rights Policy Engine
**AC**
- allow/deny/review;
- unknown distribution denied;
- conflicting evidence review.

### RGME-043 Rights UI
**AC**
- action-specific status;
- evidence accessible;
- no universal “legal” badge.

### RGME-044 Seed authorized demo records
**AC**
- at least one exact test release has evidence-backed record;
- target three.

## Epic F — Input

### RGME-050 Semantic input model
**AC**
- physical/semantic/emulated layers separate.

### RGME-051 Keyboard adapter
**AC**
- configurable mappings work.

### RGME-052 Browser Gamepad adapter
**AC**
- standard controller detected;
- D-pad/stick/fire works.

## Epic G — Display

### RGME-060 Display profile schema
### RGME-061 Authentic + Pixel Perfect
### RGME-062 CRT profile
### RGME-063 Modern Screen

**Shared AC**
- switching does not restart game unless runtime requires;
- aspect behavior documented;
- none claims true widescreen.

## Epic H — Saves

### RGME-070 Save-state storage
### RGME-071 Save-state compatibility checks
### RGME-072 Player save/load UI

## Epic I — Local API/Security

### RGME-080 Loopback local service
**AC**
- default bind only 127.0.0.1.

### RGME-081 Opaque media streaming
**AC**
- browser cannot request arbitrary path.

### RGME-082 Archive extraction guard
**AC**
- traversal fixture rejected;
- size limit enforced.

### RGME-083 CSP/CORS/session protection

## Epic J — UX/E2E

### RGME-090 Library screen
### RGME-091 Game detail
### RGME-092 Player shell
### RGME-093 Rights/evidence screen
### RGME-094 Playwright end-to-end journey
### RGME-095 Demo README and known limitations

---

# 34. Definition of Done

A feature is done only when:

- code merged;
- TypeScript passes strict checks;
- unit/integration tests added where applicable;
- schema changes documented;
- migration included where applicable;
- no source game content added unintentionally;
- user-visible error behavior implemented;
- security implications considered;
- relevant ADR updated/created;
- README/docs updated.

---

# 35. MVP Release Gate

Release `v0.2.0-mvp` only if all are true:

```text
[ ] Local service is loopback-only by default
[ ] Scanner never mutates source library
[ ] SHA-256 identity works
[ ] Game Profile v0.2 validates
[ ] Rights Record v0.2 validates
[ ] Evidence Record v0.2 validates
[ ] Rights Policy Engine blocks unknown public distribution
[ ] RuntimeAdapter isolates EmulatorJS
[ ] ADF boots through PUAE
[ ] Keyboard works
[ ] Gamepad works
[ ] Display profiles work
[ ] Save/load state works
[ ] At least one rights-cleared/local demonstrator works end-to-end
[ ] Preferred: three demonstrator titles
[ ] No proprietary game/Kickstart binary accidentally committed
[ ] Unit/integration suite passes
[ ] Playwright primary journey passes
[ ] Known limitations documented
```

---

# 36. Post-MVP Roadmap

## v0.3 — Library Intelligence
- stronger canonical metadata
- hash databases
- disk-set grouping
- WHDLoad/LHA path
- bulk rights-research workflow
- top 100–250 rights audit

## v0.4 — Research Workbench
- Copperline spike evaluation
- debug runtime interface
- memory/register/breakpoint evidence
- Ghidra project/export integration

## v0.5 — Game Archaeology
- evidence graph
- static + runtime findings
- reproducible scripted experiments
- research UI

## v0.6 — Agentic Research
- REA/tool orchestration
- constrained investigation goals
- provenance-first agent output
- no unsupported “AI discovered” claims

## v0.7 — Enhancement SDK
- patch manifests
- hash-targeted patches
- replacement assets
- signatures
- compatibility
- rights metadata

## v1.0 candidate
- multi-platform adapter ecosystem
- stable profile/rights/evidence schemas
- public profile/enhancement registry
- rights-cleared showcase catalog

---

# 37. Coding-Agent Handoff

A coding agent starting from this PRD should execute in this order:

```text
01 bootstrap repo
02 implement core domain types
03 implement schema validation
04 implement SQLite migrations
05 implement RuntimeAdapter contract
06 prove EmulatorJS/PUAE boot
07 create player shell
08 implement Game Profile
09 implement Rights/Evidence records
10 implement policy engine
11 implement scanner + SHA-256
12 implement identity resolver
13 implement local API/media IDs
14 implement keyboard/gamepad mapping
15 implement display profiles
16 implement save states
17 wire library/game/rights UI
18 add three-title demo fixtures/profiles where rights permit
19 add Playwright journey
20 close release gate
```

The agent must stop and surface a blocker rather than:

- downloading proprietary ROMs from unofficial sources;
- inventing rights permissions;
- committing copyrighted commercial game binaries;
- bypassing the rights-policy gate;
- coupling UI directly to EmulatorJS;
- modifying the source library;
- treating filename inference as verified identity.

---

# 38. North-Star Extension Boundary

The MVP deliberately creates extension points for the larger RGME vision:

```text
                   ┌───────────────┐
                   │     RGME      │
                   └───────┬───────┘
                           │
       ┌───────────────────┼───────────────────┐
       │                   │                   │
       ▼                   ▼                   ▼
     PLAY               UNDERSTAND          MODERNIZE
       │                   │                   │
 RuntimeAdapter        Evidence API      Enhancement API
       │                   │                   │
 EmulatorJS/PUAE     Ghidra/Copperline     Patch/Assets
                           │                   │
                           └────────┬──────────┘
                                    ▼
                              Rights Policy
```

No post-MVP subsystem should require rewriting the basic identity/profile/runtime/rights boundaries established here.

---

# 39. Final MVP Statement

RGME v0.2 should demonstrate something more valuable than “an Amiga emulator running in a webpage.”

It should demonstrate that a classic game can become a **well-identified, reproducibly configured, rights-aware, modernly controlled and presentation-independent software object** while its original bytes remain untouched.

That is the foundation on which game archaeology, enhancement packages, true technical modernization and eventually rights-cleared remastering can be built.

> **Preserve the original. Modernize reproducibly. Prove what we know. Respect what we may distribute.**
