# Retro Game Modernization Engine (RGME) — Overall Concept v0.2

**Date:** 2026-10-28  
**Status:** Vision + architecture baseline with Rights Intelligence integrated as a first-class subsystem

## Executive Summary

RGME is a local-first, browser-first platform for playing, understanding, preserving and selectively modernizing classic computer games. Its central architectural rule is that **the original game remains immutable**. Modern controls, display treatments, metadata, saves, research findings, patches and replacement assets are layered around it through declarative profiles and versioned enhancement packages.

v0.2 adds a crucial architectural dimension missing from v0.1: **Rights Intelligence**. RGME must know not merely what a game is and how to run it, but what evidence exists for each intended action: local execution, redistribution, reverse engineering, patching, browser hosting, modification and remaster publication.

The user's supplied Amiga library provides the first real corpus: **2,992 listed files** and approximately **2,369 canonical title/edition groups** after conservative filename normalization. This becomes both an ingestion test corpus and the seed of the RGME Rights Registry.

## 1. Product thesis

> **Preserve the original. Modernize reproducibly. Prove what we know. Respect what we may distribute.**

RGME is not a ROM site and not merely an emulator frontend. It is an abstraction layer spanning runtime, UX modernization, game-specific knowledge, reverse-engineering evidence, enhancement packages and rights provenance.

## 2. Modernization modes

1. **Authentic** — original timing, assets, presentation and input semantics as closely as runtime permits.
2. **CRT** — authentic execution with display simulation.
3. **Enhanced Retro** — scaling/shader/audio/presentation improvements without pretending to alter the original game world.
4. **Modern** — modern gamepad semantics, overlays, accessibility, save UX and presentation conveniences.
5. **Remastered** — optional replacement assets, true widescreen patches where technically real, QoL/gameplay patches and other derivative enhancements where rights permit.

## 3. Architecture

```text
Local Library
    |
    v
Ingestion + Identity Resolver
    |
    +--------------------> Rights Intelligence + Evidence Store
    |                                  |
    v                                  v
Game Profile --------------------> Policy Decision
    |                                  |
    v                                  |
Runtime Adapter <----------------------+
    |
    v
Modern Experience Layer
    |
    +--> Input / Display / Saves / Overlays
    |
    +--> Research Workbench
    |        +--> Ghidra static analysis
    |        +--> Debug runtime / Copperline spike
    |        +--> REA agentic orchestration (later)
    |
    +--> Versioned Enhancement Packages
```

## 4. Runtime strategy

The MVP should continue to optimize for the fastest reliable route to a real playable game: **EmulatorJS + libretro + PUAE** behind an RGME `RuntimeAdapter`. Emulator choice must not leak into game profiles or the UI. Copperline remains a strategically interesting research/debug runtime candidate, not an MVP dependency.

```ts
interface RuntimeAdapter {
  identifyCapabilities(): RuntimeCapabilities;
  loadGame(profile: GameProfile): Promise<void>;
  start(): Promise<void>;
  pause(): Promise<void>;
  reset(): Promise<void>;
  saveState(slot: string): Promise<void>;
  loadState(slot: string): Promise<void>;
  setInputMapping(mapping: InputMapping): Promise<void>;
  setDisplayProfile(profile: DisplayProfile): Promise<void>;
  insertMedia(media: MediaReference): Promise<void>;
}
```

A later `DebugRuntimeAdapter` adds memory/register/breakpoint/step primitives for evidence-producing research.

## 5. Game Profile as central abstraction

A Game Profile binds identity, machine configuration, media, runtime, input, display, enhancements, research status and a reference to the rights record.

```yaml
schema: rgme.game/v0.2
game:
  id: example-amiga-game
  title: Example Amiga Game
  platform: amiga
identity:
  hashes: []
machine:
  model: A500
  chipset: OCS
  video: PAL
runtime:
  preferredAdapter: puae
input:
  profile: modern-gamepad
display:
  defaultProfile: authentic
rights:
  record: rights/example-amiga-game.json
enhancements:
  packages: []
research:
  status: unanalysed
```

## 6. Rights Intelligence — new in v0.2

### 6.1 Why it belongs in the architecture

The rights question changes product behavior. A title may be runnable locally but not distributable. A binary may be authorized freeware while derivative/remaster rights remain unverified. Source may be available while art/music remain proprietary. Therefore rights cannot be a single boolean.

### 6.2 Pipeline

```text
scan -> identify -> normalize -> resolve rights -> collect evidence
     -> classify each action/component -> policy decision
```

### 6.3 Rights classes

- **A — Verified Public Domain**
- **B — Open Licensed**
- **C — Explicit Freeware / Authorized Redistribution**
- **D — Copyrighted / Identifiable Rights Path**
- **E — Unknown / Research Required**

“Abandonware” is intentionally not a rights class. Historical PD-library terminology is also not accepted as proof of legal public-domain status.

### 6.4 Action matrix

Every rights record should separately answer:

- private/local execution
- binary redistribution
- reverse engineering
- patch distribution
- browser hosting
- modification
- derivative/remaster distribution
- commercial use

And it should do so for relevant components: code, graphics, music/audio, text, manuals/box art and trademarks.

### 6.5 Evidence contract

```yaml
rights_assertion:
  action: binary_redistribution
  status: permitted
  scope: specific_freeware_release
  evidence:
    - source_type: current_authorized_distributor
      source: ...
      accessed: 2026-10-28
  confidence: high
  reviewed_by: research
```

Unknown means unknown. RGME must never convert lack of enforcement, publisher disappearance, file availability or age into permission.

## 7. First real corpus

The supplied Amiga listing contains 2,992 file records and approximately 2,369 normalized groups. The initial verified seed includes **Beneath a Steel Sky**, **Lure of the Temptress**, and **Flight of the Amazon Queen** as strong authorized/freeware-path candidates. These are ideal for validating the distinction between `can run`, `can redistribute this release`, and `can modify/remaster`.

The complete baseline is supplied separately as CSV and JSON rather than bloating the concept paper.

## 8. Local library ingestion

```text
Folder/archive listing
   -> file discovery
   -> SHA-256 when bytes are locally accessible
   -> format detection
   -> disk-set/variant grouping
   -> platform detection
   -> canonical identity match
   -> rights-record match
   -> SQLite registry
```

Original content is read-only by default. RGME does not rename or reorganize the user's archive unless explicitly requested.

## 9. Input modernization

RGME maps modern physical controls to semantic game actions and then to emulated devices/keys. This permits game-specific mappings without coupling them to a particular emulator. Keyboard, gamepad, mouse and later touch are supported sources.

## 10. Display architecture

Display profiles are composable and must distinguish **presentation scaling** from actual game-world modifications. A 4:3 game stretched or pillarboxed on a 16:9 display is not “true widescreen.” True widescreen requires game-specific evidence and often patches to camera, tilemap, clipping, Copper/blitter behavior and HUD layout.

## 11. Reverse engineering and game archaeology

Ghidra is the static-analysis workbench for 68000 binaries. The research runtime adds dynamic evidence: memory changes, registers, breakpoints, screenshots and scripted inputs. REA can later orchestrate agentic investigation across those tools.

The AI layer does not get to declare that an address “is player health” merely because it looks plausible. Findings become claims backed by observations and static/runtime evidence with confidence and provenance.

```text
Static evidence + Runtime evidence + Human/AI interpretation
                         |
                         v
                    Evidence Graph
                         |
                         v
                  Game Knowledge
```

## 12. Enhancement packages

Enhancements should be declarative, versioned and hash-targeted. A package can contain patches, configuration, replacement assets and compatibility constraints without embedding the original copyrighted game binary.

```yaml
schema: rgme.enhancement/v0.2
id: example-modern-controls
targets:
  - game: example-game
    hashes: [...]
changes:
  - type: input-profile
  - type: binary-patch
rights:
  original_content_included: false
```

## 13. Repository architecture

```text
retro-game-modernization-engine/
├── apps/
│   ├── web/
│   └── cli/
├── packages/
│   ├── core/
│   ├── runtime/
│   │   ├── adapter-api/
│   │   ├── emulatorjs/
│   │   ├── puae/
│   │   └── copperline/
│   ├── input/
│   ├── display/
│   ├── ingestion/
│   ├── identity/
│   ├── rights/
│   ├── evidence/
│   ├── research/
│   └── enhancements/
├── schemas/
│   ├── game-profile.schema.json
│   ├── rights-record.schema.json
│   ├── evidence.schema.json
│   └── enhancement.schema.json
├── profiles/
├── rights/
├── tools/ghidra/
├── docs/
└── examples/
```

## 14. Suggested stack

- TypeScript monorepo
- React frontend
- Vite for the first local-first browser shell
- SQLite registry
- YAML/JSON declarative profiles
- EmulatorJS/libretro/PUAE MVP runtime
- Vitest + Playwright
- Ghidra research integration after runtime/profile boundaries are stable
- Copperline research spike independently
- REA only after evidence contracts and tool adapters exist

## 15. MVP v0.2 definition

> **One legally usable local A500/A600 game, unmodified, launched through RGME in a modern browser with a modern controller and selectable display profile, backed by a machine-readable rights record with evidence provenance.**

MVP includes runtime adapter, Game Profile, local ingestion, identity/hash support, basic Rights Record, input mapping, display profiles, save state and a clean player shell.

MVP explicitly excludes mass decompilation, automatic AI remastering, public hosting of ordinary copyrighted commercial binaries, and fake “widescreen” claims.

## 16. Development sequence

```text
1  One authorized/local ADF in browser
2  Clean player shell
3  Game Profile v0.2
4  RuntimeAdapter boundary
5  Input translation
6  Display profiles
7  Scanner + hashes + SQLite
8  Identity resolver
9  Rights Record + evidence schema
10 Three-game authorized demo corpus
11 Rights-aware policy gate
12 Copperline research spike
13 Ghidra integration
14 Evidence graph
15 REA experiment
16 First rights-cleared enhancement/patch
```

## 17. Seven-day prototype revision

**Day 1:** browser runtime + PUAE + one legally usable test title.  
**Day 2:** player shell and RuntimeAdapter.  
**Day 3:** Game Profile and rights-record link.  
**Day 4:** scanner, SHA-256, canonical identity and SQLite.  
**Day 5:** modern controller mapping.  
**Day 6:** Authentic / Pixel Perfect / CRT / Modern Screen display profiles.  
**Day 7:** three-title demonstrator, rights/evidence cards, screenshots, README and next backlog.

## 18. ADR additions

Existing v0.1 ADRs remain, plus:

```text
ADR-011 Rights are modeled per action, not as a boolean
ADR-012 Rights claims require evidence and provenance
ADR-013 Abandonware is not a rights classification
ADR-014 Freeware redistribution and derivative rights are distinct
ADR-015 Rights may differ by code/assets/music/trademarks
ADR-016 Public profiles and patches must not require bundling original binaries
ADR-017 Unknown rights default to no distribution assumption
```

## 19. Strategic moat

RGME's defensibility is not emulator code alone. The compound asset is the combination of runtime abstraction, normalized game profiles, identity/hashes, evidence-backed game archaeology, reproducible enhancement packages and an increasingly useful rights/provenance graph.

A mature system can answer not just **“Can RGME run this?”**, but:

- What exact release is this?
- What machine/runtime does it need?
- What do we know about its internals and why?
- Which enhancements are compatible?
- Which rights assertions are evidenced?
- Which operations can RGME safely automate and which require permission/review?

## 20. North-star architecture

```text
                         RGME
                          |
       +------------------+------------------+
       |                  |                  |
    PLAY               UNDERSTAND         MODERNIZE
       |                  |                  |
 RuntimeAdapter       Evidence Graph    Enhancement SDK
       |                  |                  |
 Profiles <---------- Identity ----------> Rights
       |                  |                  |
       +------------------+------------------+
                          |
                   User-supplied or
                  rights-cleared content
```

## 21. Immediate next specification

The next implementation artifact should be **RGME MVP Technical Specification / PRD v0.2**, now including:

- exact monorepo bootstrap
- TypeScript package contracts
- Game Profile JSON Schema
- Rights Record JSON Schema
- Evidence JSON Schema
- SQLite schema
- scanner + identity resolver contracts
- RuntimeAdapter and PUAE/EmulatorJS integration
- local file security boundary
- input/display models
- rights-policy engine
- test strategy
- acceptance criteria
- first issue backlog

The rights audit and machine-readable matrix produced alongside this document are the first real data inputs for that specification.

---

**Project statement:** *Preserve the original. Modernize reproducibly. Prove what we know. Respect what we may distribute.*
