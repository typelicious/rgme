# SkillWeave Prompt Sequence: Milestone 7 (M7)

- **Target:** Mixed (UI, Core Emulation Engine, Cloud Networking)
- **Complexity:** Standard (Ralph Loop Batch Execution)
- **Gate:** `pnpm test && pnpm build` 100% Green
- **Author:** `typelicious <typelicious@gmail.com>`

---

## Batch 1: UI Scaling & Core Amiga OCS Engine
- **Tasks:**
  - `M7-SCALING-001`: Responsive 4:3 Viewport Scaling without Artificial Bounds
  - `M7-CORE-001`: Amiga OCS Copper & Bitplane Engine with ExecBase Vector Dispatcher
- **Scope:**
  - `packages/web/src/bezel.css`: Update `.bezel-outer`, `.bezel-screen`, and viewport containers to dynamic height and 4:3 calculated width.
  - `packages/web/src/App.tsx`: Align control bar and HUD width dynamically to monitor bezel width.
  - `packages/core/src/cpu/amiga-boot.ts`: Implement bitplane renderer (1-6 planes -> 320x256 RGBA chunky), Copper list processor (`MOVE` and `WAIT`), and synthetic `ExecBase` Kickstart vector handler (`AllocMem`, `FreeMem`, `DoIO`, `SendIO`, `WaitIO`, `OpenLibrary`, `CloseLibrary`).
  - `packages/core/src/__tests__/m7-core.test.ts`: Unit tests verifying bitplane decoding, Copper list line synchronization, and ExecBase vector calls.

---

## Batch 2: Archive.org Ephemeral Cloud Streamer & Web Integration
- **Tasks:**
  - `M7-ARCHIVE-001`: Archive.org Ephemeral In-Memory Cloud Streamer & Catalog Connector
- **Scope:**
  - `packages/core/src/archive/archive-connector.ts`: `ArchiveOrgConnector` for metadata discovery (`archive.org/metadata/{id}/files`), binary array stream download, in-memory ZIP decompression, and SHA-256 calculation.
  - `packages/core/src/index.ts`: Export `archive-connector.ts`.
  - `packages/web/src/components/CloudStreamModal.tsx`: Accessible modal with presets (`Amiga-Arquivista`, `Amiga_WHD_Games`), search/filtering, and 1-Click Stream & Mount.
  - `packages/web/src/App.tsx`: Connect CloudStreamModal to FloppyController, RightsPolicyEngine, and Command Palette (`⌘K`).
  - `packages/web/src/__tests__/m7-integration.test.tsx`: End-to-end integration tests verifying dynamic monitor scaling, real Amiga OCS bitplane rendering, and Archive.org stream mounting.

---

## Batch 3: Verification & Release Gate
- Full monorepo verification: `pnpm test && pnpm build`.
- Update `.skillweave/prds/prd.json` to mark all tasks `passes: true`.
- Update `README.md` test badge.
- Git commit authored strictly by `typelicious <typelicious@gmail.com>` (zero Claude lines) and push to remote.
