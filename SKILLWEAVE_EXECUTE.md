# SkillWeave Execution Engine — Assay / Unicorn Execution Guide

This document is the execution specification for running the **Retro Game Modernization Engine (RGME)** Milestone 1 promptchain using an autonomous AI coding agent in **Assay Methodology** with **Unicorn Autonomy Policy** (Maximal Parallelism).

---

## 1. Operating Parameters & Posture

- **Methodology:** `assay` (Empirical, test-driven validation; hypothesis testing through rapid parallel implementation and verification)
- **Autonomy Policy:** `unicorn` (Maximum autonomy, zero-friction optimistic assumptions, never halt on non-blocking ambiguity)
- **Parallelism:** `maximal` (Concurrent execution across packages with disjoint write scopes)
- **Current Status:**
  - `ARCH-001` (Batch 1: Monorepo Scaffold) is **COMPLETED**.
  - Next: Concurrently execute `CORE-001`, `CORE-002`, `CLI-001`, and `UI-001`.

### Pragmatic Unicorn Decisions (Pre-Approved)
1. **Rights Matrix Hash Matching:** The Master Rights Matrix (`concept/RGME-Amiga-Master-Rights-Matrix-v0.2.json`) indexes titles by canonical names. Match by normalized title, and use `concept/fixtures/freeware-games.json` as the fixture registry of known SHA-256 hashes.
2. **Bundled Test Fixtures & Demoscene Intro:**
   - Real Amiga floppy disk image already generated: `concept/fixtures/rgme-scene-intro.adf` (880 KB, valid Amiga bootblock).
   - Bundled Freeware Profiles: `concept/fixtures/freeware-games.json` and `concept/fixtures/profiles/` (Flight of the Amazon Queen, Beneath a Steel Sky, Lure of the Temptress, RGME Scene Intro).
3. **Mock Runtime Adapter & Intro Audio/Visuals:**
   - Visuals: Canvas renders Amiga Copper raster rainbows, a stylized graffiti "RGME" metallic logo with shine/wobble, and a demoscene sine scroller.
   - Audio: Web Audio API chiptune synth playing an energetic Chris Huelsbeck / Turrican-inspired 4-channel arpeggio & bassline.
4. **Emulator Isolation:** Zero direct imports of emulator binaries in `@rgme/web`; all runtime interactions flow through `@rgme/core`'s `RuntimeAdapter`.

---

## 2. Assay / Maximal Parallel Execution Lanes

Proceed autonomously across the following parallel lanes:

### Lane A: Core Domain Models & Rights Engine (`CORE-001`)
* Package: `packages/core`
* Implement Zod schemas: `GameProfile` (`rgme.game/v0.2`), `MachineConfig`, `RightsRecord`.
* Implement `RightsPolicyEngine.evaluateAction()`:
  - *Invariant:* Unknown rights never become permission by inference (`local_only` or `deny`).
* Vitest suite: `packages/core/src/__tests__/rights.test.ts`.

### Lane B: RuntimeAdapter & Mock Demonstrator (`CORE-002`)
* Package: `packages/core`
* Define `RuntimeAdapter` interface (`identifyCapabilities`, `loadGame`, `start`, `pause`, `reset`, `saveState`, `loadState`, `setInputMapping`, `setDisplayProfile`, `insertMedia`).
* Implement `MockRuntimeAdapter` with Canvas raster rendering and in-memory state slots.
* Vitest suite: `packages/core/src/__tests__/adapter.test.ts`.

### Lane C: CLI Scanner & Resolver (`CLI-001`)
* Package: `packages/cli`
* CLI command: `rgme scan <dir>` discovering `.adf` disk images.
* Streaming SHA-256 calculation + normalized title resolver against the Master Rights Matrix.
* Generates `game-profile.yaml`.
* Vitest suite: `packages/cli/src/__tests__/scan.test.ts`.

### Lane D: Web UI Shell & Viewport (`UI-001`)
* Package: `packages/web`
* Styled with `.skillweave/design/rgme-design-system.md` (Amiga Workbench accents, dark matte canvas).
* Drag-and-drop ADF zone with client-side SHA-256 calculation.
* Canvas Viewport with 4:3 PAL aspect-ratio lock and CRT scanline toggle.
* Virtual Gamepad HUD.

---

## 3. Empirical Verification Gates (Assay)

After concurrent implementation:

1. **Gate 2 (Workspace Build & Test):**
   ```bash
   pnpm build && pnpm test
   ```
   *Empirically proves that all parallel lanes integrate cleanly without type or schema mismatches.*

2. **Integration & E2E Slice (`INTEG-001`):**
   - Connect `@rgme/web` to `MockRuntimeAdapter` and sample game profile.
   - Run end-to-end integration tests.

3. **Gate 3 (Final Verification):**
   ```bash
   pnpm test && pnpm build
   ```

4. **Persistence:**
   - Mark all tasks `"passes": true` in `.skillweave/prds/prd.json`.
   - Commit: `git commit -m "feat: complete RGME milestone 1 (assay/unicorn)"`.
