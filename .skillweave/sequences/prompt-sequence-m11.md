# SkillWeave Prompt Sequence: Milestone 11 (M11)

- **Target:** Mixed (Core Architecture, Emulator Bridge, Firmware Persistence, Universal Disk Extraction)
- **Methodology:** Assay
- **Autonomy Policy:** Unicorn
- **Gate:** `npm test && npm run build` 100% Green across all packages
- **Author:** `typelicious <typelicious@gmail.com>`

---

## Batch 1: Persistent Kickstart ROM & Dynamic Runtime Sync
- **Tasks:**
  - `M11-KICKSTART-001`: Persistent Kickstart ROM & Dynamic Runtime Synchronization
- **Scope:**
  - `packages/core/src/rom/kickstart-rom-store.ts`:
    - Persist `this.activeId` in `localStorage` (`rgme_active_kickstart_rom_id`).
    - Restore `this.activeId` on instantiation and in `loadPersistedRoms()`.
    - Update `setActiveRomId` and `registerRom` to update `localStorage`.
  - `packages/web/src/App.tsx`:
    - Synchronize `activeRomBytesRef` and recreate running WASM adapter dynamically on ROM change without falling back to AROS.
  - Tests in `packages/web/src/__tests__/m11-kickstart-sync.test.tsx`.

---

## Batch 2: Real Amiga Emulator Core Integration Bridge (ADR-004)
- **Tasks:**
  - `M11-EMU-001`: Real Amiga Emulator Core Integration Bridge (ADR-004)
- **Scope:**
  - `packages/core/src/runtime.ts` & `packages/web/src/lib/runtime-factory.ts`:
    - Formalize `WasmEmulatorAdapter` / `VAmigaWebAdapter` implementing `RuntimeAdapter`.
    - Provide pluggable core loader (`opts.coreUrl`, `opts.loader`) to execute real Amiga 68000 + OCS/ECS games in WebAssembly.
    - Wire emulator display, Paula audio, and floppy disk events seamlessly into the 1084S monitor.
  - Tests in `packages/core/src/__tests__/m11-emulator-bridge.test.ts`.

---

## Batch 3: Universal In-Memory Archive & Disk Extraction
- **Tasks:**
  - `M11-DISK-001`: Universal In-Memory Archive & Disk Extraction
- **Scope:**
  - `packages/web/src/App.tsx`:
    - In `mountFromLibrary`, transparently check `ZipParser.isZip(data)` and extract the inner `.adf` disk image before mounting into `DF0:`.
    - Register extracted bytes under both archive SHA-256 and media SHA-256 in `MediaRegistry` and `bytesBySha`.
  - Tests in `packages/web/src/__tests__/m11-disk-archive.test.tsx`.

---

## Batch 4: Resilient Arcade Boost & Clean Alphanumeric Title Parsing
- **Tasks:**
  - `M11-PHYSICS-001`: Resilient Arcade Boost & Clean Alphanumeric Title Parsing
- **Scope:**
  - `packages/core/src/wasm/amiga-core.ts`:
    - Fix ball kick/boost physics so the ball can always be boosted upwards regardless of vertical velocity.
    - Ensure floor bounce retains minimum upward velocity so the ball never gets stuck on the floor.
    - Filter disk title candidates to strictly require clean alphanumeric words, avoiding binary garbage tokens.
  - Tests in `packages/core/src/__tests__/m11-physics.test.ts`.
