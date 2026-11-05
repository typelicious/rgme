# SkillWeave Prompt Sequence: Milestone 10 (M10)

- **Target:** Mixed (Core Storage, Viewport Architecture, Ambient Layovers & Remote Control)
- **Methodology:** Assay
- **Autonomy Policy:** Unicorn
- **Gate:** `pnpm test && pnpm build` 100% Green
- **Author:** `typelicious <typelicious@gmail.com>`

---

## Batch 1: MediaRegistry Resiliency & Default WASM Core
- **Tasks:**
  - `M10-MEDIA-001`: Resilient MediaRegistry & Default WASM Core Activation
- **Scope:**
  - `packages/web/src/lib/runtime-factory.ts`:
    - Extend `MediaRegistry` with `generateBootableAdfFallback(media)` producing a standard 901,120-byte bootable Amiga ADF image with valid checksum and boot code.
    - `provider(media)` returns registered bytes if present, or dynamically synthesizes and registers fallback boot bytes if missing, completely preventing "No bytes registered" exceptions.
  - `packages/web/src/App.tsx`:
    - Set default `runtimeKind` to `"wasm"` across state, refs, and storage.
    - Pre-register valid boot ADF bytes for `DEMO_PROFILE`, `SCENE_PROFILE`, `GURU_PROFILE`, and `FREEWARE_CLASSICS`.
    - Ensure `onLaunchClassic`, `onFile`, and `mountFromLibrary` always bind the exact SHA-256 present in `profile.media`.
  - Unit tests verifying seamless loading of all demos and classic profiles in WASM mode without throwing.

---

## Batch 2: Slide-Over Layover Drawer & Section Reordering
- **Tasks:**
  - `M10-SIDEBAR-001`: Slide-Over Layover Drawer & Centered Monitor Viewport
  - `M10-SECTIONS-001`: Re-ordered Lower Content Sections
- **Scope:**
  - `packages/web/src/components/SidebarDrawer.tsx`:
    - Create a modern, animated slide-over drawer popping out from the left over the page.
    - Arranges Dropzone, Quick Demos, Virtual Drives (`DF0:`–`DF3:`), Disk Swapper, Game Profile Details, and Export tools in a 2-column responsive layout (`grid grid-cols-1 md:grid-cols-2 gap-4`).
    - Includes close button (`✕`), backdrop blur, click-outside dismissal, and hotkey support (`Escape`).
  - `packages/web/src/App.tsx`:
    - Remove fixed left `<aside className="w-80">` from the main flow.
    - Center the 1084S monitor in `max-w-7xl mx-auto flex flex-col items-center w-full`.
    - Reorder lower sections:
      1. `<section aria-label="Game library">` (Retro Game Library)
      2. `<section aria-label="Tracker player">` (ProTracker Player)
      3. `<section aria-label="Chain of title">` (Chain of Title)

---

## Batch 3: Ambient Layovers (CRT, Header Runtime, Guru Error & Draggable Remote)
- **Tasks:**
  - `M10-LAYOVERS-001`: Contextual Ambient Layovers (CRT, Header Runtime, Guru Error & Draggable Remote)
- **Scope:**
  - `packages/web/src/components/GuruMeditationOverlay.tsx`:
    - Authentic Amiga Guru Meditation error layover box centered in the viewport with blinking red double border and failure code.
    - Dismissible via click or button, minimizing to a discreet red alert pill in the bottom-left corner (`fixed bottom-6 left-6`).
    - Clicking the minimized pill restores the full error box.
  - `packages/web/src/components/FloatingRemoteControl.tsx`:
    - Sleek, compact floating D-Pad (`▲`, `▼`, `◄`, `►`) and fire buttons (`1`, `2`) overlay.
    - Draggable anywhere across the screen.
    - Minimize button (`─`) that docks the remote control into a compact icon button in the bottom-right corner, immediately to the left of the Reset button (`fixed bottom-6 right-24`).
  - `packages/web/src/components/Header.tsx` & `Viewport.tsx`:
    - Move runtime mode switcher into the Header navigation (`⚡ WASM Core ▾`) with downward popover menu.
    - Add CRT icon button (`📺`) in the top-right corner of the monitor bezel, opening a downward-left layover panel with CRT controls and presets.
  - Integration tests in `packages/web/src/__tests__/m10-layovers.test.tsx`.
