# RGME Master Rights Matrix v0.2 — Merge Report

**Date:** 2026-10-28  
**Scope:** Rights Audit Batches 001–011, with Batch 005 cleaned before merge.

## Executive Summary

The first eleven rights-research batches have been normalized into a single provenance-preserving master dataset. This is a **merge and schema-consolidation milestone**, not a claim that the entire library is rights-resolved.

### Current coverage

- Original library files: **2,992**
- Unique library filenames: **2,992**
- Established canonical-group estimate: **~2,369**
- Raw batch records before deduplication: **231**
- Unique audited canonical records after merge: **228**
- Unique original library files matched by those records: **431**
- Raw-file coverage: **14.41%**
- Audit-record coverage versus ~2,369 canonical groups: **9.62%**
- Overlapping batch records collapsed: **3**
- Records retaining class/opportunity claim conflicts: **1**

The canonical percentage is deliberately labelled an **audit-record coverage indicator**. A complete identity-resolution pass across all 2,992 files is still needed before treating the ~2,369 denominator as an exact canonical count.

## Batch 005 cleanup

### ATR: All Terrain Racing

The original Batch 005 matcher searched for the substring `ATR`. That incorrectly matched titles such as `ATrain`, `Combat Air Patrol`, `Dawn Patrol`, `Llamatron`, `Patrician` and others.

Corrected matches:

- `All Terrain Racing.lha`
- `All Terrain Racing - Xmas(Demo).lha`

Old count: **21 false/incorrect matches** in the ATR record.  
Corrected count: **2 valid matches**.

### Assassin

`Trained Assassin.lha` was incorrectly grouped with Team17's `Assassin`. It has been removed.

Corrected Team17 Assassin match:

- `Assassin.lha`

The cleaned Batch 005 is emitted separately so the correction remains auditable.

## Merge policy

The merge uses these rules:

1. Exact library filenames are validated against the original 2,992-entry source list.
2. Records are grouped by normalized canonical title/known aliases.
3. Every source batch is retained in `provenance`; overlapping claims are not silently discarded.
4. The primary displayed assessment is selected by confidence, then by later batch when confidence is equal.
5. Divergent class/opportunity claims are flagged with `claim_conflict=true`.
6. Rights layers are unioned rather than overwritten.
7. Batch 005 cleanup occurs before merge.
8. No unaudited title receives a rights conclusion merely because it shares a publisher or corporate family.

## Distribution snapshot

### Rights classes

- **D:** 133
- **E/D:** 60
- **E:** 17
- **D/E:** 16
- **C?:** 2

### Opportunity labels

- **YELLOW:** 126
- **RED/YELLOW:** 45
- **YELLOW/LIGHT_GREEN:** 26
- **LIGHT_GREEN:** 11
- **YELLOW/ORANGE:** 10
- **RED:** 7
- **GREEN_PENDING_PRIMARY_EVIDENCE:** 2
- **ORANGE:** 1

### Confidence labels

- **high:** 76
- **medium:** 58
- **medium-high:** 41
- **medium-low:** 28
- **low:** 12
- **very-high:** 12
- **verified/high:** 1

## Normalized master-record shape

```yaml
canonical_title:
library_matches: []
source_batches: []
source_families: []
rights_class:
opportunity:
confidence_label:
confidence_score:
current_rights_assessment:
licensing_route:
rights_layers: []
actions: {}
runtime_family:
claim_count:
claim_conflict:
provenance: []
```

This schema deliberately leaves the richer graph objects—transactions, entities, temporal edges, evidence objects and claim supersession—in provenance/next-stage Rights Intelligence rather than flattening them destructively into CSV columns.

## What v0.2 now tells us

The first eleven batches have done more than classify games. They have exposed recurring rights patterns:

```text
explicit freeware/open grant
active first-party IP
corporate succession
third-party publishing
licensed franchise overlay
current licensee != IP owner
revived brand != catalogue ownership
explicit catalogue acquisition
temporal rights transfer
external likeness/brand/data layers
```

That taxonomy is now stable enough to become a formal Rights Intelligence schema.

## Recommended next research selection

Do not simply continue alphabetically. Use the master matrix plus the remaining library to prioritize publisher/IP clusters by:

```text
number of unaudited library titles
× historical importance
× modernization value
× rights-route discoverability
× potential licensing feasibility
```

Likely high-value next clusters include Ocean/Infogrames/Atari, Core Design/Eidos/Square Enix/Embracer-related chains, Gremlin/Infogrames, Virgin/Interplay lineages, and additional independent/freeware candidates. These require fresh research before conclusions are assigned.

## Next data milestone

Before Master Matrix v0.3, build a deterministic **Library Identity Registry** for all 2,992 files. That will replace the approximate canonical denominator with stable IDs and make coverage measurable at three distinct levels:

```text
file/release coverage
canonical-game coverage
rights-claim coverage
```

This prevents variants, demos, language releases, data disks and expansions from distorting progress metrics.
