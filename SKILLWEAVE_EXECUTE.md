# SkillWeave Execution Engine — Standalone Execution Guide

This document is the self-contained execution specification for running the **Retro Game Modernization Engine (RGME)** Milestone 1 promptchain using an autonomous AI coding agent (e.g., Claude Code in Claude Cloud).

---

## 1. Execution Overview & Laws

You are executing **Milestone 1** of RGME under the **Ralph Loop** methodology.
Your roadmap is defined in:
- Sequence: `.skillweave/sequences/prompt-sequence-m1.md`
- Machine Plan: `.skillweave/sequences/execution-sequences.yaml`
- PRD & Task Registry: `.skillweave/prds/prd.json`
- Design Tokens: `.skillweave/design/rgme-design-system.md`

### Immutable Domain Laws
1. **Original Content is Immutable:** Game files (ADF, ROMs) are never altered. All profiles, configs, saves, and enhancement packages are external versioned layers.
2. **Rights Policy Golden Rule:** *Unknown rights never become permission by inference.* If rights are missing or unverified, execution is restricted to `local_only` and redistribution/export is strictly denied.
3. **Emulator Isolation:** The UI and game profile schemas MUST NOT import or depend directly on emulator internals (PUAE/libretro). All interactions flow strictly through the `RuntimeAdapter` interface.

---

## 2. Ralph Loop Execution Protocol

Execute the sequence strictly in **4 dependency-ordered batches**. Do not jump ahead to UI work before the domain schemas and adapters are tested and passing!

```text
[Batch 1: ARCH-001] ──► Gate 1 (Build & Test)
          │
          ▼
[Batch 2: CORE-001 + CORE-002] ──► Gate 2 (Core Tests 100%)
          │
          ▼
[Batch 3: CLI-001 + UI-001] ──► Gate 3 (CLI Test + Web Build)
          │
          ▼
[Batch 4: INTEG-001] ──► Gate 4 (Full E2E Pass)
```

### For Every Batch:
1. **Load Context:** Read the assigned tasks from `.skillweave/sequences/prompt-sequence-m1.md`.
2. **Execute Implementation:**
   - Create/modify files adhering strictly to TypeScript strict mode.
   - Implement unit tests alongside implementation code.
3. **Run Binary Gate:** Execute the gate command specified for that batch.
4. **Self-Correction Loop:**
   - If a gate command fails, analyze the test failure or compile error.
   - Apply fixes and re-run the gate (up to 3 iterations).
   - Never mock tests just to pass; implement the real logic.
5. **Persist State:**
   - Mark `passes: true` for the completed task IDs in `.skillweave/prds/prd.json`.
   - Create a clean git commit: `git commit -m "feat(scope): complete task <ID>"`

---

## 3. Batch Breakdown & Gates

### Batch 1: Monorepo Scaffold & Tooling
* **Task:** `ARCH-001` (Initialize Monorepo, Build Tooling and CI Baseline)
* **Packages:**
  - `packages/core` (`@rgme/core`)
  - `packages/cli` (`@rgme/cli`)
  - `packages/web` (`@rgme/web`)
* **Required Files:** `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, Vitest config.
* **Gate 1:**
  ```bash
  pnpm install && pnpm build && pnpm test
  ```

---

### Batch 2: Core Domain Schemas & Runtime Adapter
* **Tasks:**
  - `CORE-001`: Zod schemas for `GameProfile` (`rgme.game/v0.2`), `RightsRecord`, and `RightsPolicyEngine`.
  - `CORE-002`: `RuntimeAdapter` interface + `MockRuntimeAdapter` (renders 50Hz test pattern to Canvas, manages save slots).
* **Package:** `packages/core`
* **Gate 2:**
  ```bash
  pnpm --filter @rgme/core test
  ```

---

### Batch 3: CLI Ingestion & Web UI Shell
* **Tasks:**
  - `CLI-001`: `rgme scan <dir>` command with streaming SHA-256 and rights matching.
  - `UI-001`: React + Vite web shell implementing `.skillweave/design/rgme-design-system.md` (Amiga Workbench accents, drag-and-drop ADF loader, 4:3 PAL Canvas viewport, CRT scanline toggle, virtual joystick HUD).
* **Packages:** `packages/cli` and `packages/web`
* **Gate 3:**
  ```bash
  pnpm --filter @rgme/cli test && pnpm --filter @rgme/web build
  ```

---

### Batch 4: E2E Verification & Integration
* **Task:** `INTEG-001` (Full Demonstrator Integration)
* **Goal:** Connect `@rgme/web` with `MockRuntimeAdapter` and bundled sample profile, verify dropzone-to-play lifecycle.
* **Gate 4:**
  ```bash
  pnpm test && pnpm build
  ```

---

## 4. Completion & Handoff
Once Gate 4 passes:
1. Ensure all task entries in `.skillweave/prds/prd.json` have `"passes": true`.
2. Generate an execution summary report in `.skillweave/tracking-log/m1-execution-report.md`.
3. Inform the user that Milestone 1 is verified and ready for local launch (`pnpm --filter @rgme/web dev`).
