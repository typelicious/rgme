# SkillWeave Execution Sequence: RGME Milestone 1

**Project:** Retro Game Modernization Engine (RGME)  
**Milestone:** M1 — Foundation, Domain Schemas, RuntimeAdapter & Web UI Shell  
**Methodology:** Ralph Loop (`ralph`)  
**Autonomy Policy:** `medium`  
**Session Schedule:** `batch`  
**PRD Reference:** `.skillweave/prds/prd.json` & `.skillweave/prds/PRD.md`  
**Design Reference:** `.skillweave/design/rgme-design-system.md`  

---

## Pre-Flight Check
Ensure Node.js >= 20 and pnpm (or npm) are installed in the execution environment.

---

## Batch 1: Monorepo Scaffold & Tooling

### Task ARCH-001: Initialize Monorepo and Tooling Baseline
- **Goal:** Set up a clean TypeScript monorepo with packages:
  - `packages/core` (`@rgme/core`): Domain schemas, rights matrix, adapter contracts.
  - `packages/cli` (`@rgme/cli`): Command-line scanner and rights resolver.
  - `packages/web` (`@rgme/web`): Vite + React + Tailwind CSS web application.
- **Deliverables:**
  - `package.json` (root) + `pnpm-workspace.yaml` (or npm workspace configuration).
  - Shared `tsconfig.base.json` and package-specific `tsconfig.json` files.
  - Vitest test setup configured for workspace-wide test runs (`pnpm test`).
  - Minimal placeholder `index.ts` / test in each package.
- **Verification Gate:**
  ```bash
  pnpm install && pnpm build && pnpm test
  ```
  *Gate criteria: zero errors, all packages compile clean.*

---

## Batch 2: Core Domain Models & Runtime Abstraction

### Task CORE-001: Implement GameProfile & Rights Policy Schemas in `@rgme/core`
- **Goal:** Implement strict Zod schemas and TypeScript types reflecting `concept/RGME-MVP-Technical-Specification-PRD-v0.2.md`.
- **Key Deliverables:**
  - `GameProfile` schema (`rgme.game/v0.2`):
    - `id`, `title`, `platform` (`amiga`), `media` (ADF hash, filename, label), `machine` (model: A500/A600, chipset: OCS/ECS, video: PAL/NTSC, ram: chip/fast).
  - `RightsRecord` & `EvidenceStore` schemas:
    - IP rights holder provenance, status (`public_domain`, `freeware`, `authorized`, `commercial_restricted`, `unknown`).
  - `RightsPolicyEngine`:
    - Method `evaluateAction(record: RightsRecord, action: RequestedAction): PolicyDecision`.
    - **Invariant:** *Unknown rights never become permission by inference.*
  - Comprehensive Vitest unit tests in `packages/core/src/__tests__/rights.test.ts` and `profile.test.ts`.

### Task CORE-002: Implement RuntimeAdapter Interface & MockRuntimeAdapter in `@rgme/core`
- **Goal:** Decouple emulator engine from the frontend using the universal `RuntimeAdapter` pattern.
- **Key Deliverables:**
  - Interface `RuntimeAdapter` with methods:
    `identifyCapabilities()`, `loadGame(profile)`, `start()`, `pause()`, `reset()`, `saveState(slot)`, `loadState(slot)`, `setInputMapping(mapping)`, `setDisplayProfile(profile)`, `insertMedia(media)`.
  - Class `MockRuntimeAdapter` implementing `RuntimeAdapter`:
    - Renders a 50Hz PAL test pattern with animated raster lines to an `HTMLCanvasElement` (or node-canvas/mock context in tests).
    - Simulates disk access audio tones / status indicators.
    - Manages in-memory save state slots with timestamp metadata.
  - Unit tests verifying adapter lifecycle state transitions (`UNLOADED` -> `LOADED` -> `RUNNING` -> `PAUSED` -> `SAVED`).
- **Batch 2 Verification Gate:**
  ```bash
  pnpm --filter @rgme/core test
  ```
  *Gate criteria: 100% test pass on profile parsing, policy evaluation, and adapter states.*

---

## Batch 3: CLI Scanner & Web UI Shell

### Task CLI-001: Implement CLI File Ingestion & Resolver in `@rgme/cli`
- **Goal:** CLI utility to scan directories for Amiga files and generate declarative profiles.
- **Key Deliverables:**
  - Command: `rgme scan <directory>` using `commander` or `cac`.
  - Recursively finds `.adf` disk images without modifying them.
  - Computes SHA-256 hash in a stream.
  - Resolves against bundled master registry (`concept/RGME-Amiga-Master-Rights-Matrix-v0.2.json` subset).
  - Outputs a formatted terminal table showing Title, Chipset, and Rights Status.
  - Generates a declarative `game-profile.yaml` for identified games.
  - Unit tests in `packages/cli` verifying scan and profile generation.

### Task UI-001: Build Web Player Shell & Viewport in `@rgme/web`
- **Goal:** Modern retro frontend implementing `.skillweave/design/rgme-design-system.md`.
- **Key Deliverables:**
  - Vite + React + Tailwind CSS configured with RGME design tokens.
  - **Header:** Boing ball badge, project title, and active runtime status pill.
  - **Dropzone:** Drag-and-drop ADF loader with client-side SHA-256 calculation (Web Crypto API) and instant metadata display.
  - **GameProfile Inspector:** Panel showing machine config, video standard (PAL 50Hz), and color-coded Rights badge.
  - **Viewport Canvas:**
    - Canvas container mounting `RuntimeAdapter`.
    - Fixed 4:3 aspect ratio container with integer scaling.
    - CRT shader toggle (scanlines + subtle bloom).
  - **Controller HUD:** Virtual Amiga joystick overlay showing active button presses.
- **Batch 3 Verification Gate:**
  ```bash
  pnpm --filter @rgme/cli test && pnpm --filter @rgme/web build
  ```
  *Gate criteria: CLI tests pass and Web Vite build produces a valid production bundle.*

---

## Batch 4: Integration & E2E Verification

### Task INTEG-001: End-to-End Demonstrator & Verification
- **Goal:** Tie the web shell to `MockRuntimeAdapter` and bundled sample game profile to deliver a working Milestone 1 demonstrator.
- **Key Deliverables:**
  - Web UI can load bundled sample profiles (e.g. freeware Amiga PD demo).
  - Canvas displays live test raster and responds to keyboard/gamepad inputs.
  - Rights policy evaluator blocks unauthorized export/distribution buttons while allowing local playback.
  - Workspace-wide Vitest integration test verifying the whole pipeline.
- **Final Verification Gate:**
  ```bash
  pnpm test && pnpm build
  ```
  *Gate criteria: 100% tests passing across all 3 packages, 0 build errors.*
