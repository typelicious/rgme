# Execution Sequence: Milestone 14 — Copperline (Rust/WASM), Bootblock Repair & Authentic Scene Demos

## Phase 1: Core Engine & Bootblock Repair
- [x] Step 1.1: Fix `generateBootableAdfFallback` in `packages/web/src/lib/runtime-factory.ts` so title text is written at offset 64, keeping 68000 opcodes intact at offsets 12..41.
- [x] Step 1.2: Upgrade `concept/fixtures/rgme-scene-intro.adf` with executable bootblock code, Paula audio tone initialization, and verified AmigaDOS filesystem blocks.
- [x] Step 1.3: Update `packages/core/src/emulator/emulatorjs-core-adapter.ts` with local blob URL creation and Emscripten FS injection so PUAE mounts ADF directly into DF0.

## Phase 2: Copperline Integration (Option 3)
- [x] Step 2.1: Implement `CopperlineWebAdapter` in `packages/core/src/emulator/copperline-adapter.ts` implementing `RuntimeAdapter` with cycle-exact OCS/ECS/AGA capabilities, canvas blit (`present_ptr`), Paula audio (`take_audio`), and floppy insertion (`insert_floppy`).
- [x] Step 2.2: Export `CopperlineWebAdapter` from `packages/core/src/index.ts`.
- [x] Step 2.3: Register `"copperline"` in `RuntimeKind`, `createRuntime`, and `Header.tsx` runtime picker in `@rgme/web`.

## Phase 3: Testing & Verification
- [x] Step 3.1: Add unit tests in `packages/core/src/__tests__/m14-copperline-bootblock.test.ts` validating fallback bootblock opcodes, checksum calculation, and Copperline adapter lifecycle.
- [x] Step 3.2: Verify full test suite `pnpm -r test` and build `pnpm -r build`.

## Phase 4: Release & Launch
- [x] Step 4.1: Update release documentation and launch manifests.
- [x] Step 4.2: Git commit and push with authorship `typelicious <typelicious@gmail.com>`.
