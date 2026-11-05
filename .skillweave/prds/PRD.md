# Product Requirements Document (PRD) v0.9.0
## Retro Game Modernization Engine (RGME) — Milestone 9: WebAssembly Amiga Hardware Core, Kickstart ROM Management & Direct Disk Execution

- **Version:** 0.9.0
- **Status:** In Progress
- **Framework:** SkillWeave Blueprint + SkillWeave Design + SkillWeave Discovery
- **Author:** `typelicious <typelicious@gmail.com>`

---

## 1. Executive Summary & Problem Statements

Milestone 9 brings true native Amiga software execution into RGME:
1. **The Execution Gap:**
   - Previous milestones provided floppy drive simulation (DF0–DF3), disk streaming from Archive.org, metadata extraction, and the interactive Boing Brick Buster arcade game.
   - However, when a user loaded genuine commercial Amiga floppy disks (ADF/IPF/ZIP), the engine did not execute the 68000 binary machine code with full custom chip emulation.
2. **WebAssembly Amiga Hardware Core Integration:**
   - RGME requires a production-grade WebAssembly Amiga Core integrated into `WasmAmigaAdapter` adhering strictly to the RGME WASM Core Contract:
     - 68000 CPU instructions & cycle accounting
     - OCS/ECS Custom Chips (Copper lists, bitplane DMA blitting, display window clipping)
     - Paula 4-channel audio DMA generation streamed to Web Audio
     - Floppy disk track reading and sector decoding directly from mounted memory buffers
3. **Kickstart ROM Management & Zero-Friction Out-of-the-Box Play:**
   - Out of the box, RGME must ship with an open-source, legally unencumbered Kickstart ROM replacement (AROS 68k compatibility layer) so users can immediately boot and play without hunting for copyrighted ROM files.
   - For 100% commercial compatibility, RGME must offer a "BYOR" (Bring Your Own ROM) loader allowing users to drop or select their own Kickstart 1.3 / 2.0 / 3.1 ROM files, with SHA-256 validation and local IndexedDB persistence.
4. **Unified Control & Diagnostics:**
   - Real-time core telemetry HUD (FPS, CPU Cycles, Video Line, Audio DMA state).
   - Instant Master Reset via the floating `↺ Reset` layover button.

---

## 2. Milestone 9 Task Breakdown

### Task 1: `M9-WASM-001` — Production WebAssembly Amiga Hardware Core Engine
- **Goal:** Implement and integrate a fully featured WebAssembly Amiga hardware core adhering to the RGME WASM Core Contract.
- **Acceptance Criteria:**
  - Contract implementation: `rgme_init`, `rgme_alloc`, `rgme_load_media`, `rgme_run_frame`, `rgme_framebuffer_ptr`, `rgme_framebuffer_width`, `rgme_framebuffer_height`, `rgme_set_input`, `rgme_reset`, `rgme_cycle_counter`, `rgme_audio_ptr`, `rgme_audio_samples`.
  - Full 320x256 PAL frame generation with genuine bitplane color rendering and Copper raster synchronization.
  - Floppy track & sector reader decoding standard Amiga MFM / ADF sectors into Chip RAM.
  - Full Paula 4-channel audio PCM buffer generation exported to the host.

### Task 2: `M9-KICKSTART-001` — Kickstart ROM Manager & Open AROS Compatibility Layer
- **Goal:** Provide seamless Kickstart ROM handling with built-in open-source AROS fallback and BYOR support.
- **Acceptance Criteria:**
  - `KickstartRomStore` managing ROM bytes with IndexedDB persistence and SHA-256 identification.
  - Built-in open-source AROS 68k minimal Kickstart ROM allowing games and bootblocks to execute without third-party files.
  - Support for drag-and-drop / file picker for Kickstart 1.3 (`0xcd854...`), 2.04, and 3.1 ROM files.
  - Seamless injection of the active Kickstart ROM into the WASM Core address space (`0xf80000` - `0xffffff`).

### Task 3: `M9-AUDIO-001` — Paula DMA Web Audio Streaming & Dynamic Mixing
- **Goal:** Bridge WASM core Paula audio output into the browser's Web Audio graph.
- **Acceptance Criteria:**
  - `WasmAudioStreamer` capturing PCM samples from `rgme_audio_ptr()` and streaming via `AudioWorklet` / `ScriptProcessorNode` / dynamic buffer queue.
  - Clean volume control, zero buzzing, no DC offset, automatic pause when inactive, and immediate mute on Reset.

### Task 4: `M9-UI-001` — Core Telemetry HUD & ROM Settings Modal
- **Goal:** Surface hardware core status, active ROM, and diagnostic controls in the RGME web interface.
- **Acceptance Criteria:**
  - Hardware Core status bar showing active core ("WASM Native", "AROS 68k", "PAL 50Hz", Cycle count).
  - ROM configuration modal accessible from the header and runtime switch.
  - 1-click execution when selecting a game from Library or Archive.org: automatically switches to WASM core if enabled and begins emulation.
