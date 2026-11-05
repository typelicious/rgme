# SkillWeave Execution Engine — Assay / Unicorn Execution Guide

This document is the execution specification for running the **Retro Game Modernization Engine (RGME)** using an autonomous AI coding agent in **Assay Methodology** with **Unicorn Autonomy Policy** (Maximal Parallelism).

---

## 1. Operating Parameters & Posture

- **Current Milestone:** **Milestone 2 (Hardware Immersion, Filesystem & Runtime Subsystems)**
- **Methodology:** `assay` (Empirical, test-driven validation; rapid parallel execution)
- **Autonomy Policy:** `unicorn` (Maximum autonomy, zero pauses, optimistic assumptions, never stop for non-blocking clarifications)
- **Parallelism:** `maximal` (Execute all parallel lanes concurrently)
- **Target Budget:** ~$12 Claude Cloud remaining

---

## 2. Milestone 2 Implementation Scope

Execute the following 6 parallel lanes concurrently:

1. **`FS-001` (Amiga Floppy Filesystem Engine in `@rgme/core`):**
   - Implement `AdfParser` in TypeScript to read 880 KB ADF buffers.
   - Decode bootblock, root block (sector 880), OFS/FFS directory blocks, file entries.
   - Extract disk volume name and file streams.
   - Unit tests parsing `concept/fixtures/rgme-scene-intro.adf` and synthetic OFS buffers.

2. **`DRIVE-001` (Virtual Floppy Controller DF0:-DF3: & Step Sound Synth):**
   - Manage multiple virtual drives (`DF0:` to `DF3:`) with motor state and cylinder position.
   - Synthesize Amiga floppy drive mechanical head step & click sounds using Web Audio API.
   - Add drive LEDs and disk swap drawer in `@rgme/web` (enabling multi-disk swapping).

3. **`SAVE-001` (Save State Persistence Engine):**
   - Implement `SaveStateManager` using browser IndexedDB.
   - Support slots 1–10 with canvas visual thumbnail snapshots (data URL), disk ID, and timestamp.
   - UI Save/Load drawer with slot cards, restore button, and `.rgmesave` export/import.

4. **`INPUT-001` (HTML5 Gamepad API Subsystem):**
   - Auto-detect physical USB/Bluetooth gamepads (Xbox, PlayStation, 8BitDo).
   - Map standard gamepad inputs to Amiga Joystick directions and Fire button.
   - Show live tactile feedback on `ControllerHUD`.

5. **`CRT-001` (High-Fidelity WebGL CRT Shader Pipeline):**
   - WebGL post-processing shader for the canvas viewport.
   - Scanlines, shadow mask / aperture grille, curvature, and bloom persistence.
   - Presets: "Commodore 1084S", "Sony Trinitron", "Clean Pixel", "Arcade CRT".
   - Fallback to 2D CSS if WebGL is unavailable.

6. **`LIB-001` (Persistent Browser Game Library Shelf):**
   - Store scanned ADFs, profiles, and metadata in IndexedDB so games persist across reloads.
   - Library view with game cards, search, Rights Class filtering, and 1-click launch.

---

## 3. Verification & Gate Checks
Run:
```bash
pnpm test && pnpm build
```
- Ensure 100% test pass rate.
- Commit all changes with author `typelicious <typelicious@gmail.com>`.
- Push to GitHub: `git push origin claude/admiring-gauss-f991hx`.
