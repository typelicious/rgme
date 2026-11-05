# Product Requirements Document (PRD) v0.10.0
## Retro Game Modernization Engine (RGME) — Milestone 10: Spatial Modernization, Centered Viewport, Layover Drawer & Ambient Controls

- **Version:** 0.10.0
- **Status:** In Progress
- **Framework:** SkillWeave Blueprint + SkillWeave Design + SkillWeave Discovery
- **Author:** `typelicious <typelicious@gmail.com>`

---

## 1. Executive Summary & Problem Statements

Milestone 10 delivers a comprehensive spatial overhaul of the RGME web interface alongside critical runtime robustness fixes:
1. **WASM Core Media Resolution Failure:**
   - In Milestone 9, selecting freeware showcase games (*Beneath a Steel Sky*, *Flight of the Amazon Queen*), built-in demo profiles, or streamed titles while in WASM mode produced `No bytes registered for [file].adf ... Drop or mount the ADF first`.
   - `MediaRegistry` must be enhanced to pre-register demo bytes, resolve matching hashes, and provide a synthetic bootable ADF fallback for any showcase or unhydrated media entry so the WASM core never halts with an unhandled exception.
   - WASM Core must become the default runtime mode out-of-the-box (`runtimeKind = "wasm"`).
2. **Viewport Centering & Sidebar Layover Drawer:**
   - The fixed left sidebar currently consumes 320px of horizontal real estate, forcing the 1084S monitor off-center and restricting its scaling.
   - The sidebar is removed from the static flow and converted into an on-demand slide-over drawer triggered via a header icon (`🎛️ System / Drives`).
   - Inside the drawer, drives, dropzone, profile details, and export tools are arranged in two columns side-by-side (`grid grid-cols-2`).
   - The monitor viewport becomes fully centered on the page and expands to maximum comfortable width.
3. **Information Architecture Reordering:**
   - Reorder lower sections below the monitor to prioritize gaming discovery:
     1. **Retro Game Library**
     2. **ProTracker Player**
     3. **Chain of Title**
4. **Contextual Controls & Ambient Layovers:**
   - **CRT Controls:** Relocated to an icon button in the top-right corner of the monitor bezel, opening a downward-left layover panel with CRT preset toggles and sliders.
   - **Runtime Core Switcher:** Moved to the main header navigation (`⚡ WASM Core ▾`), providing a downward layover menu with telemetry.
   - **Guru Meditation Error Layover:** Errors appear as an authentic centered Amiga Guru Meditation red blinking modal with failure codes, minimizing on close to a bottom-left alert icon (`bottom-6 left-6`).
   - **Draggable Compact Remote Control:** Virtual D-Pad and action buttons become a sleek, draggable floating glass controller that can be minimized to a floating icon button next to the Reset button (`bottom-6 right-24`).

---

## 2. Milestone 10 Task Breakdown

### Task 1: `M10-MEDIA-001` — Resilient MediaRegistry & Default WASM Core Activation
- **Goal:** Ensure every disk image, demo profile, freeware classic, and stream loads without "No bytes registered" errors, and make WASM Core default.
- **Acceptance Criteria:**
  - `MediaRegistry` automatically provides fallback bootable ADF bytes for any requested media entry.
  - Pre-register bytes for `DEMO_PROFILE`, `SCENE_PROFILE`, `GURU_PROFILE`, and `FREEWARE_CLASSICS`.
  - Default `runtimeKind` set to `"wasm"` across state, refs, and storage.

### Task 2: `M10-SIDEBAR-001` — Slide-Over Layover Drawer & Centered Monitor Viewport
- **Goal:** Center the 1084S monitor on full screen width and house tools in a 2-column slide-over drawer.
- **Acceptance Criteria:**
  - Main monitor container centered with `max-w-7xl mx-auto`.
  - Floating/Header trigger opening an animated left layover drawer over the page.
  - 2-column layout inside the drawer (`grid grid-cols-2 gap-4`).
  - Dismissible via button, Escape key, or clicking backdrop.

### Task 3: `M10-SECTIONS-001` — Re-ordered Lower Content Sections
- **Goal:** Align page sections with user priority.
- **Acceptance Criteria:**
  - Section 1: Retro Game Library.
  - Section 2: ProTracker Player.
  - Section 3: Chain of Title.

### Task 4: `M10-LAYOVERS-001` — Contextual Ambient Layovers (CRT, Header Runtime, Guru Error & Draggable Remote)
- **Goal:** De-clutter the space beneath the monitor with specialized, contextual layovers.
- **Acceptance Criteria:**
  - CRT trigger icon in monitor's top-right corner with dropdown menu.
  - Runtime core selector button in Header navigation with drop-down overlay.
  - Guru Meditation style centered error modal with minimize to bottom-left pill.
  - Draggable compact remote control with minimize to bottom-right (left of Reset button).
