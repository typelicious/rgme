# RGME Emulator Engines & Architecture (ADR-004 / Milestone 13)

RGME (Retro Game Modernization Engine) isolates retro execution engines behind the unified `RuntimeAdapter` interface.

## 1. Supported Amiga Execution Runtimes

| Runtime ID | Name | Type | Primary Endpoint | Fallback Origin | Licence | Purpose |
|---|---|---|---|---|---|---|
| `vamiga` (Default) | **vAmiga** | Real Hardware Emulator | `/cores/vamiga/index.html` (Local Pinned) | `https://vamigaweb.github.io/` | GPL-3.0 | Cycle-exact Amiga 500/1200 OCS/ECS/AGA execution in WebAssembly. Driven via the documented `postMessage` protocol. Injects user Kickstart (BYOR) or falls back to built-in AROS. |
| `puae` | **PUAE (EmulatorJS)** | Real Hardware Emulator | `/cores/emulatorjs/data/` (Local Pinned) | `https://cdn.emulatorjs.org/stable/data/` | GPL-2.0+ (core) / GPL-3.0 (frontend) | Full Amiga OCS/ECS execution using the libretro PUAE WebAssembly core. Runs in an isolated Same-Origin `srcdoc` iframe. |
| `preview` | **Placeholder Preview** | Canvas Mock | Built-in | Built-in | GPL-3.0-or-later | Hand-drawn script animations for UI testing when offline without WASM runtime. **Not an emulator.** |
| `wasm` | **WASM Hardware Core** | Reference Testbed | Built-in | Built-in | GPL-3.0-or-later | RGME reference cycle/timing testbed with Boing breakout physics and Paula audio synthesis. |
| `m68k` | **68000 Boot Interpreter** | Partial CPU Test | Built-in | Built-in | GPL-3.0-or-later | Step-by-step diagnostic 68000 bootblock verification. |
| `mock` | **Boing Arcade** | Mock | Built-in | Built-in | GPL-3.0-or-later | Standalone non-emulated arcade game for testing monitors, CRT shaders, and audio visualizers. |

---

## 2. Pinned Cores & Licensing Alignment (Milestone 13)
- **License Harmonization:** RGME is licensed under **GNU General Public License v3.0 (GPL-3.0-or-later)**. This matches vAmiga (GPL-3.0) and PUAE (GPL-2.0+ / GPL-3.0), permitting complete binary vendoring, pinning, and self-hosted redistribution without legal conflict.
- **Local Pinned Hosting:** All core assets are hosted under `packages/web/public/cores/` and served Same-Origin (`/cores/...`).
- **Offline Reliability:** RGME boots without an active internet connection. Third-party CDN downtime or cross-origin modal popups are completely eliminated.
- **Configurable Fallback:** Both `baseUrl` (for vAmiga) and `dataUrl` (for EmulatorJS) remain configurable to permit targeting custom local servers or upstream CDN endpoints when desired.

---

## 3. Firmware & Kickstart ROM (BYOR)
- User-provided Commodore Kickstart ROMs (`kick34005.A500`, `kick40063.A600`, etc.) stored in the browser's IndexedDB / LocalStorage are injected:
  - Into `vAmiga` directly via the `{ cmd: "load", kickstart_rom: Uint8Array }` message.
  - Into `puae` via `EJS_biosUrl` blob link and Emscripten `Module.FS` injection.
- When no custom ROM is registered, both cores default to the clean, open-source AROS Amiga 68k replacement ROM.
