# Product Requirements Document (PRD) v0.6.0
## Retro Game Modernization Engine (RGME) — Milestone 6: Monitor Framing, Guru Meditation, Demo Lifecycle & Interactive Playability

- **Version:** 0.6.0
- **Status:** In Progress
- **Framework:** SkillWeave Blueprint + Impeccable Design
- **Author:** `typelicious <typelicious@gmail.com>`

---

## 1. Executive Summary & Problem Statements

Milestone 6 resolves critical usability and retro-computing authenticity issues identified in real-world testing:
1. **Monitor Overscaling on Wide Displays:** The 1084S monitor bezel previously grew with horizontal container width, pushing emulation controls, shaders, and gamepad options off the bottom of the screen.
2. **Missing Unload/Eject Lifecycle:** Once a demo or tracker tune was started, it could not be cleanly unloaded; audio and animations looped indefinitely without an eject/stop mechanism.
3. **Absence of the Amiga Guru Meditation:** The most famous Amiga system failure screen was missing from the demonstration catalog.
4. **Non-Interactive Test Pattern on Loaded Games:** Loading freeware showcase games produced static color test bars rather than an interactive playable retro experience.

---

## 2. Milestone 6 Task Breakdown

### Task 1: `M6-MONITOR-001` — Viewport & Bezel Height Containment
- **Goal:** Bound the 1084S monitor bezel to available viewport height so all primary controls are visible without vertical scrolling.
- **Acceptance Criteria:**
  - Viewport container constrained to `max-height: min(68vh, 640px)`.
  - Width automatically clamped according to 4:3 aspect ratio (`max-width: min(100%, 840px)`).
  - Emulation control toolbar (Start, Pause, Reset, Unload, CRT, Runtime) sits directly beneath the monitor on standard laptop (768p) and desktop (1080p/4K) displays.

### Task 2: `M6-LIFECYCLE-001` — Complete Demo & Game Unload / Eject Engine
- **Goal:** Enable clean unloading and state reset for any running game, scene demo, or tracker tune.
- **Acceptance Criteria:**
  - `unloadGame()` resets adapter state to `UNLOADED`, stops render loops, and silences all audio.
  - FloppyController ejects DF0:-DF3: and sets motor activity to idle.
  - UI demo buttons toggle between `Load` and `⏏ Unload` (or paired buttons).
  - Global `⏏ Unload / Eject` button in the emulation toolbar.
  - Reset cleans the canvas back to authentic powered-down Amiga black.

### Task 3: `M6-GURU-001` — Iconic Amiga Guru Meditation Error Screen
- **Goal:** Deliver an authentic Commodore Amiga Guru Meditation failure display.
- **Acceptance Criteria:**
  - Pure black canvas with pulsating/blinking red border (`#ff0000`, 3px, 1.0 Hz).
  - Authentic centered Topáz monospace text: `Software Failure.  Press left mouse button to continue. / Guru Meditation #00000004.00004845`.
  - Left mouse click or spacebar reboots the system (audio seek click + canvas reset).
  - Dedicated `Guru Meditation` demo launcher in UI and Command Palette.

### Task 4: `M6-PLAYABLE-001` — Interactive Playable Retro Engine for Showcase Titles
- **Goal:** Replace static SMPTE color test bars with an interactive Amiga-style engine.
- **Acceptance Criteria:**
  - When loading showcase titles or mock adapter, render an interactive Commodore Amiga Boing Ball experience:
    - 3D-shaded checkered sphere with real-time rotational transformation and drop shadow.
    - Keyboard arrow and gamepad steering with bounce physics against screen boundaries.
    - Synthesized stereo audio bounce sound on wall collisions.
  - Clear user indicators distinguishing interactive showcase simulations from dropped user ADF disk images.

---

## 3. Verification & Quality Gates
- 100% green tests across `@rgme/core`, `@rgme/cli`, `@rgme/web`.
- TypeScript strict typecheck clean.
- Production build succeeds without errors.
- Author identity strictly preserved as `typelicious <typelicious@gmail.com>`.
