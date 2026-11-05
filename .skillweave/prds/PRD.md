# Product Requirements Document (PRD) v0.7.0
## Retro Game Modernization Engine (RGME) — Milestone 7: Dynamic 4:3 Proportional Scaling, Amiga OCS Engine & Archive.org Cloud Streamer

- **Version:** 0.7.0
- **Status:** In Progress
- **Framework:** SkillWeave Blueprint + SkillWeave Design
- **Author:** `typelicious <typelicious@gmail.com>`

---

## 1. Executive Summary & Problem Statements

Milestone 7 elevates RGME into a true playable retro computing and cloud preservation workstation:
1. **Bezel Scaling Ergonomics:** The 1084S monitor was previously artificially restricted to `600px` height and `820px` width, appearing undersized on 1080p, 1440p, 4K, and ultrawide screens. It must expand proportionally to fill available viewport height while preserving the 4:3 aspect ratio and leaving exactly enough room for the controls toolbar and HUD below without scrolling.
2. **Missing Real Amiga Playability:** Real Amiga bootblocks halt when calling AmigaOS `ExecBase` library vectors (e.g. `DoIO`, `AllocMem`, `OpenLibrary`), and display output was restricted to color register lines or simulated test patterns. An authentic Amiga OCS bitplane fetcher, Copper list interpreter, and ExecBase vector dispatcher are required.
3. **Archive.org Ephemeral Cloud Streaming:** Historical preservation archives on Archive.org (e.g. `Amiga-Arquivista`, `Amiga_WHD_Games`) should be streamable directly into browser RAM on-demand, verified by the Rights Policy Engine, and mounted into virtual drives without RGME hosting or redistributing any binaries.

---

## 2. Milestone 7 Task Breakdown

### Task 1: `M7-SCALING-001` — Responsive 4:3 Viewport Scaling
- **Goal:** Dynamically scale the 1084S monitor bezel to available viewport height without artificial pixel caps.
- **Acceptance Criteria:**
  - Viewport container height clamped to `clamp(340px, calc(100vh - 250px), 88vh)`.
  - Max-width computed dynamically from height using the 4:3 CRT ratio: `min(100%, calc((height - 90px) * 1.3333 + 44px))`.
  - Controls toolbar and ControllerHUD match the bezel's width rather than being locked to `820px`.
  - Screen centered horizontally with zero horizontal overflow; all controls visible above the fold on all standard resolutions.

### Task 2: `M7-CORE-001` — Amiga OCS Copper & Bitplane Engine with ExecBase Vector Dispatcher
- **Goal:** Enable genuine Amiga bootblock programs and demos to execute their copper and bitplane rendering pipelines.
- **Acceptance Criteria:**
  - Bitplane renderer decoding 1–6 planar bitplanes (`BPL1PTH`–`BPL6PTL`) into chunky 320x256 RGBA pixels using `COLOR00`–`COLOR31`.
  - Copper list runner interpreting `MOVE` (register writes) and `WAIT` (beam synchronization) instructions.
  - ExecBase library vector dispatcher in `AmigaBus` providing valid responses for `AllocMem`, `FreeMem`, `DoIO`, `SendIO`, `WaitIO`, `OpenLibrary`, `FindTask`, and `CloseLibrary`.
  - Tested with real bootblock instructions and copper lists.

### Task 3: `M7-ARCHIVE-001` — Archive.org Ephemeral In-Memory Cloud Streamer
- **Goal:** Direct, user-agent streaming of historical preservation titles from Archive.org into RAM without local or server-side persistence.
- **Acceptance Criteria:**
  - `ArchiveOrgConnector` in `@rgme/core` querying collection metadata and downloading `.adf` / `.zip` disk images into `Uint8Array`.
  - Pure in-memory ZIP decompression using `ZipParser` (`DecompressionStream`).
  - SHA-256 calculation and evaluation against `RightsPolicyEngine`.
  - 1-Click Mount into virtual drives DF0:–DF3: with simulated floppy seek sounds.
  - Instant memory release upon unload or tab closure.
  - Web UI Cloud Streamer modal accessible from header / Command Palette (`⌘K`).

---

## 3. Verification & Quality Gates
- 100% green tests across `@rgme/core`, `@rgme/cli`, and `@rgme/web`.
- Monorepo production build clean (`pnpm build`).
- Author strictly `typelicious <typelicious@gmail.com>`.
