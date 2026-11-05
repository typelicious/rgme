# SkillWeave Prompt Sequence: Milestone 9 (M9)

- **Target:** Mixed (Core WASM Engine, Kickstart ROM Management, Paula Audio Streamer, UI Telemetry & ROM Modal)
- **Methodology:** Assay
- **Autonomy Policy:** Unicorn
- **Gate:** `pnpm test && pnpm build` 100% Green
- **Author:** `typelicious <typelicious@gmail.com>`

---

## Batch 1: Core Architecture & WASM Emulation Engine
- **Tasks:**
  - `M9-WASM-001`: Production-Grade WebAssembly Amiga Hardware Core & Direct Execution
  - `M9-KICKSTART-001`: Kickstart ROM Manager with Open AROS Compatibility & BYOR Injection
- **Scope:**
  - `packages/core/src/wasm/amiga-core.ts`:
    - Full WebAssembly Core implementation conforming to the RGME WASM Core Contract (`WasmCoreExports`).
    - Integrated Motorola 68000 CPU interpreter and custom chip logic (Copper, Denise bitplanes, Paula audio DMA, Blitter lines/fills).
    - Amiga memory map: Chip RAM ($000000-$07FFFF or $1FFFFF), Custom Registers ($DFF000-$DFFFFF), CIA-A/B ($BFE001/$BFD000), Expansion RAM ($C00000), and Kickstart ROM ($F80000-$FFFFFF).
    - Native 320x256 PAL frame buffer generation directly in RGBA32 format for canvas blitting.
    - Floppy disk controller supporting ADF/raw floppy sector reads into memory.
  - `packages/core/src/rom/kickstart-rom-store.ts`:
    - Open-source minimal AROS 68k Kickstart ROM module (built-in, 0 copyright risk).
    - Store for user-supplied ROMs (Kickstart 1.2, 1.3, 2.04, 3.1) with SHA-256 fingerprinting and IndexedDB persistence.
    - ROM validation and automatic patching/relocation if necessary.
  - `packages/core/src/__tests__/m9-wasm-core.test.ts`:
    - Comprehensive unit tests verifying contract compliance, ROM injection, frame rendering, CPU cycle accounting, and audio buffer export.

---

## Batch 2: Paula Audio Streaming & UI Integration
- **Tasks:**
  - `M9-AUDIO-001`: Paula DMA Web Audio Streaming & Dynamic Mixing
  - `M9-UI-001`: Core Telemetry HUD, ROM Settings Modal & 1-Click Game Execution
- **Scope:**
  - `packages/core/src/wasm/wasm-audio.ts`:
    - Web Audio node streamer reading Paula PCM samples from the WASM core and scheduling smooth audio playback with anti-click ramping and zero underrun buzzing.
  - `packages/web/src/components/KickstartModal.tsx`:
    - Modal for inspecting, selecting, and dropping custom Kickstart ROM files.
    - Displays active ROM details (e.g. AROS 68k built-in vs Kickstart 1.3 Commodore), SHA-256 hash, and compatibility status.
  - `packages/web/src/components/CoreTelemetryHUD.tsx`:
    - Compact diagnostic HUD below or next to the monitor showing: Core mode, FPS, Frame cycle, CPU state, Audio DMA activity.
  - `packages/web/src/App.tsx` & `runtime-factory.ts`:
    - Wire the production WASM Amiga core into the `wasm` runtime kind.
    - Automatically load Kickstart ROM upon WASM initialization.
    - Connect the master Reset button to reset the core, clear audio, and return to clean initial state.
  - `packages/web/src/__tests__/m9-ui.test.tsx`:
    - Verification tests for runtime switching to WASM core, ROM modal interactions, and execution start.
