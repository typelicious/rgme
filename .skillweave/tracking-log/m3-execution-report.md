# RGME Milestone 3 — Execution Report

Gate: `pnpm test && pnpm build` — pass (core 118, cli 19, web 73 = 210 tests; typecheck clean). Browser smoke test in Chromium (C64, Mega Drive, scene demo, Mock→WASM switch): no console errors.

| Task | Result |
|---|---|
| WASM-001 | `WasmAmigaAdapter` host: core contract, loaders, PAL timing model, media mount, snapshots; reference core compiled from WAT; Mock/WASM switch in the UI |
| MULTI-001 | `D64Parser`, `parseGenesisRom`, `C64RuntimeAdapter`, `GenesisRuntimeAdapter` (SID-/FM-style synthesis), fixtures `rgme-c64-demo.d64`, `rgme-md-demo.md` (CC0, class A) |
| RIGHTS-002 | Chain-of-Title Explorer (47 entries); documented links are solid, label-only links dashed, missing routes shown as a single "unverified" node |
| EXPORT-001 | `rgme export` + web `ExportPanel`; gate = policy `allow` for binary_redistribution AND browser_hosting, else BYOG package (no game bytes, tested) |

## Honest limitations
- **No instruction-level emulation anywhere.** The WASM reference core, C64 and Mega Drive runtimes do not execute 68000/6502/Z80 code. A real emulator core (e.g. PUAE built to WASM) must implement the documented core contract and be supplied via `coreUrl`; without a core the WASM adapter fails loudly (`WasmCoreUnavailableError`).
- PAL cycles per frame is 312 x 227 x 2 = 141,648 (derived), not the 142,248 first quoted.
- Only DF0: is mounted by the WASM host unless the core exports `rgme_insert_media`; the reference core has no audio.
- The exported player runs the mock scene, not the embedded disk's code.
- Chain data (`lib/chain/data.json`) and the CLI matrix are snapshots of concept files.
- Synth audio (chiptune, SID-, FM-style, drive sounds) was verified with fake AudioContexts only, not by ear.
