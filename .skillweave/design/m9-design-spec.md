# Milestone 9 Design Specification: WebAssembly Amiga Hardware Core, Kickstart ROM Management & Direct Disk Execution

## 1. Executive Summary & Design Goals
Milestone 9 transitions RGME from a preservation showcase host into an active retro execution platform. By powering the `WasmAmigaAdapter` with a full-featured, contract-compliant WebAssembly Amiga Core, audio DMA synthesis, and an embedded/open Kickstart ROM environment, users can mount real floppy disks (ADF/IPF/ZIP from Archive.org or local files) and run genuine Amiga software directly inside the 1084S monitor.

## 2. Design-Thinking Lens (SkillWeave Design Principles)
1. **Authenticity Without Friction**:
   - Out-of-the-box zero-setup execution: Pre-configured with an open-source AROS-compatible Kickstart environment so users don't need to hunt for copyrighted ROM files to get started.
   - BYOR (Bring Your Own ROM) option: Clean UI to drop or configure genuine Kickstart 1.3 / 2.0 / 3.1 ROMs for 100% commercial compatibility.
2. **Value ≥ Noise**:
   - The monitor HUD displays real-time execution telemetry (Cycles, FPS, Active Scanline, Paula Audio DMA activity) cleanly tucked into subtle status indicators without cluttering the vintage bezel.
3. **Seamless Runtime Switching**:
   - Switching between "Mock / Arcade", "WASM core", and "68000 interpreter" preserves the current mounted disk across the same canvas without reloads.
4. **Immediate Feedback & Audio Safety**:
   - Real-time Paula 4-channel audio synthesis through Web Audio API with safety guards against buffer underruns, DC offsets, and buzzing frequencies.
5. **Universal Reset & Panic Recovery**:
   - The master floating `↺ Reset` button resets CPU registers, restores custom chips, unmounts or recalibrates drives, and clears framebuffers within < 50ms.

## 3. Design Tokens & UI Specs
- **Runtime Selector & Core HUD**:
  - `wasm-active`: Glow border `rgba(16, 185, 129, 0.4)` (Emerald green indicating native WASM execution).
  - Telemetry badge: Monospace font `text-[10px]`, background `#111827`, border `#1f2937`, text `#10b981`.
- **Kickstart ROM Status Pill**:
  - Open ROM (Built-in AROS): `#064e3b` badge with `AROS 68k (Built-in)` label.
  - Custom ROM: `#1e3a8a` badge with `Kickstart 1.3 (Custom)` label.
  - Drop Target: Subtle dashed area in the ROM settings modal with instant SHA-256 fingerprinting.
- **Display Pacing**:
  - Exact PAL 50.00 Hz video refresh lock with 320x256 active frame buffer blitting directly to the CRT canvas.
