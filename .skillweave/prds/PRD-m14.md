# PRD: Milestone 14 — Copperline (Rust/WASM) Option 3, Bootblock Repair & Authentic Scene Demos

## Executive Summary
This milestone addresses three critical real-hardware emulation issues in RGME:
1. **Bootblock Memory Corruption Fix in Fallback ADF Generator (`generateBootableAdfFallback`)**: Fixes the opcode overwrite at offset 32 where disk titles were written directly over 68000 machine instructions, which triggered Guru Meditation Software Failure `#80000004` (Illegal Instruction) when launching default freeware classics like *Flight of the Amazon Queen*.
2. **Authentic Amiga Scene Demo (`concept/fixtures/rgme-scene-intro.adf`)**: Converts the synthetic placeholder intro into an authentic Amiga 500 bootable demonstration featuring animated copper rainbow gradients, Paula 4-channel audio register playback/tone generation, and a fully valid AmigaDOS root filesystem recognized by Kickstart 1.2, 1.3, 2.0, 3.1, and AROS.
3. **PUAE Auto-Boot / DF0 Mount Fix (`EmulatorJsCoreAdapter`)**: Fixes RetroArch PUAE floppy detection when using data/blob URLs in srcdoc by guaranteeing local blob URLs with `.adf` suffixes and direct Emscripten FS injection so PUAE mounts the floppy into `DF0:` without stalling on the Kickstart 3.1 purple insert-diskette animation.
4. **Copperline (Rust/WASM) Integration as 3rd Option**: Introduces `CopperlineWebAdapter` in `@rgme/core` and exposes Copperline in `@rgme/web` runtime picker, leveraging Copperline's cycle-exact Rust OCS/ECS/AGA emulation, direct canvas blitting (`present_ptr`), native Paula audio streaming (`take_audio`), and built-in IPF/ADF/DMS floppy support.

## Key Deliverables
- `packages/web/src/lib/runtime-factory.ts`: Relocate title metadata to offset 64 in `generateBootableAdfFallback`, preserving executable code at 12..41 and recalculating valid Amiga 32-bit checksum.
- `packages/core/src/emulator/embedded.ts`: Ensure bootblock patching protects against corrupt opcodes and properly boots standard AmigaDOS disks.
- `packages/core/src/emulator/emulatorjs-core-adapter.ts`: Mount `.adf` floppy directly into Emscripten FS and pass named blob URL to ensure PUAE loads into DF0 automatically.
- `packages/core/src/emulator/copperline-adapter.ts`: Implement `CopperlineWebAdapter` adhering to `RuntimeAdapter` interface.
- `packages/core/src/index.ts`: Export Copperline adapter.
- `packages/web/src/components/Header.tsx` & `runtime-factory.ts`: Add `copperline` to runtime picker with label `Copperline (Rust/WASM)`.
- `concept/fixtures/rgme-scene-intro.adf`: Update demo floppy with valid bootblock opcodes, Paula audio synthesis, and valid AmigaDOS blocks.
- Unit and integration tests covering Copperline, repaired fallback ADF generation, and real bootblock execution.

## Verification Criteria
- 100% test pass rate across all workspace packages (`@rgme/core`, `@rgme/web`, `@rgme/cli`).
- Clicking "Flight of the Amazon Queen" in vAmiga or PUAE boots cleanly with zero Guru Meditations.
- Clicking "Mount in DF0 & Play" on RGME Scene Intro boots immediately and displays animated copper bars with Paula audio.
- Copperline is selectable and operable as the 3rd real emulator option.
