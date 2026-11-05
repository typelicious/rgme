# SkillWeave Execution Engine — Assay / Unicorn Execution Guide

This document is the execution specification for running the **Retro Game Modernization Engine (RGME)** using an autonomous AI coding agent in **Assay Methodology** with **Unicorn Autonomy Policy** (Maximal Parallelism).

---

## 1. Operating Parameters & Posture

- **Current Milestone:** **Milestone 4 (IPF Decoder, Real 68000 Execution Core, ProTracker Engine & Monitor Bezel)**
- **Methodology:** `assay` (Empirical, test-driven validation; rapid parallel execution)
- **Autonomy Policy:** `unicorn` (Maximum autonomy, aggressive forward momentum, zero unnecessary stops)
- **Parallelism:** `maximal` (Execute all parallel lanes concurrently)
- **Target Budget:** ~$6+ Claude Cloud remaining

---

## 2. Milestone 4 Implementation Scope

Execute the following 5 parallel lanes concurrently:

1. **`IPF-001` (Pure TypeScript IPF / CAPS Floppy Decoder in `@rgme/core`):**
   - Parse CAPS, FDI, TRCK, and DATA chunks from `.ipf` container files.
   - Reconstruct MFM tracks and extract standard 512-byte Amiga sectors.
   - Enable mounting `.ipf` disk images directly into virtual floppy drives (`DF0:`–`DF3:`).
   - Tests in `packages/core/src/__tests__/ipf.test.ts`.

2. **`M68K-001` (In-Browser Motorola 68000 CPU Core in `@rgme/core`):**
   - Implement `M68kCpu` with 8 Data (D0–D7) and 8 Address (A0–A7) registers, PC, and SR flags (X, N, Z, V, C).
   - Core opcodes: `MOVE`, `MOVEQ`, `LEA`, `PEA`, `ADD`, `SUB`, `AND`, `OR`, `EOR`, `TST`, `CMP`, `BRA`, `BSR`, `Bcc`, `JMP`, `JSR`, `RTS`, `NOP`.
   - Real execution: Executes Amiga bootblock code from disk sector 0, writing to Custom Chip registers (`0xdff000`).
   - Tests in `packages/core/src/__tests__/m68k.test.ts`.

3. **`MOD-001` (Amiga ProTracker / SoundTracker Audio Engine):**
   - Parse standard 4-channel ProTracker format (`M.K.` signature, 31 sample headers, song sequence, pattern data).
   - Paula period-to-frequency math (`PAL_CLOCK = 3546895 Hz`) with hardware stereo panning (Ch 0 & 3 Left, Ch 1 & 2 Right).
   - Effects: 0 (Arpeggio), 1/2 (Portamento), C (Set Volume), D (Pattern Break), F (Set Speed).
   - Web Audio player in `@rgme/web` with playback controls.
   - Tests in `packages/core/src/__tests__/mod-player.test.ts`.

4. **`M3U-001` (Multi-Disk .m3u Playlist Engine & In-Game Floppy Swapper):**
   - Parse `.m3u` text files and group multi-disk sets (matching the IPF collection structure).
   - UI dropdown in Floppy HUD showing all disks in the active set with 1-click or hotkey swap into DF0:.
   - Tests in `packages/web/src/__tests__/m3u.test.tsx`.

5. **`BEZEL-001` (Commodore 1084S Retro Monitor Bezel Experience):**
   - Authentic Commodore 1084S monitor bezel framing the WebGL CRT viewport.
   - Clickable power switch (with CRT phosphor collapse shutdown effect) and glowing power LED.
   - Degauss button triggering screen shake and electromagnetic color flash.
   - Fullscreen toggle maintaining 4:3 PAL geometry.
   - Tests in `packages/web/src/__tests__/bezel.test.tsx`.

---

## 3. Verification & Gate Checks
Run:
```bash
pnpm test && pnpm build
```
- Ensure 100% test pass rate across all packages.
- Commit all changes with author `typelicious <typelicious@gmail.com>`.
- Push to GitHub: `git push origin claude/admiring-gauss-f991hx`.
