# RGME Amiga Library Rights Audit — Batch 003
## Blue Byte → Ubisoft

**Date:** 2026-10-28  
**Status:** Evidence-backed family audit; title-specific rights override publisher-family assumptions.

## Executive summary

Ubisoft's acquisition of Blue Byte in 2001 gives RGME a strong corporate-successor path for **core Blue Byte-owned intellectual property**. It does not mean that Ubisoft automatically owns every game ever distributed or published by Blue Byte.

The strongest records in this batch are **Battle Isle** and **The Settlers**. Both remain commercially exploited IP. For RGME they are excellent local/BYOG targets, but poor candidates for an unlicensed bundled public demo.

The more interesting rights-research opportunities are older titles where Blue Byte acted partly as publisher and where authorship/development may sit elsewhere. Those records remain deliberately unresolved instead of being falsely collapsed into “Ubisoft owns it”.

## Matrix

| Title | Local variants | Current rights assessment | Confidence | Opportunity |
|---|---:|---|---|---|
| Battle Isle | 2 | Ubisoft / Blue Byte lineage | high | YELLOW |
| The Settlers | 2 | Ubisoft | verified/high | RED/YELLOW |
| Great Courts 2 | 2 | Ubisoft/Blue Byte lineage likely, exact title-specific rights scope should be verified | medium-high | YELLOW |
| Pro Tennis Tour 2 | 2 | Ubisoft/Blue Byte lineage likely; edition/title mapping requires hash/release verification | medium | YELLOW |
| Tom and the Ghost | 1 | Current holder not proven solely by Blue Byte acquisition | medium-low | LIGHT_GREEN |
| Atomino | 3 | Do not assign to Ubisoft as a single rights chain | medium | ORANGE |
| Yo! Joe! | 2 | Current rights holder unresolved | medium-low | LIGHT_GREEN |
| Historyline 1914-1918 | 3 | Title-specific chain requires verification | low | YELLOW |
| Apidya | 2 | Title-specific chain requires verification | low | YELLOW |
| Amberstar | 4 | Title-specific chain requires verification | low | YELLOW |
| Ambermoon | 2 | Title-specific chain requires verification | low | YELLOW |

## Detailed records

### Battle Isle

**Library:** `Battle Isle (Data Disks).lha`, `Battle Isle.lha`

**Historical:** Blue Byte; 1991  
**Current assessment:** Ubisoft / Blue Byte lineage  
**Class:** D · **Confidence:** high · **Opportunity:** YELLOW

- Ubisoft acquired Blue Byte in 2001.
- Ubisoft currently sells Battle Isle Platinum.
- Active commercial exploitation; direct Ubisoft licensing route.
### The Settlers

**Library:** `Settlers (FR).lha`, `Settlers.lha`

**Historical:** Blue Byte; 1993 Amiga original  
**Current assessment:** Ubisoft  
**Class:** D · **Confidence:** verified/high · **Opportunity:** RED/YELLOW

- Ubisoft currently operates The Settlers franchise and sells modern entries.
- Strong direct corporate/IP continuity; unsuitable for bundled RGME binary without permission.
- Excellent BYOG technical showcase.
### Great Courts 2

**Library:** `Great Courts 2 (512k).lha`, `Great Courts 2.lha`

**Historical:** Blue Byte / Ubisoft publishing lineage; tennis title  
**Current assessment:** Ubisoft/Blue Byte lineage likely, exact title-specific rights scope should be verified  
**Class:** D · **Confidence:** medium-high · **Opportunity:** YELLOW

- Blue Byte catalogue title; library contains standard and 512k variants.
- Treat title-specific assets and third-party names/licences separately.
### Pro Tennis Tour 2

**Library:** `Pro Tennis Tour 2 (512k).lha`, `Pro Tennis Tour 2.lha`

**Historical:** Blue Byte-era tennis title; known as Great Courts 2 in some markets  
**Current assessment:** Ubisoft/Blue Byte lineage likely; edition/title mapping requires hash/release verification  
**Class:** D · **Confidence:** medium · **Opportunity:** YELLOW

- Potential regional/title alias relationship with Great Courts 2.
- Do not merge records until exact release identity is verified.
### Tom and the Ghost

**Library:** `Tom And The Ghost.lha`

**Historical:** Blue Byte published; development/underlying authorship may be separate  
**Current assessment:** Current holder not proven solely by Blue Byte acquisition  
**Class:** E · **Confidence:** medium-low · **Opportunity:** LIGHT_GREEN

- Publisher succession is not sufficient proof of ownership of all game components.
- Good candidate for author/developer-chain research.
### Atomino

**Library:** `Atomino (DE).lha`, `Atomino (NTSC).lha`, `Atomino.lha`

**Historical:** Published by Psygnosis in some markets; Blue Byte involvement varies by release  
**Current assessment:** Do not assign to Ubisoft as a single rights chain  
**Class:** E/D · **Confidence:** medium · **Opportunity:** ORANGE

- Library includes standard/NTSC variants.
- Requires release-specific publisher/developer and rights analysis; publisher family shortcut rejected.
### Yo! Joe!

**Library:** `Yo Joe(Demo).lha`, `Yo Joe.lha`

**Historical:** Scipio / Play Byte; Blue Byte publishing association  
**Current assessment:** Current rights holder unresolved  
**Class:** E · **Confidence:** medium-low · **Opportunity:** LIGHT_GREEN

- Demo and likely full version present in library.
- Potential smaller-rightsholder outreach case; do not infer Ubisoft ownership from publishing relationship.
### Historyline 1914-1918

**Library:** `Historyline (DE).lha`, `Historyline (FR).lha`, `Historyline.lha`

**Historical:** Blue Byte-associated catalogue; title-specific development/publishing history  
**Current assessment:** Title-specific chain requires verification  
**Class:** E · **Confidence:** low · **Opportunity:** YELLOW

- Presence confirmed in local listing; requires dedicated title audit.
### Apidya

**Library:** `Apidya (Audios).lha`, `Apidya (Kaiko).lha`

**Historical:** Blue Byte-associated catalogue; title-specific development/publishing history  
**Current assessment:** Title-specific chain requires verification  
**Class:** E · **Confidence:** low · **Opportunity:** YELLOW

- Presence confirmed in local listing; requires dedicated title audit.
### Amberstar

**Library:** `Amberstar (DE).lha`, `Amberstar (Fast) (DE).lha`, `Amberstar (Fast).lha`, `Amberstar.lha`

**Historical:** Blue Byte-associated catalogue; title-specific development/publishing history  
**Current assessment:** Title-specific chain requires verification  
**Class:** E · **Confidence:** low · **Opportunity:** YELLOW

- Presence confirmed in local listing; requires dedicated title audit.
### Ambermoon

**Library:** `Ambermoon (DE).lha`, `Ambermoon.lha`

**Historical:** Blue Byte-associated catalogue; title-specific development/publishing history  
**Current assessment:** Title-specific chain requires verification  
**Class:** E · **Confidence:** low · **Opportunity:** YELLOW

- Presence confirmed in local listing; requires dedicated title audit.

## Key architectural lesson for RGME Rights Intelligence

Corporate acquisition evidence should be represented separately from **title ownership evidence**:

```text
Ubisoft acquired Blue Byte
        |
        +--> strong evidence of corporate succession
        |
        +--> Battle Isle / Settlers
        |       +--> additional active commercial evidence
        |       +--> high-confidence current rights route
        |
        +--> Blue Byte-published third-party title
                +--> NOT sufficient by itself
                +--> inspect development agreement / author / later sale
```

This prevents one of the largest systematic errors in automated retro-game rights databases: equating historical publisher with present copyright owner.

## Particularly useful library observations

### Battle Isle
The library contains the base game plus the Data Disks archive. This family should eventually be represented as a base title plus expansion/media relationships rather than two unrelated canonical games.

### Great Courts 2 / Pro Tennis Tour 2
These names can represent regional branding/edition relationships. RGME should preserve both raw filenames and delay canonical release merging until hashes and release metadata establish equivalence.

### The Settlers
The library contains at least a French edition. This is a high-value runtime/modernization test because the IP lineage is clear and the game is technically representative of mouse-driven Amiga strategy titles.

### Yo! Joe! / Tom and the Ghost
These are more attractive **rights archaeology** cases than Settlers/Battle Isle: the historical commercial relationships are smaller and more fragmented, potentially making direct creator/rightsholder outreach possible.

## Recommended policy

For every title in this batch:

- local BYOG execution: RGME may permit operationally;
- public binary hosting: blocked absent title/release-specific permission;
- remaster/derivative distribution: blocked absent explicit license;
- patches: review separately and avoid containing original copyrighted data;
- reverse engineering: purpose/jurisdiction review;
- artwork/music/manuals/trademarks: separate components, never inherited automatically from binary rights.

## Recommended next step

Proceed to **Batch 004 — Lucasfilm Games / LucasArts / Disney**, including the library's Zak McKracken variants, Monkey Island titles, Indiana Jones adventures, Loom and Maniac Mansion. This family is especially useful because SCUMM creates an additional technical path for RGME: original-platform PUAE preservation versus an engine-aware ScummVM runtime.
