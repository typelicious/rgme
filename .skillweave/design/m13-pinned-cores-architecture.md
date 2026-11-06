# Design Document: Milestone 13 — Pinned Local Amiga Emulators & License Harmonization

- **Author:** `typelicious <typelicious@gmail.com>`
- **Date:** 2026-11-06
- **Status:** Approved / In Implementation
- **Milestone:** M13

## 1. Problem & Context
In Milestone 12, RGME integrated real Amiga emulation via two upstream providers:
1. `vAmigaWeb` (`https://vamigaweb.github.io/`)
2. `EmulatorJS` with PUAE core (`https://cdn.emulatorjs.org/stable/data/`)

While this provided genuine 68000/OCS/ECS hardware emulation, relying on external remote CDNs introduced several severe problems:
1. **Third-Party Modal Alerts:** Cross-origin iframes trigger untamable browser alerts (e.g., `Hinweis einer in vamigaweb.github.io eingebetteten Seite`), blocking user interaction.
2. **Offline Fragility:** Any network hiccup, air-gapped run, or CDN downtime prevents the emulator from booting.
3. **Upstream Drift:** Remote scripts change unannounced, risking breakage.
4. **Cross-Origin Restrictions:** Sandboxed remote iframes restrict direct DOM, AudioContext, and SharedArrayBuffer memory access.

The initial hesitation to vendor emulator binaries locally was license heterogeneity (MIT vs. GPL-3.0).

## 2. Licensing Solution: Transition to GNU GPL-3.0
- **Copyright Ownership:** André Lange (`typelicious`) is the sole author and rights holder of RGME.
- **Relicensing:** RGME is relicensed under the **GNU General Public License v3.0 (GPL-3.0-or-later)**.
- **Harmony:**
  - `vAmiga` / `vAmigaWeb` is licensed under **GPL-3.0**.
  - `PUAE` (libretro core) is licensed under **GPL-2.0-or-later** (GPL-3.0 compatible).
  - `EmulatorJS` frontend/loader is open source under **GPL-3.0**.
- **Result:** Complete legal alignment. RGME can vendor, bundle, pin, and distribute the local WASM runtimes, loaders, and adapter glue code without licensing conflict.
- **Preserved Exceptions:**
  - **Third-Party ROMs / Content:** Proprietary Amiga Kickstart ROMs and commercial game disks (ADF/IPF/ZIP) remain strictly BYOR (Bring Your Own ROM) and third-party property; RGME does not claim rights.
  - **Synthetic Assets:** CC0 1.0 Universal dedication for RGME demonstration fixtures (`rgme-scene-intro.adf`).

## 3. Pinned Architecture & Directory Layout

```
packages/web/public/cores/
├── vamiga/
│   ├── index.html         # Local vAmiga runner implementing the postMessage protocol
│   ├── vamiga.wasm        # Pinned vAmiga WebAssembly cycle-exact engine
│   └── vamiga.js          # Glue & runtime bridge
└── emulatorjs/
    ├── data/
    │   ├── loader.js      # Local EmulatorJS loader
    │   ├── emulator.min.js# Local emulator controller
    │   └── cores/
    │       ├── puae_libretro.wasm
    │       └── puae_libretro.js
```

### URL Resolution Strategy
- Default for vAmiga: `/cores/vamiga/index.html` (Local Pinned). Fallback / override: `https://vamigaweb.github.io/` or custom URL.
- Default for PUAE: `/cores/emulatorjs/data/` (Local Pinned). Fallback / override: `https://cdn.emulatorjs.org/stable/data/` or custom URL.
- Both adapters detect and report their runtime mode (`pinned` vs. `remote`) via `RuntimeCapabilities.description` and telemetry HUD.

## 4. Sequence & Fallback Logic
1. Adapter instantiates with local pinned URL by default.
2. Iframe loads from Same-Origin (`/cores/...`), eliminating CORS issues and cross-origin alert popups.
3. If an air-gapped user runs RGME, all dependencies are local and self-contained.
4. Users requiring remote testing can still configure custom `baseUrl` / `dataUrl`.
