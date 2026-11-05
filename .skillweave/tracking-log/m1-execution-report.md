# RGME Milestone 1 — Execution Report

Methodology: assay · Autonomy: unicorn · Parallelism: CLI and Web lanes ran in parallel after Core.

| Batch | Tasks | Gate | Result |
|---|---|---|---|
| 1 | ARCH-001 | `pnpm install && pnpm build && pnpm test` | pass |
| 2 | CORE-001, CORE-002 | `pnpm --filter @rgme/core test` | pass (27 tests) |
| 3 | CLI-001, UI-001 | `pnpm --filter @rgme/cli test && pnpm --filter @rgme/web build` | pass |
| 4 | INTEG-001 | `pnpm test && pnpm build` | pass (core 27, cli 9, web 10 = 46 tests) |

## Scene demo & fixtures (follow-up)
- `rgme scan concept/fixtures` identifies `rgme-scene-intro.adf` by exact SHA-256 as Class A / public domain (local + redistribution allowed). Identity comes from the hash only; filenames/titles never grant permission (a renamed copy is identified, an impostor with the same name is not).
- `Load Scene Demo` (web) renders copper rasterbars, a chrome RGME logo with moving shine and a sine scroller on the mock runtime, with a procedural 4-channel chiptune (Web Audio, Amiga L/R/R/L panning, 150 BPM, A minor). Original composition, not a copy of any existing tune; Mute button included.
- Fixture caveat: `flight-of-the-amazon-queen` carries `e3b0c442…b855`, the SHA-256 of an empty file (a placeholder). It is excluded from hash matching so a 0-byte file can never be treated as freeware. The real-game hashes in `freeware-games.json` could not be verified here.
- `packages/cli/src/data/freeware-games.json` is a copy of the concept fixture; a test guards against drift.

## Domain laws
- **Original content immutable:** scanner opens ADFs read-only; tests assert bytes/mtime unchanged.
- **Rights policy:** unknown, missing, or unevidenced permission yields `local_only` for local play and `deny` for everything else. The Matrix value `allow_local_byog` maps to `unknown`, never `permitted`.
- **Emulator isolation:** UI talks only to `RuntimeAdapter`; only `MockRuntimeAdapter` exists.

## Decisions
- The Master Rights Matrix has no hashes. The CLI matches by normalized title, plus a small fixture hash registry (`packages/cli/src/registry.ts`) for tests. The CLI bundles a 30-record subset.
- The bundled demo ("RGME PAL Test Pattern") is RGME-generated; only local execution is evidenced, so Export/Share stay disabled.
- Browser has no hash registry yet: dropped ADFs are always `Unknown` (local only).

## Known limitations
- Runtime is a mock (no real emulator). Gamepad mapping exists in the profile but only keyboard and on-screen HUD are wired.
- Subset matrix is not auto-synced with `concept/`.

Launch: `pnpm --filter @rgme/web dev`
