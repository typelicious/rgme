# RGME Amiga Library Rights Audit v0.1

**Date:** 2026-10-28  
**Scope:** User-supplied `amiga600-game-list.txt`  
**Files inventoried:** 2,992  
**Canonical title/edition groups (heuristic):** 2,369

> **Status:** Baseline rights-intelligence audit, not legal advice. v0.1 deliberately treats every unverified title as `research_required`. Age, commercial unavailability, a dead publisher, or an “abandonware” label are never treated as proof of public-domain status or redistribution permission.

## 1. Executive conclusion

The library is large enough that a title-by-title manual rights investigation should not be the first operation. RGME should ingest all files, normalize titles and variants, cluster them by IP/developer/publisher lineage, then attach evidence-backed rights assertions. The current inventory contains 2,992 distinct listed files and approximately 2,369 canonical groups after conservative filename normalization.

The strongest immediately verified candidates found in this collection are **Beneath a Steel Sky**, **Lure of the Temptress**, and **Flight of the Amazon Queen**. Current ScummVM materials explicitly distribute/list these as freeware; for Flight of the Amazon Queen, ScummVM also documents that its authors supplied source and permitted the freeware release. This is strong evidence for an authorized-play/demo path, but it is **not** by itself a blanket license to modify assets/code or publish an RGME remaster.

**Worms** is treated conservatively as active copyrighted commercial IP. **Turrican 2** is also not treated as freely redistributable: a recent legal-download survey records historical Factor 5 availability with an ownership condition for the Turrican titles.

## 2. Classification model

| Class | Meaning | RGME default |
|---|---|---|
| A | Verified public domain | Candidate for bundling/remaster research |
| B | Open licensed | Follow exact license/component scope |
| C | Explicit freeware / authorized redistribution | Candidate for demo; modification rights separately checked |
| D | Copyrighted / identifiable rights path | BYOG or licensing path; no binary redistribution assumption |
| E | Unknown / unresolved | Research required; no permission inferred |

Opportunity colors are project triage, **not legal verdicts**: GREEN = strong authorized path identified; LIGHT_GREEN = licensing-friendly candidate; YELLOW = identifiable but permission/restrictions need work; ORANGE = fragmented chain; RED = active IP/no redistribution permission identified; GREY = not yet researched.

## 3. Verified seed findings

### Beneath a Steel Sky
- Present in multiple language variants in the library.
- Current ScummVM game downloads include freeware CD and floppy versions.
- RGME v0.1 classification: **C / GREEN**.
- Important limitation: verify whether the exact Amiga build in this library is covered by the same authorization and separately verify modification/remaster rights.

### Lure of the Temptress
- Present in multiple language variants.
- Current ScummVM materials list it among freeware games.
- RGME v0.1 classification: **C / GREEN**.
- Modification and derivative/remaster distribution remain separate questions.

### Flight of the Amazon Queen
- Present in the library.
- ScummVM documents author permission for its freeware release and currently distributes freeware versions.
- RGME v0.1 classification: **C / GREEN**.
- Particularly attractive research candidate because a documented source-code handoff to ScummVM also exists; source availability does not automatically define the license of every original game asset.

### Worms
- Present in 1 MB and 2 MB variants.
- Team17 currently asserts IP ownership/licensor rights across its protected game-service content.
- RGME v0.1 classification: **D / RED** for public binary/remaster distribution without permission.
- Local BYOG execution is a separate question from redistribution.

### Turrican 2
- Standard, CDTV and demo variants occur in the library.
- A 2025 survey of authorized Amiga downloads reports Factor 5 downloads of Turrican 1–3 as authorized only for users who already own a legitimate copy.
- RGME v0.1 classification: **D / YELLOW** pending primary-source/current-rightsholder verification.

## 4. What v0.1 does *not* claim

This audit does not assert that the remaining ~2,364 groups are copyrighted, public domain, illegal, abandonware, or orphan works. They are simply **unreviewed**. The JSON/CSV intentionally encode that distinction.

Likewise, `freeware` is not normalized to `public_domain`, and permission to download/play is not normalized to permission to modify, create derivative works, redistribute a patched binary, host a browser build, or reuse trademarks/box art/manuals/music.

## 5. Rights dimensions RGME must track

For each canonical game, RGME should independently track: code copyright; graphics; music/audio; story/text; manuals/box art; trademarks; original publisher rights; developer/author rights; current successor; binary redistribution; source availability/license; modification/derivative rights; patch distribution; browser hosting; commercial remaster rights; and territory/version limitations.

## 6. Research workflow

1. Normalize filenames and variants.
2. Match canonical game identity using hashes/metadata where available.
3. Resolve original developer/publisher/year.
4. Cluster rights chains by publisher/IP family.
5. Search primary/current-rightsholder sources first.
6. Use preservation/community databases as leads, not sole proof where a primary source can be found.
7. Record each claim with source, access date, scope, confidence and contradiction status.
8. Separate binary redistribution from modification/remaster permissions.
9. Escalate promising licensing candidates for human/legal review.

## 7. Recommended research batches

Rather than researching 2,369 groups randomly, prioritize:

- **Batch A — explicit freeware/open/public-domain candidates**: fastest legal demo corpus.
- **Batch B — historically authorized publisher catalogs**: Gremlin, Team17/Dream17, Factor 5, Cinemaware, Core-related catalogs, etc.; current rights must still be verified.
- **Batch C — active IP owners**: identify BYOG-only vs licensing opportunities.
- **Batch D — defunct/fragmented publishers**: reconstruct chain and flag uncertainty.
- **Batch E — PD/homebrew/demo material**: distinguish actual public domain from historically loose “PD library” terminology.

## 8. RGME product consequence

Rights intelligence becomes a first-class subsystem rather than a documentation appendix:

```text
Library Scanner -> Identity Resolver -> Rights Resolver -> Evidence Store
                                      -> Policy Engine
                                      -> Runtime/Distribution Decision
```

A game can therefore be playable locally while remaining non-distributable by RGME. A profile can be public while its game binary is user-supplied. A freeware binary can be authorized for redistribution while its remaster still requires permission.

## 9. Machine-readable companion files

- `RGME-Amiga-Library-Rights-Matrix-v0.1.csv` — one row per listed library file.
- `RGME-Amiga-Library-Rights-Matrix-v0.1.json` — grouped canonical records plus all source-file records.

## 10. Evidence used for seed audit

- ScummVM current Games/Downloads pages: current freeware listings for Beneath a Steel Sky, Lure of the Temptress, Flight of the Amazon Queen and other titles.
- ScummVM 2004 release announcement: authors of Flight of the Amazon Queen supplied source and permitted freeware release.
- Team17 current legal terms: current IP ownership/licensor assertions for protected game/service content.
- AmigaPD freeware guidance: useful secondary preservation source explicitly distinguishing abandonware from freeware and pointing to historically authorized publisher catalogs.
- Orbitalflower 2025 legal Amiga downloads survey: secondary lead documenting authorized-download sources and restrictions, including Turrican ownership condition.
- Amiga Freeware Archive FAQ: important warning that historical “PD” terminology often did not mean legal public domain.
- Amiga August 2026 update: current Amiga preservation/licensing ecosystem context.

## 11. v0.2 audit target

The next audit iteration should resolve the top 100–250 canonical titles by (a) rights opportunity, (b) recognizability, (c) technical RGME suitability and (d) availability of primary evidence, while preserving all unresolved records rather than guessing.
