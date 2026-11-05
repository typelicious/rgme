# Product Requirements Document (PRD)
## Retro Game Modernization Engine (RGME) — Milestone 5 Specification

**Version:** 0.5.0  
**Status:** In Execution (Milestone 5 — Amiga Engine Completeness, Real IPF/MOD, M3U In-Memory Swapper & Impeccable UX)  
**Parent Strategy:** `concept/RGME-Overall-Concept-v0.2.md` & `.skillweave/design/impeccable-design-spec.md`  
**Methodology:** `assay` (empirical test-driven validation)  
**Autonomy Policy:** `unicorn` (maximum autonomy, proactive delivery)  
**Session Schedule:** `batch`  
**Parallelism:** `maximal`  

---

## 1. Executive Summary & Vision

Milestone 5 brings RGME to operational maturity by completing the in-browser Amiga execution pipeline, adding full ProTracker playback accuracy, universal multi-disk management, freeware multi-disk classics, and an Impeccable / UI-UX-Pro-Max usability overhaul.

### Golden Laws of RGME:
1. **Original content is immutable:** Identity, configuration, rights evidence, presentation, and saves exist purely as external, declarative layers.
2. **Unknown rights never become permission by inference:** Clear provenance and classification (Class A/B/C/D) are strictly enforced.
3. **No AI Slop in UX:** Clean Amiga/Commodore colorway, monospace telemetry, zero cumulative layout shifts (CLS = 0), and instant tactile feedback (< 50ms).

---

## 2. Milestone 5 Feature Objectives

### Lane 1: Complete 68000 CPU Opcode Set & Amiga Exec/DOS Trap Stubs (`CPU-EXT-001`)
- **Missing Opcodes:** `CHK`, `TRAP #n`, `MOVEP`, `BCD` (`ABCD`, `SBCD`, `NBCD`), `ADDX`, `SUBX`, `NEGX`, `CMPM`, `ROXL`, `ROXR`.
- **Amiga Exec/DOS Vector Stubs:** Trapping at `ExecBase` (`0x000004`):
  - `_LVOOpenLibrary` (-408 / -0x198)
  - `_LVOCloseLibrary` (-414 / -0x19E)
  - `_LVOAllocMem` (-198 / -0xC6)
  - `_LVOFreeMem` (-210 / -0xD2)
  - `_LVODoIO` (-456 / -0x1C8)
  - `_LVOPermit` (-138 / -0x8A)
  - `_LVOForbid` (-132 / -0x84)
  - `_LVOFindTask` (-294 / -0x126)
- **Outcome:** The scene intro bootblock banner continues past the `$4D45` (`CHK`) opcode without halting on an unhandled instruction exception.

### Lane 2: Extended ProTracker Effects & Live Audio Visualizer Data (`MOD-EXT-001`)
- **ProTracker Effects:**
  - Effect 3: Tone Portamento (slide towards target period)
  - Effect 4: Vibrato (sine pitch modulation)
  - Effect 5: Tone Porta + Volume Slide
  - Effect 6: Vibrato + Volume Slide
  - Effect 7: Tremolo
  - Effect 9: Sample Offset
  - E-Effects: E1/E2 (Fine Porta), E6 (Pattern Loop), E9 (Retrigger), EA/EB (Fine Volslide), EC (Note Cut), ED (Note Delay)
- **Paula Hardware Frequency:** Standardized formula `PAL_CLOCK / period` (where `PAL_CLOCK = 3546895 Hz`).
- **Telemetry & Visualizer Data:** `ModPlayer` exposes `getChannelLevels(): [number, number, number, number]` and audio waveform data for live UI VU-meters and oscilloscope.

### Lane 3: Universal Dropzone for M3U/ZIP & Live In-Memory Disk Swap (`M3U-SWAP-001`)
- **Universal Dropzone:** Accepts `.m3u` playlists and `.zip` archives directly via drag-and-drop.
- **Live In-Memory Swap:** Swapping a disk in DF0: updates the active byte buffer in `FloppyController`, resets cylinder tracking, plays mechanical seek sound, and notifies the active `RuntimeAdapter`.

### Lane 4: Freeware Classics Multi-Disk Showcase & Launchers (`FREEWARE-CLASSICS-001`)
- Curated multi-disk catalog:
  - *Flight of the Amazon Queen* (11 disks)
  - *Beneath a Steel Sky* (15 disks)
  - *Lure of the Temptress* (4 disks)
- 1-click launcher in `LibraryShelf`: loads Disk 1 into `DF0:`, queues the complete disk set into `DiskSwapper`, and displays Class C Authorized Freeware rights badge.

### Lane 5: Impeccable & UI-UX-Pro-Max Usability and Polish Overhaul (`UX-PRO-MAX-001`)
- **Command Palette:** `Cmd+K` or `/` quick fuzzy search for games, runtimes, floppy actions, and shader presets.
- **Keyboard Shortcuts Modal:** `?` hotkey reference dialog.
- **Audio Visualizer:** 4-Channel Paula VU-meters and real-time waveform oscilloscope.
- **Zero Layout Shift (CLS = 0) & Tactile Audio:** Strict fixed layout geometry and drive sound toggle.

---

## 3. Verification & Gate Policy
- Build gate: `pnpm test && pnpm build` must be 100% green.
- All unit and integration tests across core, cli, and web must pass.
- Git author: `typelicious <typelicious@gmail.com>`.
