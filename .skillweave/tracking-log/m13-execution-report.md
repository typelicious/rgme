# SkillWeave Execution Report: Milestone 13
## Pinned Local Amiga Emulators & License Harmonization (GPL-3.0)

- **Execution ID:** `m13-pinned-emulators`
- **Status:** COMPLETED / VERIFIED GREEN
- **Date:** 2026-11-06
- **Author:** `typelicious <typelicious@gmail.com>`

## Summary of Completed Tasks

### 1. License Harmonization (`M13-LIC-001`)
- RGME root and all packages (`@rgme/core`, `@rgme/web`, `@rgme/cli`) relicensed under the **GNU General Public License v3.0 (GPL-3.0-or-later)**.
- Full compatibility achieved with **vAmiga** (GPL-3.0) and **PUAE / RetroArch** (GPL-2.0+ / GPL-3.0).
- Explicit exemptions maintained for third-party proprietary Kickstart ROMs and commercial game disks (BYOR), with CC0 dedication for synthetic demo assets.
- ADR-004 (`docs/emulators.md`) updated.

### 2. Local Pinned Core Asset Hosting (`M13-PIN-001`)
- Established `packages/web/public/cores/`:
  - `vamiga/index.html`: Standalone Same-Origin vAmiga runner executing the `postMessage` protocol without third-party popups.
  - `emulatorjs/data/loader.js`: Standalone Same-Origin EmulatorJS PUAE loader booting in the `srcdoc` iframe without external CDN calls.
- Assets are automatically copied to `packages/web/dist/cores/` during production builds.

### 3. Core Adapters Refactored (`M13-ADAPT-001`)
- `VAmigaWebAdapter`: Defaults to `PINNED_VAMIGA_URL` (`/cores/vamiga/index.html`). Detects local vs. remote mode and supports optional custom `baseUrl` override.
- `EmulatorJsCoreAdapter`: Defaults to `PINNED_EJS_DATA_URL` (`/cores/emulatorjs/data/`). Detects local vs. remote mode and supports optional custom `dataUrl` override.

### 4. UI Telemetry & Controls (`M13-UI-001`)
- Header selector surfaces `✨ vAmiga Emulator (Real · Pinned Local)` and `🕹️ PUAE Emulator (Real · Pinned Local)`.
- `CoreTelemetryHUD` displays `(PINNED)` status chips.

### 5. Automated Verification (`M13-TEST-001` & `M13-BUILD-001`)
- Unit and integration tests passed cleanly:
  - `m13-pinned-emulators.test.ts` (14/14 tests green)
  - `m12-real-emulators.test.ts` (16/16 tests green)
- `pnpm build` completed with zero TypeScript errors.
