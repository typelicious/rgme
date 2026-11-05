# SkillWeave Execution Sequence: Milestone 6
## Monitor Height Containment, Guru Meditation, Demo Lifecycle Unload & Interactive Playability

- **Sequence ID:** `seq-m6-001`
- **Complexity:** Standard (Ralph Loop)
- **Target:** Mixed (Human Readable & Machine Executable)
- **Parallelism:** Batch Execution with Dependencies

---

## Batch 1: UI Viewport & Lifecycle Core (Independent)
### Step 1.1: `M6-MONITOR-001` — Viewport & Bezel Height-Bound Scaling
- **Files:** `packages/web/src/bezel.css`, `packages/web/src/components/Viewport.tsx`, `packages/web/src/App.tsx`
- **Action:** Constrain `.rgme-viewport-container` and `.rgme-bezel` to `max-height: min(68vh, 640px)`, `max-width: min(100%, 840px)`, margin `0 auto`. Ensure CRT controls and buttons sit directly below monitor on wide screens.
- **Binary Gate:** Monitor never overflows vertical viewport; controls visible without scrolling.

### Step 1.2: `M6-LIFECYCLE-001` — Demo & Game Lifecycle Unload & State Reset
- **Files:** `packages/core/src/runtime.ts`, `packages/core/src/mock-runtime.ts`, `packages/web/src/App.tsx`, `packages/web/src/components/FloppyDrives.tsx`
- **Action:** Implement `unloadGame()` in App and RuntimeAdapter. Reset floppy drives, silence audio synth, clear profile, set status to `UNLOADED`. Add Load/Unload toggle buttons for each demo and central `⏏ Unload / Eject` button.
- **Binary Gate:** Unload cleanly stops animation and audio; status returns to `UNLOADED`.

---

## Batch 2: Amiga Authenticity & Playable Engine
### Step 2.1: `M6-GURU-001` — Iconic Amiga Guru Meditation Error Screen
- **Files:** `packages/core/src/guru-meditation.ts`, `packages/web/src/components/GuruMeditation.tsx`, `packages/web/src/App.tsx`, `packages/web/src/components/CommandPalette.tsx`
- **Action:** Implement Guru Meditation screen renderer with blinking red border (1.0 Hz), Topáz red monospace text `#00000004.00004845#`, and mouse-click reboot sound. Add "Guru Meditation" demo launcher.
- **Binary Gate:** Displays authentic red-on-black error; click triggers reboot.

### Step 2.2: `M6-PLAYABLE-001` — Interactive Playable Retro Engine for Showcase Games
- **Files:** `packages/core/src/mock-runtime.ts`, `packages/web/src/components/LibraryShelf.tsx`
- **Action:** Replace static color test pattern in `MockRuntimeAdapter` with an interactive Amiga Boing Ball simulation (3D checkered sphere, rotation, bounce physics, arrow/gamepad controls, stereo collision sound). Add clear UI badge for showcase games.
- **Binary Gate:** Showcase games launch into interactive playable simulation with sound and movement.

---

## Final Gate: Monorepo Integration & Verification
- **Command:** `pnpm test && pnpm build`
- **Requirements:** 100% tests green across all packages, clean production build, git author `typelicious <typelicious@gmail.com>`.
