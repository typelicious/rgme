# RGME Emulator Engines & Architecture (ADR-004 / Milestone 12)

RGME (Retro Game Modernization Engine) isolates retro execution engines behind the unified `RuntimeAdapter` interface.

## 1. Supported Amiga Execution Runtimes

| Runtime ID | Name | Type | Upstream Origin | Licence | Purpose |
|---|---|---|---|---|---|
| `vamiga` (Default) | **vAmiga** | Real Hardware Emulator | `https://vamigaweb.github.io/` | GPL-3.0 | Cycle-exact Amiga 500/1200 OCS/ECS/AGA execution in WebAssembly. Driven via the documented `postMessage` protocol. Injects user Kickstart (BYOR) or falls back to built-in AROS. |
| `puae` | **PUAE (EmulatorJS)** | Real Hardware Emulator | `https://cdn.emulatorjs.org/stable/data/` | GPL-2.0+ (core) / GPL-3.0 (frontend) | Full Amiga OCS/ECS execution using the libretro PUAE WebAssembly core. Runs in an isolated `srcdoc` iframe. |
| `preview` | **Placeholder Preview** | Canvas Mock | Built-in | MIT / Apache-2.0 | Hand-drawn script animations for UI testing when offline or running without network access. **Not an emulator.** |
| `wasm` | **WASM Hardware Core** | Reference Testbed | Built-in | Apache-2.0 | RGME reference cycle/timing testbed with Boing breakout physics and Paula audio synthesis. |
| `m68k` | **68000 Boot Interpreter** | Partial CPU Test | Built-in | Apache-2.0 | Step-by-step diagnostic 68000 bootblock verification. |
| `mock` | **Boing Arcade** | Mock | Built-in | Apache-2.0 | Standalone non-emulated arcade game for testing monitors, CRT shaders, and audio visualizers. |

---

## 2. Dynamic Upstream Loading & Licensing
- **No Vendored GPL Binaries:** RGME does not distribute or vendor third-party emulator binaries in this repository.
- **Runtime Sandboxing:** Real emulator cores run inside designated iframe containers layered on top of the 1084S monitor.
- **Configurable Origins:** Both `baseUrl` (for vAmigaWeb) and `dataUrl` (for EmulatorJS) can be pointed to a local, self-hosted web server if completely air-gapped or offline play is required.

---

## 3. Firmware & Kickstart ROM (BYOR)
- User-provided Commodore Kickstart ROMs (`kick34005.A500`, `kick40063.A600`, etc.) stored in the browser's IndexedDB / LocalStorage are injected:
  - Into `vAmiga` directly via the `{ cmd: "load", kickstart_rom: Uint8Array }` message.
  - Into `puae` via `EJS_biosUrl` blob link.
- When no custom ROM is registered, both cores default to the clean, open-source AROS Amiga 68k replacement ROM.
