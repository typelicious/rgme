# RGME Milestone 1 — Execution Report

Methodology: assay · Autonomy: unicorn · Parallelism: CLI and Web lanes ran in parallel after Core.

| Batch | Tasks | Gate | Result |
|---|---|---|---|
| 1 | ARCH-001 | `pnpm install && pnpm build && pnpm test` | pass |
| 2 | CORE-001, CORE-002 | `pnpm --filter @rgme/core test` | pass (27 tests) |
| 3 | CLI-001, UI-001 | `pnpm --filter @rgme/cli test && pnpm --filter @rgme/web build` | pass |
| 4 | INTEG-001 | `pnpm test && pnpm build` | pass (core 27, cli 9, web 10 = 46 tests) |

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
