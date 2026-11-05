# SkillWeave Execution Sequence: RGME Milestone 2
## Hardware Immersion, Filesystem & Runtime Subsystems

**Project:** Retro Game Modernization Engine (RGME)  
**Milestone:** M2 — Pure TS Amiga Filesystem, Multi-Drive Subsystem, Save State Engine, WebGL CRT Shader, Gamepad API & Library Shelf  
**Methodology:** `assay` (empirical test-driven validation)  
**Autonomy Policy:** `unicorn` (maximum autonomy, zero pauses, optimistic assumptions)  
**Parallelism:** `maximal`  
**Remaining Budget Target:** ~$12 (Claude Cloud)  

---

## Parallel Execution Lanes (Maximal Parallelism)

### Lane 1: Amiga Floppy Filesystem Engine (`FS-001`)
* **Package:** `packages/core`
* **Implement:** `AdfParser` in `packages/core/src/adf/`
  - Parse 880 KB ADF buffer (1760 sectors of 512 bytes).
  - Decode bootblock (sectors 0–1), verify 32-bit checksum.
  - Locate Root Block (sector 880), decode disk label, creation date, hash table.
  - Traverse OFS/FFS directory blocks and header blocks to extract filenames and byte streams.
* **Unit Tests:** `packages/core/src/__tests__/adf-parser.test.ts`
  - Test parsing `concept/fixtures/rgme-scene-intro.adf` and synthetic OFS buffers.

---

### Lane 2: Virtual Floppy Drive Subsystem & Stepper Sound Synth (`DRIVE-001`)
* **Package:** `packages/core` & `packages/web`
* **Implement:**
  - `FloppyController` in `@rgme/core`: manages virtual drives `DF0:`, `DF1:`, `DF2:`, `DF3:`.
  - State machine: track position (0–79), motor active, disk inserted/ejected.
  - `FloppySoundSynth` using Web Audio API: synthesizes authentic mechanical drive head step "clack", seek chirps, and drive spin noise.
  - Floppy Drive HUD in `@rgme/web`: visual disk drive LEDs (green/amber) and disk swap drawer (allowing multi-disk swapping for titles like *Flight of the Amazon Queen*).

---

### Lane 3: Persistent Save-State Engine (`SAVE-001`)
* **Package:** `packages/core` & `packages/web`
* **Implement:**
  - `SaveStateManager` using browser `IndexedDB`.
  - Save slots 1–10 storing:
    - Runtime memory snapshot
    - Disk SHA-256 and Title
    - Timestamp
    - Canvas visual preview PNG (data URL)
  - UI Drawer: Visual save slot cards with thumbnail previews and Restore/Delete buttons.
  - Import/Export `.rgmesave` file support.

---

### Lane 4: Hardware Gamepad API Subsystem (`INPUT-001`)
* **Package:** `packages/web`
* **Implement:**
  - `useGamepad` hook listening to HTML5 `navigator.getGamepads()`.
  - Standard gamepad auto-mapping (Xbox, PlayStation, 8BitDo, generic USB) mapping D-Pad / Thumbstick to Amiga Joystick directions and buttons to Fire / Auto-Fire.
  - Real-time tactile button visualizer in `ControllerHUD.tsx`.
  - Optional rumble/vibration trigger on retro events.

---

### Lane 5: High-Fidelity WebGL CRT Shader (`CRT-001`)
* **Package:** `packages/web`
* **Implement:**
  - WebGL post-processing canvas renderer in `packages/web/src/components/CrtShaderCanvas.tsx`.
  - Fragment shader featuring:
    - Scanlines with configurable pitch/depth.
    - Aperture grille / phosphor shadow mask.
    - Barrel screen curvature (toggleable) + vignette shadow.
    - Phosphor bloom and persistence.
  - Preset switcher in header: "Commodore 1084S", "Sony Trinitron", "Clean Pixel", "Arcade CRT".
  - Graceful fallback to 2D CSS if WebGL is unavailable.

---

### Lane 6: Persistent Browser Game Library (`LIB-001`)
* **Package:** `packages/web`
* **Implement:**
  - `IndexedDB` collection store: saves dropped ADFs, extracted metadata, and resolved GameProfiles so the collection survives page reloads.
  - Library view: grid of game cards with cover/title, Chipset badge, Rights Class badge (A/C/D), and 1-Click "Mount in DF0: & Play" button.
  - Search and filter bar (by Title, Rights Class, Year).

---

## Gate & Verification Policy
Run the workspace-wide verification gate:
```bash
pnpm test && pnpm build
```
- Core tests must pass 100% (including ADF parser and Floppy drive controller).
- Web build must succeed without type or shader errors.
- Commit all changes with author `typelicious <typelicious@gmail.com>`.
