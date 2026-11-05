# RGME Amiga Library Rights Audit — Batch 004
## Lucasfilm Games → LucasArts → Lucasfilm / Disney

**Date:** 2026-10-28  
**Status:** Evidence-backed family audit; not legal advice.

## Executive summary

This family produces one of the clearest examples of why RGME must separate **runtime rights** from **game-content rights**.

Lucasfilm/LucasArts adventure data remains proprietary and several titles are still commercially sold. ScummVM, however, is an independent open-source replacement runtime. Its own documentation describes the model clearly: the user supplies the original game data, while ScummVM replaces the executable/interpreter.

That gives RGME a particularly clean architecture:

```text
User-owned Lucasfilm game data
           |
           +---------------------+
           |                     |
           v                     v
        PUAE                 ScummVM
 original Amiga runtime    engine-aware runtime
           |                     |
           +----------+----------+
                      |
                      v
               RGME Profile
          input / display / saves
          metadata / rights policy
```

The two paths serve different goals:

- **PUAE:** preservation/authentic Amiga execution.
- **ScummVM:** modern engine-aware execution without redistributing the original Lucasfilm executable.
- **Neither:** grants permission to redistribute proprietary game data.

## Matrix

| Title | Local variants | Runtime | Confidence | Opportunity |
|---|---:|---|---|---|
| Zak McKracken and the Alien Mindbenders | 4 | SCUMM | high | YELLOW |
| Maniac Mansion | 4 | SCUMM | high | YELLOW |
| Loom | 6 | SCUMM | high | YELLOW |
| The Secret of Monkey Island | 5 | SCUMM | high | RED/YELLOW |
| Monkey Island 2: LeChuck's Revenge | 5 | SCUMM | high | RED/YELLOW |
| Indiana Jones and the Last Crusade — Adventure | 6 | SCUMM + Indiana Jones licensed IP | high | RED |
| Indiana Jones and the Last Crusade — Action | 1 | native Amiga/action runtime | high | RED |
| Indiana Jones and the Fate of Atlantis — Adventure | 5 | SCUMM + Indiana Jones licensed IP | high | RED |
| Battlehawks 1942 | 1 | Lucasfilm Games non-SCUMM / title-specific | medium | YELLOW |
| Their Finest Hour | 2 | Lucasfilm Games non-SCUMM / title-specific | medium | YELLOW |
| Night Shift | 1 | Lucasfilm Games non-SCUMM / title-specific | medium | YELLOW |

## Detailed records

### Zak McKracken and the Alien Mindbenders

**Library:** `Zak McKracken (DE).lha`, `Zak McKracken (FR).lha`, `Zak McKracken (IT).lha`, `Zak McKracken.lha`  
**Runtime family:** SCUMM  
**Current assessment:** Lucasfilm / Disney; actively commercially exploited  
**Class:** D · **Confidence:** high · **Opportunity:** YELLOW

- Current commercial distribution exists.
- ScummVM supports SCUMM data-file execution, but game data remains proprietary.
- Excellent RGME dual-runtime BYOG test case.
### Maniac Mansion

**Library:** `Maniac Mansion (DE).lha`, `Maniac Mansion (ES).lha`, `Maniac Mansion (FR).lha`, `Maniac Mansion.lha`  
**Runtime family:** SCUMM  
**Current assessment:** Lucasfilm / Disney lineage; proprietary game data  
**Class:** D · **Confidence:** high · **Opportunity:** YELLOW

- Found in local library.
- ScummVM documentation explicitly lists Maniac Mansion among SCUMM games.
- Copy-protection handling in ScummVM does not convert game data into freeware.
### Loom

**Library:** `Loom (DE) (CDTV).lha`, `Loom (DE).lha`, `Loom (ES).lha`, `Loom (FR).lha`, `Loom (IT).lha`, `Loom.lha`  
**Runtime family:** SCUMM  
**Current assessment:** Lucasfilm / Disney; active commercial exploitation  
**Class:** D · **Confidence:** high · **Opportunity:** YELLOW

- Steam's LucasArts Adventure Pack includes LOOM.
- Local library contains multiple language variants.
- Strong BYOG/ScummVM candidate.
### The Secret of Monkey Island

**Library:** `Secret Of Monkey Island (DE).lha`, `Secret Of Monkey Island (ES).lha`, `Secret Of Monkey Island (FR).lha`, `Secret Of Monkey Island (IT).lha`, `Secret Of Monkey Island.lha`  
**Runtime family:** SCUMM  
**Current assessment:** Lucasfilm / Disney; highly active franchise/IP  
**Class:** D · **Confidence:** high · **Opportunity:** RED/YELLOW

- Local library contains multiple language variants.
- Monkey Island remains an actively exploited franchise.
- Do not bundle original data; engine-aware BYOG path is technically attractive.
### Monkey Island 2: LeChuck's Revenge

**Library:** `Monkey Island 2 (DE).lha`, `Monkey Island 2 (ES).lha`, `Monkey Island 2 (FR).lha`, `Monkey Island 2 (IT).lha`, `Monkey Island 2.lha`  
**Runtime family:** SCUMM  
**Current assessment:** Lucasfilm / Disney; highly active franchise/IP  
**Class:** D · **Confidence:** high · **Opportunity:** RED/YELLOW

- Base and German variants found.
- Treat original Amiga data and later Special Edition assets as separate rights-bearing works.
### Indiana Jones and the Last Crusade — Adventure

**Library:** `IndianaJones &The Last Crusade Adventure (DE) (CDTV).lha`, `IndianaJones &The Last Crusade Adventure (DE).lha`, `IndianaJones &The Last Crusade Adventure (ES).lha`, `IndianaJones &The Last Crusade Adventure (FR).lha`, `IndianaJones &The Last Crusade Adventure (IT).lha`, `IndianaJones &The Last Crusade Adventure (NTSC).lha`  
**Runtime family:** SCUMM + Indiana Jones licensed IP  
**Current assessment:** Lucasfilm / Disney; active commercial exploitation  
**Class:** D · **Confidence:** high · **Opportunity:** RED

- Multiple language/NTSC/CDTV variants found.
- Steam currently bundles the adventure title in the LucasArts Adventure Pack.
- Additional franchise/trademark/character rights make public remastering especially license-sensitive.
### Indiana Jones and the Last Crusade — Action

**Library:** `IndianaJones &The Last Crusade Action.lha`  
**Runtime family:** native Amiga/action runtime  
**Current assessment:** Lucasfilm / Disney licensed IP; title-specific development/publishing chain should be retained  
**Class:** D · **Confidence:** high · **Opportunity:** RED

- Separate game from the SCUMM adventure despite similar title.
- Must not inherit SCUMM runtime metadata from the adventure edition.
### Indiana Jones and the Fate of Atlantis — Adventure

**Library:** `IndianaJones &The Fate Of Atlantis Adventure (DE).lha`, `IndianaJones &The Fate Of Atlantis Adventure (ES).lha`, `IndianaJones &The Fate Of Atlantis Adventure (FR).lha`, `IndianaJones &The Fate Of Atlantis Adventure (IT).lha`, `IndianaJones &The Fate Of Atlantis Adventure.lha`  
**Runtime family:** SCUMM + Indiana Jones licensed IP  
**Current assessment:** LucasArts / Lucasfilm / Disney; currently sold on Steam  
**Class:** D · **Confidence:** high · **Opportunity:** RED

- Current Steam listing directly names LucasArts, Lucasfilm and Disney as publishers.
- Several language variants occur locally.
- High-value technical BYOG target, poor unlicensed public demo candidate.
### Battlehawks 1942

**Library:** `Battlehawks 1942.lha`  
**Runtime family:** Lucasfilm Games non-SCUMM / title-specific  
**Current assessment:** Lucasfilm/Disney lineage likely; current title-specific exploitation/rights scope requires deeper verification  
**Class:** D · **Confidence:** medium · **Opportunity:** YELLOW

- Lucasfilm Games association is strong, but current title-specific distribution/licensing evidence should be established before stronger classification.
### Their Finest Hour

**Library:** `Their Finest Hour & Missions.lha`, `Their Finest Hour.lha`  
**Runtime family:** Lucasfilm Games non-SCUMM / title-specific  
**Current assessment:** Lucasfilm/Disney lineage likely; current title-specific exploitation/rights scope requires deeper verification  
**Class:** D · **Confidence:** medium · **Opportunity:** YELLOW

- Lucasfilm Games association is strong, but current title-specific distribution/licensing evidence should be established before stronger classification.
### Night Shift

**Library:** `Night Shift.lha`  
**Runtime family:** Lucasfilm Games non-SCUMM / title-specific  
**Current assessment:** Lucasfilm/Disney lineage likely; current title-specific exploitation/rights scope requires deeper verification  
**Class:** D · **Confidence:** medium · **Opportunity:** YELLOW

- Lucasfilm Games association is strong, but current title-specific distribution/licensing evidence should be established before stronger classification.

## Important rights conclusions

### 1. ScummVM is not a game-content license

Open-source ScummVM code does not make Monkey Island, Zak, Loom, Maniac Mansion or Indiana Jones game data open source or freeware.

RGME therefore needs separate records such as:

```yaml
runtime:
  id: scummvm
  redistributable: true
  license: open-source

game_data:
  owner: lucasfilm-disney
  redistributable_by_rgme: false
  source: user-supplied

profile:
  redistributable: true

patch:
  redistributable: review
```

### 2. BYOG becomes stronger than pure emulation

For SCUMM games, RGME can identify a user's lawful local files and launch them through an engine-aware runtime. That potentially enables richer modernization than a generic emulator wrapper while keeping proprietary assets outside the RGME repository.

### 3. Original-platform fidelity remains valuable

The ScummVM route should **not replace PUAE**. Amiga graphics, audio, timing, fonts, release-specific behavior and platform quirks are preservation targets in their own right.

RGME should therefore allow a title profile to expose:

```text
PLAY MODE

[ Original Amiga ]
PUAE · authentic platform execution

[ Modern Runtime ]
ScummVM · modern compatibility / convenience
```

### 4. Indiana Jones needs extra caution

The Indiana Jones games combine game copyright with a major film/character/trademark franchise. They are therefore poor candidates for an unlicensed public RGME remaster even though they are excellent private/BYOG engineering targets.

### 5. Action vs Adventure must not be collapsed

`Indiana Jones and the Last Crusade — Action` and the SCUMM adventure are separate games. RGME identity resolution must not canonicalize them merely from the shared franchise/title string.

## Product implication: RGME Engine-Aware Runtime Adapter

Batch 004 justifies adding an optional interface beyond generic machine emulation:

```ts
interface EngineAwareRuntimeAdapter extends RuntimeAdapter {
  engineId: string;
  identifyGameData(files: FileReference[]): Promise<GameDataIdentity>;
  validateRequiredFiles(identity: GameDataIdentity): Promise<ValidationResult>;
  exposeSemanticCapabilities(): Promise<SemanticCapabilities>;
}
```

Potential semantic capabilities:

- save/load through engine-native APIs;
- subtitles/language metadata;
- aspect-ratio handling;
- mouse/touch adaptation;
- gamepad cursor mode;
- hotkeys;
- accessibility overlays;
- engine-native screenshots;
- per-game compatibility metadata.

## RGME opportunity assessment

The Lucasfilm catalogue is **not a near-term licensing sweet spot** like Oil Imperium may be. Disney/Lucasfilm is a large, active IP holder and the key properties continue to have commercial value.

Its value to RGME is instead architectural:

1. prove BYOG;
2. prove dual runtimes;
3. prove content/runtime separation;
4. prove multilingual release identification;
5. demonstrate that RGME can modernize the *experience* without distributing the game.

## Recommended next batch

**Batch 005 — Team17**

That family should cover Worms, Alien Breed, Project-X, Superfrog, Body Blows, Assassin, Overdrive and other Team17 entries in the library. It is especially interesting because Team17 remains active, while the catalogue contains several historically important Amiga-native properties suitable for testing joystick/gamepad modernization.
