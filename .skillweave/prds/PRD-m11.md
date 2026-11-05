# Product Requirements Document (PRD) v0.11.0
## Retro Game Modernization Engine (RGME) — Milestone 11: Real Amiga Emulation via Pluggable WASM Core (ADR-004), Persistent Kickstart & Universal Disk Engine

- **Version:** 0.11.0
- **Status:** Approved / In Execution
- **Framework:** SkillWeave Blueprint + SkillWeave Discovery + SkillWeave Design
- **Methodology:** Assay
- **Autonomy Policy:** Unicorn
- **Author:** `typelicious <typelicious@gmail.com>`

---

## 1. Executive Summary & Problem Statements

### The Problem
1. **Reference Core vs. Real Emulation Disconnect:**
   - In Milestone 9 & 10, RGME built a robust WASM integration harness (`WasmAmigaHardwareCore`) that validates PAL timing, cycle budgets, Floppy-DMA, Paula audio, and an interactive Boing Ball breakout testbed.
   - However, when users mount real commercial Amiga games (*Rick Dangerous*, *Beneath a Steel Sky*, *Wayne Gretzky Hockey*), they expect the **actual commercial game graphics, code and sound** to execute, not just the reference testbed.
   - Per **ADR-004**, RGME isolates emulator implementations behind `RuntimeAdapter` (`createRuntime({ coreUrl })`). The engine must provide a seamless, pluggable WebAssembly emulator bridge capable of booting and executing real Amiga OCS/ECS games in the browser.

2. **Persistent Kickstart ROM Desynchronization:**
   - When a user uploads a valid Commodore Kickstart ROM (`kick40063.A600`, Kickstart 1.3, etc.), the selection is recognized by the modal, but:
     a) `KickstartRomStore` never persists `activeId` into `localStorage`, causing refreshes to silently reset to AROS.
     b) `App.tsx` initializes `activeRomBytesRef` asynchronously after the first adapter is already mounted, leaving the running WASM core bound to AROS.
     c) Switching games or mounting from library reuses the existing runtime adapter without injecting the updated Kickstart ROM.

3. **Compressed Archive Ingestion in Library:**
   - Dropping `.zip` files (e.g. `Rick Dangerous (Europe).zip`) extracts the inner `.adf` on initial drop, but storing the raw file in IndexedDB causes `mountFromLibrary` to mount raw `.zip` bytes directly into `DF0:`, breaking boot execution.
   - All library and streaming paths must transparently auto-extract `.zip` and `.ipf` disk images into valid ADF sector streams before insertion.

4. **Arcade Engine Resilience:**
   - The interactive reference arcade physics must never get trapped in a dead-stop on the floor and must allow immediate, responsive kicking/boosting in any viewport scale.

---

## 2. Milestone 11 Task Breakdown

### Task 1: `M11-KICKSTART-001` — Persistent Kickstart ROM & Dynamic Runtime Synchronization
- **Goal:** Ensure user-uploaded Kickstart ROMs are permanently remembered and dynamically injected into all WASM runtimes without reverting to AROS.
- **Acceptance Criteria:**
  - `KickstartRomStore` persists `activeId` in `localStorage` (`rgme_active_kickstart_rom_id`).
  - `loadPersistedRoms()` restores the active ROM selection automatically.
  - On ROM change in `KickstartModal`, the WASM runtime adapter is immediately recreated with the new ROM bytes and restarts the current profile if loaded.
  - `App.tsx` ensures `activeRomBytesRef` is resolved and synchronized before initializing or mounting any game.

### Task 2: `M11-EMU-001` — Real Amiga Emulator Core Integration Bridge (ADR-004)
- **Goal:** Connect a real Amiga OCS/ECS WebAssembly execution engine behind `RuntimeAdapter` for genuine commercial game execution.
- **Acceptance Criteria:**
  - Implement `WasmEmulatorAdapter` / `VAmigaWebAdapter` adhering to the full `RuntimeAdapter` interface.
  - Support configurable core loading via `createRuntime("wasm", canvas, { coreUrl, loader, media, kickstartRom })`.
  - Provide an official Amiga 68000 + OCS/ECS runtime mode in the Header and Runtime Switcher that transparently boots real game binaries (including *Rick Dangerous*, *Turrican*, *Wayne Gretzky Hockey*, and Freeware Classics).
  - Clean canvas lifecycle, pause, resume, reset, and audio routing to the WebAudio context.

### Task 3: `M11-DISK-001` — Universal In-Memory Archive & Disk Extraction
- **Goal:** Transparent extraction and mounting of zipped and IPF-compressed media across all entry points.
- **Acceptance Criteria:**
  - `mountFromLibrary` transparently unzips `.zip` archives and decodes `.ipf` tracks in-memory.
  - `remember` registers both the archive SHA-256 and the extracted `.adf` SHA-256 in `MediaRegistry` and `bytesBySha`.
  - Seamless 1-click launch from Library cards for both single-disk and multi-disk games.

### Task 4: `M11-PHYSICS-001` — Resilient Arcade Boost & Clean Alphanumeric Title Parsing
- **Goal:** Perfect arcade responsiveness and eliminate binary gibberish titles.
- **Acceptance Criteria:**
  - The Boing ball can always be boosted/kicked upwards with Up or Fire/Space, even when resting on the floor.
  - Floor bounce retains a minimum rebound velocity so the ball never dies.
  - Disk title extraction strictly requires clean alphanumeric tokens (avoiding `CF+Y>=D` garbage).
